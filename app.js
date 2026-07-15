// Глобальные переменные
let originalImage = null;
let splitImages = [];
let currentZoom = 1;
let panX = 0;
let panY = 0;
let rotation = 0;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let imageLoaded = false;
let currentPadding = 5;
let smoothingEnabled = true;

// Canvas и контекст
const canvas = document.getElementById('editCanvas');
const ctx = canvas.getContext('2d');

// Элементы DOM
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const imageEditor = document.getElementById('imageEditor');
const canvasContainer = document.getElementById('canvasContainer');
const gridOverlay = document.getElementById('gridOverlay');
const previewSection = document.getElementById('previewSection');
const gridPreview = document.getElementById('gridPreview');
const splitBtn = document.getElementById('splitBtn');
const downloadPngBtn = document.getElementById('downloadPngBtn');
const zoomInput = document.getElementById('zoomInput');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const resetViewBtn = document.getElementById('resetViewBtn');
const changeImageBtn = document.getElementById('changeImageBtn');
const gridSize = document.getElementById('gridSize');
const customRows = document.getElementById('customRows');
const customCols = document.getElementById('customCols');
const useCustomGrid = document.getElementById('useCustomGrid');
const paddingInput = document.getElementById('paddingInput');
const paddingDirection = document.getElementById('paddingDirection');
const rotationSlider = document.getElementById('rotationSlider');
const rotationValue = document.getElementById('rotationValue');
const rotateLeft90Btn = document.getElementById('rotateLeft90');
const rotateRight90Btn = document.getElementById('rotateRight90');
const resetRotationBtn = document.getElementById('resetRotation');
const smoothingToggle = document.getElementById('smoothingToggle');
const smoothingStatus = document.getElementById('smoothingStatus');
const offlineIndicator = document.getElementById('offlineIndicator');

function init() {
    setupEventListeners();
    checkOnlineStatus();
    updateSmoothingStatus();
}

function checkOnlineStatus() {
    offlineIndicator.style.display = navigator.onLine ? 'none' : 'flex';
}

window.addEventListener('online', checkOnlineStatus);
window.addEventListener('offline', checkOnlineStatus);

function setupCanvas() {
    const rect = canvasContainer.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
        canvas.width = rect.width;
        canvas.height = rect.height;
        updateCanvasTransform();
    }
}

function updateCanvasTransform() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (originalImage) {
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(currentZoom, currentZoom);
        ctx.rotate(rotation * Math.PI / 180);
        ctx.translate(panX, panY);
        ctx.drawImage(originalImage, -originalImage.width / 2, -originalImage.height / 2);
        ctx.restore();
    }
}

function setupEventListeners() {
    uploadArea.addEventListener('click', () => fileInput.click());
    changeImageBtn.addEventListener('click', () => fileInput.click());
    
    uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('dragover'); });
    uploadArea.addEventListener('dragleave', () => { uploadArea.classList.remove('dragover'); });
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
    });
    
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleFile(e.target.files[0]);
    });
    
    zoomInBtn.addEventListener('click', () => zoom(0.05));
    zoomOutBtn.addEventListener('click', () => zoom(-0.05));
    resetViewBtn.addEventListener('click', resetView);
    
    zoomInput.addEventListener('change', (e) => {
        let value = parseInt(e.target.value);
        if (isNaN(value)) value = 100;
        value = Math.max(10, Math.min(500, value));
        e.target.value = value;
        currentZoom = value / 100;
        updateCanvasTransform();
    });
    zoomInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') e.target.blur(); });
    
    paddingInput.addEventListener('input', (e) => {
        let value = parseInt(e.target.value);
        if (isNaN(value) || value < 0) value = 0;
        if (value > 50) value = 50;
        currentPadding = value;
        if (previewSection.classList.contains('active')) updateGridPreviewGap();
    });
    
    rotationSlider.addEventListener('input', (e) => {
        rotation = parseInt(e.target.value);
        rotationValue.textContent = rotation + '°';
        updateCanvasTransform();
    });
    
    rotateLeft90Btn.addEventListener('click', () => {
        rotation = (rotation - 90 + 360) % 360;
        if (rotation > 180) rotation -= 360;
        rotationSlider.value = rotation;
        rotationValue.textContent = rotation + '°';
        updateCanvasTransform();
    });
    
    rotateRight90Btn.addEventListener('click', () => {
        rotation = (rotation + 90) % 360;
        if (rotation > 180) rotation -= 360;
        rotationSlider.value = rotation;
        rotationValue.textContent = rotation + '°';
        updateCanvasTransform();
    });
    
    resetRotationBtn.addEventListener('click', () => {
        rotation = 0;
        rotationSlider.value = 0;
        rotationValue.textContent = '0°';
        updateCanvasTransform();
    });
    
    smoothingToggle.addEventListener('change', (e) => {
        smoothingEnabled = e.target.checked;
        updateSmoothingStatus();
    });
    
    canvas.addEventListener('mousedown', startDrag);
    window.addEventListener('mousemove', drag);
    window.addEventListener('mouseup', endDrag);
    canvas.addEventListener('wheel', handleWheel, {passive: false});
    
    canvas.addEventListener('touchstart', handleTouchStart, {passive: false});
    canvas.addEventListener('touchmove', handleTouchMove, {passive: false});
    canvas.addEventListener('touchend', endDrag);
    
    splitBtn.addEventListener('click', splitImage);
    downloadPngBtn.addEventListener('click', downloadAllAsPng);
    
    gridSize.addEventListener('change', updateGrid);
    customRows.addEventListener('input', updateGrid);
    customCols.addEventListener('input', updateGrid);
    useCustomGrid.addEventListener('change', updateGrid);
    
    window.addEventListener('resize', () => {
        setupCanvas();
        if (originalImage) updateGrid();
    });
}

