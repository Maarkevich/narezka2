// Глобальные переменные
let originalImage = null;
let splitImages = [];
let currentZoom = 1;
let panX = 0;
let panY = 0;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let imageLoaded = false;
let currentPadding = 5;

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
const offlineIndicator = document.getElementById('offlineIndicator');

function init() {
    setupEventListeners();
    checkOnlineStatus();
}

function checkOnlineStatus() {
    offlineIndicator.style.display = navigator.onLine ? 'none' : 'flex';
}

window.addEventListener('online', checkOnlineStatus);
window.addEventListener('offline', checkOnlineStatus);

// ИСПРАВЛЕНО: Вынесено в отдельную функцию, вызывается когда редактор уже видим
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
        // 1. Перемещаем начало координат в центр canvas
        ctx.translate(canvas.width / 2, canvas.height / 2);
        // 2. Применяем зум
        ctx.scale(currentZoom, currentZoom);
        // 3. Применяем смещение (pan)
        ctx.translate(panX, panY);
        // 4. Рисуем изображение, центрируя его относительно (0,0)
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
    
    // Мышь
    canvas.addEventListener('mousedown', startDrag);
    window.addEventListener('mousemove', drag); // Слушаем window, чтобы не терять драг при выходе за пределы canvas
    window.addEventListener('mouseup', endDrag);
    canvas.addEventListener('wheel', handleWheel, {passive: false});
    
    // Тач
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

function handleFile(file) {
    if (!file.type.startsWith('image/')) { alert('Пожалуйста, загрузите изображение!'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
        originalImage = new Image();
        originalImage.onload = () => {
            imageLoaded = true;
            uploadArea.style.display = 'none';
            imageEditor.style.display = 'block';
            
            // ИСПРАВЛЕНО: Ждем отрисовку DOM, затем инициализируем canvas правильного размера
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
    // e.preventDefault(); // Убрано для window, чтобы не ломать скролл страницы
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    
    // ИСПРАВЛЕНО: Делим на зум, чтобы движение мыши на 1px сдвигало картинку ровно на 1px на экране
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
    const pieceWidth = 100, pieceHeight = 100;
    const padding = currentPadding;
    const paddingDir = paddingDirection.value;
    
    const targetWidth = cols * pieceWidth;
    const targetHeight = rows * pieceHeight;
    
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = targetWidth;
    tempCanvas.height = targetHeight;
    tempCtx.drawImage(originalImage, 0, 0, targetWidth, targetHeight);
    
    splitImages = [];
    gridPreview.innerHTML = '';
    let partIndex = 0;
    
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = pieceWidth;
            finalCanvas.height = pieceHeight;
            const finalCtx = finalCanvas.getContext('2d');
            
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
            
            const x = col * pieceWidth;
            const y = row * pieceHeight;
            const srcHeight = Math.max(0, pieceHeight - topPad - bottomPad);
            
            finalCtx.drawImage(tempCanvas, x, y, pieceWidth, srcHeight, 0, topPad, pieceWidth, srcHeight);
            
            const dataUrl = finalCanvas.toDataURL('image/png');
            splitImages.push({ dataUrl, name: generateFileName(partIndex) });
            
            const img = document.createElement('img');
            img.src = dataUrl;
            gridPreview.appendChild(img);
            partIndex++;
        }
    }
    
    downloadPngBtn.disabled = false;
    updateGridPreviewGap();
    previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function downloadAllAsPng() {
    if (splitImages.length === 0) return;
    for (let i = 0; i < splitImages.length; i++) {
        const img = splitImages[i];
        const link = document.createElement('a');
        link.download = img.name;
        link.href = img.dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        if (i < splitImages.length - 1) await new Promise(resolve => setTimeout(resolve, 300));
    }
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => console.error('SW error:', err));
    });
}

document.addEventListener('DOMContentLoaded', init);