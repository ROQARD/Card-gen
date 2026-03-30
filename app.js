const CARD_PORTRAIT = { width: 500, height: 700 };
const CARD_LANDSCAPE = { width: 700, height: 500 };
let isPortrait = true;

const canvas = new fabric.Canvas('cardCanvas', {
    width: CARD_PORTRAIT.width,
    height: CARD_PORTRAIT.height,
    backgroundColor: '#ffffff',
    preserveObjectStacking: true // Essential for proper layer management
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
        // Sync UI inputs with the selected object's actual data
        fontSelector.value = activeObject.fontFamily || 'Roboto';
        colorSelector.value = activeObject.fill || '#000000';
        strokeColorSelector.value = activeObject.stroke || '#ffffff';
        strokeWidthSelector.value = activeObject.strokeWidth || 0;
    } else {
        topbar.classList.remove('active');
    }
}

function updateTextProperty(property, value) {
    const activeObject = canvas.getActiveObject();
    if (activeObject && activeObject.type === 'i-text') {
        // Ensure thickness is treated as a number, not a string
        if (property === 'strokeWidth') value = parseFloat(value);
        
        activeObject.set(property, value);
        canvas.requestRenderAll();
    }
}

// --- CORE FEATURES & LAYERS ---
function addText() {
    const text = new fabric.IText('Double Tap to Edit', {
        left: canvas.width / 2 - 100,
        top: canvas.height / 2,
        fontFamily: 'Montserrat',
        fill: '#1e293b',
        fontSize: 42,
        fontWeight: 'bold',
        stroke: '#ffffff', // Default outline color
        strokeWidth: 0     // Default to no outline
    });
    canvas.add(text);
    canvas.setActiveObject(text);
}

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

// Move Layers Up and Down
function moveLayer(direction) {
    const activeObject = canvas.getActiveObject();
    if (!activeObject) return;

    if (direction === 'up') {
        canvas.bringForward(activeObject);
    } else if (direction === 'down') {
        canvas.sendBackwards(activeObject);
    }
    // ensure objects don't fall behind the canvas background
    canvas.requestRenderAll();
}

function toggleOrientation() {
    isPortrait = !isPortrait;
    const newDims = isPortrait ? CARD_PORTRAIT : CARD_LANDSCAPE;
    canvas.setWidth(newDims.width);
    canvas.setHeight(newDims.height);
    
    canvas.getObjects().forEach(obj => {
        if (obj.left > newDims.width) obj.set('left', newDims.width - 150);
        if (obj.top > newDims.height) obj.set('top', newDims.height - 100);
    });
    canvas.requestRenderAll();
}

function deleteSelected() {
    const activeObjects = canvas.getActiveObjects();
    if (activeObjects.length) {
        canvas.discardActiveObject();
        activeObjects.forEach(obj => canvas.remove(obj));
    }
}

window.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!canvas.getActiveObject()?.isEditing) deleteSelected();
    }
});

function downloadCard() {
    canvas.discardActiveObject(); 
    canvas.renderAll();
    const link = document.createElement('a');
    link.download = 'MyCard.png';
    link.href = canvas.toDataURL({ format: 'png', quality: 1, multiplier: 2 }); // Multiplier:2 exports at high-res
    link.click();
}

// --- DATABASE LOGIC (IndexedDB) ---
let db;
const request = indexedDB.open("CardMakerDB", 1);

request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains('projects')) {
        db.createObjectStore('projects', { keyPath: 'id' });
    }
};
request.onsuccess = (e) => db = e.target.result;

function saveProject() {
    if (!db) return alert("Database not ready yet.");
    const name = prompt("Name your card design:", "New Card");
    if (!name) return;

    const projectData = {
        id: Date.now(),
        name: name,
        isPortrait: isPortrait,
        json: JSON.stringify(canvas.toJSON()) 
    };

    const transaction = db.transaction(['projects'], 'readwrite');
    store = transaction.objectStore('projects');
    store.put(projectData);
    transaction.oncomplete = () => alert("Card saved successfully!");
}

function loadProject(id) {
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
                closeSavesModal();
            });
        }
    };
}

function deleteProjectFromDB(id) {
    if(!confirm("Are you sure you want to delete this save?")) return;
    const transaction = db.transaction(['projects'], 'readwrite');
    const store = transaction.objectStore('projects');
    store.delete(id);
    transaction.oncomplete = () => openSavesModal(); 
}

// --- MODAL LOGIC ---
const modal = document.getElementById('savesModal');

function openSavesModal() {
    const list = document.getElementById('savesList');
    list.innerHTML = 'Loading saves...';
    modal.style.display = 'flex';

    const transaction = db.transaction(['projects'], 'readonly');
    const store = transaction.objectStore('projects');
    const req = store.getAll();

    req.onsuccess = () => {
        list.innerHTML = '';
        if (req.result.length === 0) {
            list.innerHTML = '<p style="color: #64748b;">No saved cards yet.</p>';
            return;
        }
        
        req.result.forEach(project => {
            const div = document.createElement('div');
            div.className = 'save-item';
            const dateStr = new Date(project.id).toLocaleDateString();
            div.innerHTML = `
                <div>
                    <strong>${project.name}</strong><br>
                    <small style="color:#64748b">${dateStr}</small>
                </div>
                <div style="display:flex; gap: 8px;">
                    <button class="primary" onclick="loadProject(${project.id})">Load</button>
                    <button class="danger" onclick="deleteProjectFromDB(${project.id})">X</button>
                </div>
            `;
            list.appendChild(div);
        });
    };
}

function closeSavesModal() { modal.style.display = 'none'; }
