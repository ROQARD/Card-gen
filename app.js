// Ensure everything runs only after the page is ready
window.onload = function() {
    
    const CARD_PORTRAIT = { width: 500, height: 700 };
    const CARD_LANDSCAPE = { width: 700, height: 500 };
    let isPortrait = true;

    // Initialize Canvas
    const canvas = new fabric.Canvas('cardCanvas', {
        width: CARD_PORTRAIT.width,
        height: CARD_PORTRAIT.height,
        backgroundColor: '#ffffff',
        preserveObjectStacking: true 
    });

    // --- UI CONTEXT MENU LOGIC ---
    const topbar = document.getElementById('topbar');
    const fontSelector = document.getElementById('fontFamily');
    const colorSelector = document.getElementById('textColor');
    const strokeColorSelector = document.getElementById('strokeColor');
    const strokeWidthSelector = document.getElementById('strokeWidth');

    canvas.on('selection:created', handleSelection);
    canvas.on('selection:updated', handleSelection);
    canvas.on('selection:cleared', () => topbar.classList.remove('active'));

    function handleSelection(e) {
        const activeObject = e.selected[0];
        if (activeObject && activeObject.type === 'i-text') {
            topbar.classList.add('active');
            fontSelector.value = activeObject.fontFamily || 'Roboto';
            colorSelector.value = activeObject.fill || '#000000';
            strokeColorSelector.value = activeObject.stroke || '#ffffff';
            strokeWidthSelector.value = activeObject.strokeWidth || 0;
        } else {
            topbar.classList.remove('active');
        }
    }

    // Attach to window so HTML buttons can trigger them
    window.updateTextProperty = function(property, value) {
        const activeObject = canvas.getActiveObject();
        if (activeObject && activeObject.type === 'i-text') {
            if (property === 'strokeWidth') value = parseFloat(value);
            activeObject.set(property, value);
            canvas.requestRenderAll();
        }
    };

    // --- CORE FEATURES ---
    window.addText = function() {
        const text = new fabric.IText('Edit Text', {
            left: canvas.width / 2 - 80,
            top: canvas.height / 2,
            fontFamily: 'Montserrat',
            fill: '#1e293b',
            fontSize: 42,
            fontWeight: 'bold',
            stroke: '#ffffff',
            strokeWidth: 0
        });
        canvas.add(text);
        canvas.setActiveObject(text);
    };

    document.getElementById('imageUpload').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            const imgObj = new Image();
            imgObj.src = event.target.result;
            imgObj.onload = function() {
                const img = new fabric.Image(imgObj);
                if (img.width > canvas.width) img.scaleToWidth(canvas.width * 0.8);
                img.set({ left: 40, top: 40 });
                canvas.add(img);
                canvas.setActiveObject(img);
            }
        };
        reader.readAsDataURL(file);
        e.target.value = ''; 
    });

    window.moveLayer = function(direction) {
        const activeObject = canvas.getActiveObject();
        if (!activeObject) return;
        if (direction === 'up') canvas.bringForward(activeObject);
        if (direction === 'down') canvas.sendBackwards(activeObject);
        canvas.requestRenderAll();
    };

    window.toggleOrientation = function() {
        isPortrait = !isPortrait;
        const newDims = isPortrait ? CARD_PORTRAIT : CARD_LANDSCAPE;
        canvas.setWidth(newDims.width);
        canvas.setHeight(newDims.height);
        
        canvas.getObjects().forEach(obj => {
            if (obj.left > newDims.width) obj.set('left', newDims.width - 150);
            if (obj.top > newDims.height) obj.set('top', newDims.height - 100);
        });
        canvas.requestRenderAll();
    };

    window.deleteSelected = function() {
        const activeObjects = canvas.getActiveObjects();
        if (activeObjects.length) {
            canvas.discardActiveObject();
            activeObjects.forEach(obj => canvas.remove(obj));
        }
    };

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (!canvas.getActiveObject()?.isEditing) window.deleteSelected();
        }
    });

    window.downloadCard = function() {
        canvas.discardActiveObject(); 
        canvas.renderAll();
        const link = document.createElement('a');
        link.download = 'MyCard.png';
        link.href = canvas.toDataURL({ format: 'png', quality: 1, multiplier: 2 });
        link.click();
    };

    // --- DATABASE LOGIC (Safely Wrapped) ---
    let db = null;
    try {
        const request = indexedDB.open("CardMakerDB", 1);
        request.onupgradeneeded = (e) => {
            db = e.target.result;
            if (!db.objectStoreNames.contains('projects')) {
                db.createObjectStore('projects', { keyPath: 'id' });
            }
        };
        request.onsuccess = (e) => db = e.target.result;
        request.onerror = (e) => console.warn("Database access denied by browser.");
    } catch(err) {
        console.warn("IndexedDB is not supported in this environment.");
    }

    window.saveProject = function() {
        if (!db) return alert("Saving to database is blocked by your browser's local file settings. You can still download the image!");
        const name = prompt("Name your card design:", "New Card");
        if (!name) return;

        const projectData = {
            id: Date.now(),
            name: name,
            isPortrait: isPortrait,
            json: JSON.stringify(canvas.toJSON()) 
        };

        const transaction = db.transaction(['projects'], 'readwrite');
        const store = transaction.objectStore('projects');
        store.put(projectData);
        transaction.oncomplete = () => alert("Card saved successfully!");
    };

    window.loadProject = function(id) {
        const transaction = db.transaction(['projects'], 'readonly');
        const store = transaction.objectStore('projects');
        const req = store.get(id);

        req.onsuccess = () => {
            const project = req.result;
            if (project) {
                isPortrait = project.isPortrait;
                const dims = isPortrait ? CARD_PORTRAIT : CARD_LANDSCAPE;
                canvas.setWidth(dims.width);
                canvas.setHeight(dims.height);
                canvas.loadFromJSON(project.json, () => {
                    canvas.renderAll();
                    window.closeSavesModal();
                });
            }
        };
    };

    window.deleteProjectFromDB = function(id) {
        if(!confirm("Are you sure you want to delete this save?")) return;
        const transaction = db.transaction(['projects'], 'readwrite');
        const store = transaction.objectStore('projects');
        store.delete(id);
        transaction.oncomplete = () => window.openSavesModal(); 
    };

    // --- MODAL LOGIC ---
    const modal = document.getElementById('savesModal');

    window.openSavesModal = function() {
        if (!db) return alert("Database is blocked by your browser settings.");
        const list = document.getElementById('savesList');
        list.innerHTML = 'Loading...';
        modal.style.display = 'flex';

        const transaction = db.transaction(['projects'], 'readonly');
        const store = transaction.objectStore('projects');
        const req = store.getAll();

        req.onsuccess = () => {
            list.innerHTML = '';
            if (req.result.length === 0) {
                list.innerHTML = '<p>No saved cards yet.</p>';
                return;
            }
            
            req.result.forEach(project => {
                const div = document.createElement('div');
                div.className = 'save-item';
                const dateStr = new Date(project.id).toLocaleDateString();
                div.innerHTML = `
                    <div><strong>${project.name}</strong><br><small>${dateStr}</small></div>
                    <div style="display:flex; gap: 8px;">
                        <button class="primary" onclick="loadProject(${project.id})">Load</button>
                        <button class="danger" onclick="deleteProjectFromDB(${project.id})">X</button>
                    </div>
                `;
                list.appendChild(div);
            });
        };
    };

    window.closeSavesModal = function() { modal.style.display = 'none'; };
};
