window.onload = function() {
    const CARD_PORTRAIT = { width: 500, height: 700 };
    const CARD_LANDSCAPE = { width: 700, height: 500 };
    let isPortrait = true;
    let activeProjectId = null; // Tracks current open project

    const canvas = new fabric.Canvas('cardCanvas', {
        width: CARD_PORTRAIT.width, height: CARD_PORTRAIT.height,
        backgroundColor: '#ffffff', preserveObjectStacking: true
    });

    // --- UI SYNC ---
    const topbar = document.getElementById('topbar');
    canvas.on('selection:created', handleSelection);
    canvas.on('selection:updated', handleSelection);
    canvas.on('selection:cleared', () => topbar.classList.remove('active'));

    function handleSelection(e) {
        const obj = e.selected[0];
        topbar.classList.add('active');
        if (obj.type === 'i-text' || obj.type === 'text') {
            document.getElementById('fontFamily').value = obj.fontFamily;
            document.getElementById('textColor').value = obj.fill;
            document.getElementById('strokeColor').value = obj.stroke || '#ffffff';
            document.getElementById('strokeWidth').value = obj.strokeWidth || 0;
            document.getElementById('opacity').value = obj.opacity || 1;
        }
    }

    window.updateTextProperty = function(p, v) {
        const obj = canvas.getActiveObject();
        if (obj) {
            if (['strokeWidth', 'opacity'].includes(p)) v = parseFloat(v);
            obj.set(p, v);
            canvas.requestRenderAll();
        }
    };

    window.updateCanvasBg = function(color) {
        canvas.setBackgroundColor(color, canvas.renderAll.bind(canvas));
    };

    // --- ACTIONS ---
    window.addText = () => {
        const t = new fabric.IText('Double Click', { left: 100, top: 100, fontFamily: 'Montserrat', fontSize: 40, fontWeight: 'bold' });
        canvas.add(t); canvas.setActiveObject(t);
    };

    document.getElementById('imageUpload').onchange = (e) => {
        const reader = new FileReader();
        reader.onload = (f) => {
            fabric.Image.fromURL(f.target.result, (img) => {
                img.scaleToWidth(250); canvas.add(img); canvas.setActiveObject(img);
            });
        };
        reader.readAsDataURL(e.target.files[0]);
    };

    window.toggleOrientation = () => {
        isPortrait = !isPortrait;
        const d = isPortrait ? CARD_PORTRAIT : CARD_LANDSCAPE;
        canvas.setDimensions(d); canvas.requestRenderAll();
    };

    window.moveLayer = (dir) => {
        const obj = canvas.getActiveObject();
        if (!obj) return;
        dir === 'up' ? canvas.bringForward(obj) : canvas.sendBackwards(obj);
        canvas.requestRenderAll();
    };

    window.deleteSelected = () => {
        canvas.getActiveObjects().forEach(obj => canvas.remove(obj));
        canvas.discardActiveObject();
    };

    window.downloadCard = () => {
        canvas.discardActiveObject().renderAll();
        const link = document.createElement('a');
        link.download = 'Card.png';
        link.href = canvas.toDataURL({ format: 'png', multiplier: 2 });
        link.click();
    };

    // --- DATABASE & AUTO-SAVE ---
    let db;
    const dbReq = indexedDB.open("CardMakerProDB", 2);
    dbReq.onupgradeneeded = (e) => {
        db = e.target.result;
        if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
    };
    dbReq.onsuccess = (e) => db = e.target.result;

    window.saveProject = function(isAuto = false) {
        if (!db) return;
        
        let id = activeProjectId;
        let name = "";

        // If it's a new manual save or no active project, ask for name
        if (!isAuto || !id) {
            name = prompt("Project Name:", activeProjectId ? "Overwrite Current" : "My Card");
            if (!name) return;
            if (!activeProjectId) id = Date.now(); // Create new ID
        } else {
            // Find existing name for auto-save
            name = document.getElementById('saveStatus').innerText.replace("Project: ", "").replace(" (Saving...)", "");
        }

        const data = {
            id: id, name: name, isPortrait: isPortrait,
            json: JSON.stringify(canvas.toJSON()),
            bgColor: document.getElementById('bgColor').value
        };

        const tx = db.transaction(['projects'], 'readwrite');
        tx.objectStore('projects').put(data);
        
        tx.oncomplete = () => {
            activeProjectId = id;
            document.getElementById('saveStatus').innerText = `Project: ${name}`;
            if (!isAuto) alert("Project Saved!");
        };
    };

    // Auto-save timer (runs every 5 seconds if a project is active)
    setInterval(() => {
        if (activeProjectId) {
            document.getElementById('saveStatus').innerText += " (Saving...)";
            window.saveProject(true);
        }
    }, 5000);

    window.openSavesModal = () => {
        const modal = document.getElementById('savesModal');
        const list = document.getElementById('savesList');
        modal.style.display = 'flex';
        list.innerHTML = "Loading...";

        const tx = db.transaction(['projects'], 'readonly');
        tx.objectStore('projects').getAll().onsuccess = (e) => {
            list.innerHTML = "";
            e.target.result.forEach(p => {
                const row = document.createElement('div');
                row.className = 'save-item';
                row.innerHTML = `<span>${p.name}</span> <div>
                    <button onclick="loadProject(${p.id})">Load</button>
                    <button onclick="deleteProject(${p.id})" style="color:red">X</button>
                </div>`;
                list.appendChild(row);
            });
        };
    };

    window.loadProject = (id) => {
        const tx = db.transaction(['projects'], 'readonly');
        tx.objectStore('projects').get(id).onsuccess = (e) => {
            const p = e.target.result;
            activeProjectId = p.id;
            isPortrait = p.isPortrait;
            canvas.setDimensions(isPortrait ? CARD_PORTRAIT : CARD_LANDSCAPE);
            document.getElementById('bgColor').value = p.bgColor || "#ffffff";
            updateCanvasBg(p.bgColor || "#ffffff");
            canvas.loadFromJSON(p.json, () => {
                canvas.renderAll();
                document.getElementById('saveStatus').innerText = `Project: ${p.name}`;
                document.getElementById('savesModal').style.display = 'none';
            });
        };
    };

    window.deleteProject = (id) => {
        if (!confirm("Delete this card?")) return;
        db.transaction(['projects'], 'readwrite').objectStore('projects').delete(id).oncomplete = () => {
            if (activeProjectId === id) activeProjectId = null;
            window.openSavesModal();
        };
    };
};