function updateSmoothingStatus() {
    const onIndicator = smoothingStatus.querySelector('.on');
    const offIndicator = smoothingStatus.querySelector('.off');
    
    if (smoothingEnabled) {
        onIndicator.style.display = 'inline-block';
        offIndicator.style.display = 'none';
    } else {
        onIndicator.style.display = 'none';
        offIndicator.style.display = 'inline-block';
    }
}

function handleFile(file) {
    if (!file.type.startsWith('image/')) { alert('Пожалуйста, загрузите изображение!'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
        originalImage = new Image();
        originalImage.onload = () => {
            imageLoaded = true;
            uploadArea.style.display = 'none';
            imageEditor.style.display = 'block';
            
            requestAnimationFrame(() => {
                setupCanvas();
                resetView();
                splitBtn.disabled = false;
                updateGrid();
            });
        };
        originalImage.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function zoom(delta) {
    currentZoom = Math.max(0.1, Math.min(5, currentZoom + delta));
    zoomInput.value = Math.round(currentZoom * 100);
    updateCanvasTransform();
}

function resetView() {
    currentZoom = 1; 
    panX = 0; 
    panY = 0;
    zoomInput.value = 100;
    updateCanvasTransform();
}

function startDrag(e) {
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    canvas.style.cursor = 'grabbing';
}

function drag(e) {
    if (!isDragging) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    
    panX += dx / currentZoom;
    panY += dy / currentZoom;
    
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    updateCanvasTransform();
}

function endDrag() { 
    isDragging = false; 
    canvas.style.cursor = 'move'; 
}

function handleWheel(e) {
    e.preventDefault();
    zoom(e.deltaY > 0 ? -0.05 : 0.05);
}

let initialPinchDistance = null;
function handleTouchStart(e) {
    if (e.touches.length === 2) {
        initialPinchDistance = getPinchDistance(e.touches);
    } else if (e.touches.length === 1) {
        startDrag(e.touches[0]);
    }
}

function handleTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 2 && initialPinchDistance) {
        const currentDistance = getPinchDistance(e.touches);
        zoom((currentDistance - initialPinchDistance) / 300);
        initialPinchDistance = currentDistance;
    } else if (e.touches.length === 1) {
        const touch = e.touches[0];
        const dx = touch.clientX - dragStartX;
        const dy = touch.clientY - dragStartY;
        panX += dx / currentZoom;
        panY += dy / currentZoom;
        dragStartX = touch.clientX;
        dragStartY = touch.clientY;
        updateCanvasTransform();
    }
}

function getPinchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

function getGridSize() {
    if (useCustomGrid.checked) return { rows: parseInt(customRows.value) || 2, cols: parseInt(customCols.value) || 2 };
    const val = parseInt(gridSize.value) || 2;
    return { rows: val, cols: val };
}

function updateGrid() {
    if (!imageLoaded) return;
    const { rows, cols } = getGridSize();
    gridOverlay.innerHTML = '';
    previewSection.classList.add('active');
    
    const containerRect = canvasContainer.getBoundingClientRect();
    const cellWidth = containerRect.width / cols;
    const cellHeight = containerRect.height / rows;
    
    gridOverlay.style.width = containerRect.width + 'px';
    gridOverlay.style.height = containerRect.height + 'px';
    
    for (let i = 1; i < cols; i++) {
        const line = document.createElement('div');
        line.className = 'grid-line-v';
        line.style.left = (i * cellWidth - 1) + 'px';
        gridOverlay.appendChild(line);
    }
    for (let i = 1; i < rows; i++) {
        const line = document.createElement('div');
        line.className = 'grid-line-h';
        line.style.top = (i * cellHeight - 1) + 'px';
        gridOverlay.appendChild(line);
    }
    
    gridPreview.innerHTML = '';
    gridPreview.style.gridTemplateColumns = `repeat(${cols}, 100px)`;
    updateGridPreviewGap();
}

function updateGridPreviewGap() { gridPreview.style.gap = currentPadding + 'px'; }

function generateFileName(index) {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2);
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `part_${index}_${day}${month}${year}${hours}${minutes}.png`;
}

