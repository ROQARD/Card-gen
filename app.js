// --- CONFIGURATION ---
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

// Show/Hide top bar based on selection
canvas.on('selection:created', handleSelection);
canvas.on('selection:updated', handleSelection);
canvas.on('selection:cleared', () => {
    topbar.classList.remove('active');
});

function handleSelection(e) {
    const activeObject = e.selected[0];
    if (activeObject && activeObject.type === 'i-text') {
        topbar.classList.add('active');
        // Sync the UI controls to match the selected text's actual properties
        fontSelector.value = activeObject.fontFamily || 'Roboto';
        colorSelector.value = activeObject.fill || '#000000';
    } else {
        topbar.classList.remove('active'); // Hide if an image is selected
    }
}

function updateTextProperty(property, value) {
    const activeObject = canvas.getActiveObject();
    if (activeObject && activeObject.type === 'i-text') {
        activeObject.set(property, value);
        canvas.requestRenderAll();
    }
}

// --- CORE FEATURES ---
function addText() {
    const text = new fabric.IText('Edit Text', {
        left: canvas.width / 2 - 50,
        top: canvas.height / 2,
        fontFamily: 'Roboto',
        fill: '#1f2937',
        fontSize: 48,
        fontWeight: 'bold'
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
            // Auto-scale to fit canvas if it's too big
            if (img.width > canvas.width) img.scaleToWidth(canvas.width * 0.8);
            img.set({ left: 50, top: 50 });
            canvas.add(img);
            canvas.setActiveObject(img);
        }
    };
    reader.readAsDataURL(file);
    e.target.value = ''; 
});

function toggleOrientation() {
    isPortrait = !isPortrait;
    const newDims = isPortrait ? CARD_PORTRAIT : CARD_LANDSCAPE;
    
    // Resize canvas
    canvas.setWidth(newDims.width);
    canvas.setHeight(newDims.height);
    
    // Re-center all objects so they don't get lost off-screen
    canvas.getObjects().forEach(obj => {
        if (obj.left > newDims.width) obj.set('left', newDims.width - 100);
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
    canvas.discardActiveObject(); // Remove selection borders
    canvas.renderAll();
    const link = document.createElement('a');
    link.download = 'MyCard.png';
    link.href = canvas.toDataURL({ format: 'png', quality: 1 });
    link.click();
}

// --- DATABASE LOGIC (IndexedDB for Multiple Saves) ---
// IndexedDB is asynchronous and handles large image data effortlessly on slow devices.
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
    
    const name = prompt("Name your card design:", "Birthday Card");
    if (!name) return;

    const projectData = {
        id: Date.now(), // Unique ID based on time
        name: name,
        isPortrait: isPortrait,
        json: JSON.stringify(canvas.toJSON()) // Save all canvas data
    };

    const transaction = db.transaction(['projects'], 'readwrite');
    const store = transaction.objectStore('projects');
    store.put(projectData);
    
    transaction.oncomplete = () => alert("Card saved successfully!");
    transaction.onerror = () => alert("Error saving card.");
}

function loadProject(id) {
    const transaction = db.transaction(['projects'], 'readonly');
    const store = transaction.objectStore('projects');
    const request = store.get(id);

    request.onsuccess = () => {
        const project = request.result;
        if (project) {
            // Restore orientation
            isPortrait = project.isPortrait;
            const dims = isPortrait ? CARD_PORTRAIT : CARD_LANDSCAPE;
            canvas.setWidth(dims.width);
            canvas.setHeight(dims.height);

            // Restore canvas objects
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
    transaction.oncomplete = () => openSavesModal(); // Refresh list
}

// --- MODAL LOGIC ---
const modal = document.getElementById('savesModal');

function openSavesModal() {
    const list = document.getElementById('savesList');
    list.innerHTML = 'Loading saves...';
    modal.style.display = 'flex';

    const transaction = db.transaction(['projects'], 'readonly');
    const store = transaction.objectStore('projects');
    const request = store.getAll();

    request.onsuccess = () => {
        list.innerHTML = '';
        if (request.result.length === 0) {
            list.innerHTML = '<p>No saved cards yet.</p>';
            return;
        }
        
        // Build the list of saves dynamically
        request.result.forEach(project => {
            const div = document.createElement('div');
            div.className = 'save-item';
            
            const dateStr = new Date(project.id).toLocaleDateString();
            div.innerHTML = `
                <div>
                    <strong>${project.name}</strong><br>
                    <small style="color:#666">${dateStr}</small>
                </div>
                <div style="display:flex; gap: 5px;">
                    <button class="primary" onclick="loadProject(${project.id})">Load</button>
                    <button style="color: #dc3545; border-color: #dc3545;" onclick="deleteProjectFromDB(${project.id})">X</button>
                </div>
            `;
            list.appendChild(div);
        });
    };
}

function closeSavesModal() {
    modal.style.display = 'none';
}
