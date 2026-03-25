// Initialize the Fabric.js canvas
const canvas = new fabric.Canvas('cardCanvas', {
    backgroundColor: '#ffffff',
    preserveObjectStacking: true // Keeps selected objects from jumping to the front automatically
});

// --- 1. Add Text ---
document.getElementById('addTextBtn').addEventListener('click', () => {
    const text = new fabric.IText('Happy Birthday!', {
        left: 50,
        top: 50,
        fontFamily: 'Arial',
        fill: '#000000',
        fontSize: 40,
        fontWeight: 'bold'
    });
    canvas.add(text);
    canvas.setActiveObject(text);
});

// --- 2. Add Image (Supports transparent PNGs) ---
document.getElementById('imageUpload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        const imgObj = new Image();
        imgObj.src = event.target.result;
        
        imgObj.onload = function() {
            const img = new fabric.Image(imgObj);
            
            // Scale large images down so they fit on the card and perform well
            if (img.width > canvas.width) {
                img.scaleToWidth(canvas.width * 0.8);
            }
            
            img.set({
                left: 20,
                top: 20
            });
            
            canvas.add(img);
            canvas.setActiveObject(img);
        }
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset the input so you can upload the same image again if needed
});

// --- 3. Delete Selected Object ---
function deleteSelected() {
    const activeObjects = canvas.getActiveObjects();
    if (activeObjects.length) {
        canvas.discardActiveObject();
        activeObjects.forEach(function(object) {
            canvas.remove(object);
        });
    }
}

document.getElementById('deleteBtn').addEventListener('click', deleteSelected);

// Support Delete and Backspace keys
window.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
        // Prevent deleting if the user is currently typing inside a text box
        if (!canvas.getActiveObject()?.isEditing) {
            deleteSelected();
        }
    }
});

// --- 4. Download as Image ---
document.getElementById('downloadBtn').addEventListener('click', () => {
    // Deselect everything so the transform boxes don't show up in the downloaded image
    canvas.discardActiveObject();
    canvas.renderAll();
    
    // Export canvas as a PNG data URL
    const dataURL = canvas.toDataURL({
        format: 'png',
        quality: 1
    });
    
    // Create a temporary link to trigger the download
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = 'my-custom-card.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// --- 5. Print Card ---
document.getElementById('printBtn').addEventListener('click', () => {
    // Deselect objects before printing
    canvas.discardActiveObject();
    canvas.renderAll();
    
    // Trigger the browser's native print dialog. 
    // The CSS @media print in index.html handles hiding the UI.
    window.print();
});