function splitImage() {
    if (!originalImage) return;
    const { rows, cols } = getGridSize();
    const pieceSize = 100;
    const padding = currentPadding;
    const paddingDir = paddingDirection.value;
    
    const targetSize = cols * pieceSize;
    
    const captureCanvas = document.createElement('canvas');
    captureCanvas.width = targetSize;
    captureCanvas.height = targetSize;
    const cCtx = captureCanvas.getContext('2d');
    
    // Коэффициент масштабирования между редактором и captureCanvas
    const scale = targetSize / canvas.width;
    
    // ИСПРАВЛЕНО: Применяем scale ко всем трансформациям
    cCtx.translate(targetSize / 2, targetSize / 2);
    cCtx.scale(currentZoom * scale, currentZoom * scale);  // <-- умножаем зум на scale
    cCtx.rotate(rotation * Math.PI / 180);
    cCtx.translate(panX * scale, panY * scale);
    cCtx.drawImage(originalImage, -originalImage.width / 2, -originalImage.height / 2);
    
    // Нарезаем
    splitImages = [];
    gridPreview.innerHTML = '';
    let partIndex = 0;
    
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = pieceSize;
            finalCanvas.height = pieceSize;
            const finalCtx = finalCanvas.getContext('2d');
            
            finalCtx.imageSmoothingEnabled = smoothingEnabled;
            finalCtx.imageSmoothingQuality = 'high';
            
            let topPad = 0, bottomPad = 0;
            
            if (paddingDir === 'between') {
                if (row === 0) { topPad = 0; bottomPad = padding; }
                else if (row === rows - 1) { topPad = padding; bottomPad = 0; }
                else { topPad = padding; bottomPad = padding; }
            } else if (paddingDir === 'top') {
                topPad = padding; bottomPad = 0;
            } else if (paddingDir === 'bottom') {
                topPad = 0; bottomPad = padding;
            }
            
            const x = col * pieceSize;
            const y = row * pieceSize;
            const srcHeight = Math.max(0, pieceSize - topPad - bottomPad);
            
            finalCtx.drawImage(captureCanvas, x, y, pieceSize, srcHeight, 0, topPad, pieceSize, srcHeight);
            
            const dataUrl = finalCanvas.toDataURL('image/png');
            splitImages.push({ dataUrl, name: generateFileName(partIndex), index: partIndex });
            
            const wrapper = document.createElement('div');
            wrapper.className = 'part-wrapper';
            
            const img = document.createElement('img');
            img.src = dataUrl;
            img.alt = `Часть ${partIndex}`;
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = true;
            checkbox.dataset.index = partIndex;
            checkbox.title = `Часть ${partIndex}`;
            
            wrapper.appendChild(img);
            wrapper.appendChild(checkbox);
            gridPreview.appendChild(wrapper);
            
            partIndex++;
        }
    }
    
    downloadPngBtn.disabled = false;
    updateGridPreviewGap();
    previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function downloadAllAsPng() {
    if (splitImages.length === 0) return;

    const checkboxes = gridPreview.querySelectorAll('input[type="checkbox"]');
    const selectedIndices = new Set();
    checkboxes.forEach(cb => {
        if (cb.checked) {
            selectedIndices.add(parseInt(cb.dataset.index));
        }
    });

    if (selectedIndices.size === 0) {
        alert('Пожалуйста, выберите хотя бы одну часть для скачивания!');
        return;
    }

    const selectedImages = splitImages.filter(img => selectedIndices.has(img.index));

    if (navigator.share && navigator.canShare) {
        try {
            const files = [];
            for (const img of selectedImages) {
                const byteString = atob(img.dataUrl.split(',')[1]);
                const mimeString = img.dataUrl.split(',')[0].split(':')[1].split(';')[0];
                const ab = new ArrayBuffer(byteString.length);
                const ia = new Uint8Array(ab);
                for (let i = 0; i < byteString.length; i++) {
                    ia[i] = byteString.charCodeAt(i);
                }
                files.push(new File([ab], img.name, { type: mimeString }));
            }

            if (navigator.canShare({ files })) {
                await navigator.share({
                    files: files,
                    title: 'Нарезанные изображения',
                });
                return;
            }
        } catch (err) {
            console.log('Share API failed, falling back to standard download', err);
        }
    }

    alert('Нажмите "Разрешить", если браузер спросит разрешение на скачивание нескольких файлов.');
    for (let i = 0; i < selectedImages.length; i++) {
        const img = selectedImages[i];
        const link = document.createElement('a');
        link.download = img.name;
        link.href = img.dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        if (i < selectedImages.length - 1) await new Promise(resolve => setTimeout(resolve, 500));
    }
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => console.error('SW error:', err));
    });
}

document.addEventListener('DOMContentLoaded', init);