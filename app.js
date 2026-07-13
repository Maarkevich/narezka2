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

// Canvas и контекст
const canvas = document.getElementById('editCanvas');
const ctx = canvas.getContext('2d');

// Элементы DOM
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const imageEditor = document.getElementById('imageEditor');
const canvasContainer = document.getElementById('canvasContainer');
const gridOverlay = document.getElementById('gridOverlay');
const controls = document.getElementById('controls');
const previewSection = document.getElementById('previewSection');
const gridPreview = document.getElementById('gridPreview');
const splitBtn = document.getElementById('splitBtn');
const downloadZipBtn = document.getElementById('downloadZipBtn');
const downloadPngBtn = document.getElementById('downloadPngBtn');
const zoomLevelEl = document.getElementById('zoomLevel');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const resetViewBtn = document.getElementById('resetViewBtn');
const changeImageBtn = document.getElementById('changeImageBtn');
const gridSize = document.getElementById('gridSize');
const customRows = document.getElementById('customRows');
const customCols = document.getElementById('customCols');
const useCustomGrid = document.getElementById('useCustomGrid');

// Инициализация
function init() {
    setupEventListeners();
    setupCanvas();
}

// Настройка canvas
function setupCanvas() {
    const rect = canvasContainer.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    // Центрируем canvas
    updateCanvasTransform();
}

// Обновление трансформации canvas
function updateCanvasTransform() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (originalImage) {
        ctx.save();
        ctx.translate(panX, panY);
        ctx.scale(currentZoom, currentZoom);
        
        // Рисуем изображение по центру
        const x = (canvas.width / currentZoom - originalImage.width) / 2;
        const y = (canvas.height / currentZoom - originalImage.height) / 2;
        
        ctx.drawImage(originalImage, x, y);
        ctx.restore();
    }
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Загрузка файла
    uploadArea.addEventListener('click', () => fileInput.click());
    changeImageBtn.addEventListener('click', () => fileInput.click());
    
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });
    
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });
    
    // Zoom controls
    zoomInBtn.addEventListener('click', () => zoom(0.1));
    zoomOutBtn.addEventListener('click', () => zoom(-0.1));
    resetViewBtn.addEventListener('click', resetView);
    
    // Pan and zoom на canvas
    canvas.addEventListener('mousedown', startDrag);
    canvas.addEventListener('mousemove', drag);
    canvas.addEventListener('mouseup', endDrag);
    canvas.addEventListener('mouseleave', endDrag);
    canvas.addEventListener('wheel', handleWheel);
    
    // Touch events
    canvas.addEventListener('touchstart', handleTouchStart, {passive: false});
    canvas.addEventListener('touchmove', handleTouchMove, {passive: false});
    canvas.addEventListener('touchend', endDrag);
    
    // Controls
    splitBtn.addEventListener('click', splitImage);
    downloadZipBtn.addEventListener('click', downloadAllAsZip);
    downloadPngBtn.addEventListener('click', downloadAllAsPng);
    
    gridSize.addEventListener('change', updateGrid);
    customRows.addEventListener('input', updateGrid);
    customCols.addEventListener('input', updateGrid);
    useCustomGrid.addEventListener('change', updateGrid);
    
    // Resize observer
    window.addEventListener('resize', () => {
        setupCanvas();
        if (originalImage) {
            updateCanvasTransform();
            updateGrid();
        }
    });
}

// Обработка файла
function handleFile(file) {
    if (!file.type.startsWith('image/')) {
        alert('Пожалуйста, загрузите изображение!');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        originalImage = new Image();
        originalImage.onload = () => {
            imageLoaded = true;
            
            // Показываем редактор, скрываем upload area
            uploadArea.style.display = 'none';
            imageEditor.style.display = 'block';
            
            // Сбрасываем view
            resetView();
            
            // Активируем кнопку нарезки
            splitBtn.disabled = false;
            
            // Обновляем сетку
            updateGrid();
        };
        originalImage.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// Zoom
function zoom(delta) {
    const newZoom = Math.max(0.1, Math.min(5, currentZoom + delta));
    currentZoom = newZoom;
    updateZoomLevel();
    updateCanvasTransform();
}

function updateZoomLevel() {
    zoomLevelEl.textContent = Math.round(currentZoom * 100) + '%';
}

function resetView() {
    currentZoom = 1;
    panX = 0;
    panY = 0;
    updateZoomLevel();
    updateCanvasTransform();
}

// Drag
function startDrag(e) {
    isDragging = true;
    dragStartX = e.clientX - panX;
    dragStartY = e.clientY - panY;
    canvas.style.cursor = 'grabbing';
}

function drag(e) {
    if (!isDragging) return;
    e.preventDefault();
    panX = e.clientX - dragStartX;
    panY = e.clientY - dragStartY;
    updateCanvasTransform();
}

function endDrag() {
    isDragging = false;
    canvas.style.cursor = 'move';
}

function handleWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    zoom(delta);
}

// Touch events
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
        const delta = (currentDistance - initialPinchDistance) / 100;
        zoom(delta);
        initialPinchDistance = currentDistance;
    } else if (e.touches.length === 1) {
        drag(e.touches[0]);
    }
}

function getPinchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

// Обновление сетки
function updateGrid() {
    if (!imageLoaded) return;
    
    const { rows, cols } = getGridSize();
    
    // Очищаем оверлей
    gridOverlay.innerHTML = '';
    
    // Показываем секцию превью
    previewSection.classList.add('active');
    
    // Вычисляем размеры
    const containerRect = canvasContainer.getBoundingClientRect();
    const cellWidth = containerRect.width / cols;
    const cellHeight = containerRect.height / rows;
    
    // Устанавливаем размер и позицию оверлея
    gridOverlay.style.width = containerRect.width + 'px';
    gridOverlay.style.height = containerRect.height + 'px';
    gridOverlay.style.left = '0';
    gridOverlay.style.top = '0';
    
    // Рисуем вертикальные линии
    for (let i = 1; i < cols; i++) {
        const line = document.createElement('div');
        line.className = 'grid-line-v';
        line.style.left = (i * cellWidth - 1) + 'px';
        gridOverlay.appendChild(line);
    }
    
    // Рисуем горизонтальные линии
    for (let i = 1; i < rows; i++) {
        const line = document.createElement('div');
        line.className = 'grid-line-h';
        line.style.top = (i * cellHeight - 1) + 'px';
        gridOverlay.appendChild(line);
    }
    
    // Очищаем превью
    gridPreview.innerHTML = '';
    gridPreview.style.gridTemplateColumns = `repeat(${cols}, 100px)`;
}

// Получение размера сетки
function getGridSize() {
    if (useCustomGrid.checked) {
        return {
            rows: parseInt(customRows.value) || 2,
            cols: parseInt(customCols.value) || 2
        };
    } else {
        const val = parseInt(gridSize.value) || 2;
        return { rows: val, cols: val };
    }
}

// Нарезка изображения
function splitImage() {
    if (!originalImage) return;
    
    const { rows, cols } = getGridSize();
    const pieceWidth = 100;
    const pieceHeight = 100;
    const verticalPadding = 10; // 10px сверху и снизу
    
    // Вычисляем итоговый размер
    const targetWidth = cols * pieceWidth;
    const targetHeight = rows * pieceHeight;
    
    // Создаем временный canvas для масштабирования
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = targetWidth;
    tempCanvas.height = targetHeight;
    
    // Масштабируем изображение под сетку
    tempCtx.drawImage(originalImage, 0, 0, targetWidth, targetHeight);
    
    // Нарезаем на части
    splitImages = [];
    gridPreview.innerHTML = '';
    
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const canvas = document.createElement('canvas');
            canvas.width = pieceWidth;
            canvas.height = pieceHeight;
            const ctx = canvas.getContext('2d');
            
            // Вырезаем часть
            const x = col * pieceWidth;
            const y = row * pieceHeight;
            
            // Создаем еще один canvas для применения отступов
            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = pieceWidth;
            finalCanvas.height = pieceHeight;
            const finalCtx = finalCanvas.getContext('2d');
            
            // Рисуем белый фон (или прозрачный)
            finalCtx.fillStyle = 'white';
            finalCtx.fillRect(0, 0, pieceWidth, pieceHeight);
            
            // Вырезаем часть с отступами 10px сверху и снизу
            finalCtx.drawImage(
                tempCanvas,
                x, y + verticalPadding, pieceWidth, pieceHeight - (verticalPadding * 2),
                0, verticalPadding, pieceWidth, pieceHeight - (verticalPadding * 2)
            );
            
            // Конвертируем в DataURL
            const dataUrl = finalCanvas.toDataURL('image/png');
            splitImages.push({
                dataUrl: dataUrl,
                name: `part_${row}_${col}.png`,
                row: row,
                col: col
            });
            
            // Показываем превью
            const img = document.createElement('img');
            img.src = dataUrl;
            img.alt = `Part ${row}x${col}`;
            gridPreview.appendChild(img);
        }
    }
    
    // Активируем кнопки скачивания
    downloadZipBtn.disabled = false;
    downloadPngBtn.disabled = false;
    
    // Скроллим к превью
    previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Скачивание всех частей в ZIP
async function downloadAllAsZip() {
    if (splitImages.length === 0) return;
    
    const { rows, cols } = getGridSize();
    const zip = new JSZip();
    
    // Добавляем файл README
    zip.file("README.txt", 
        `Image Split Result\n` +
        `Grid: ${rows} × ${cols}\n` +
        `Piece size: 100×100 pixels\n` +
        `Vertical padding: 10px (top & bottom)\n` +
        `Total size: ${cols * 100}×${rows * 100} pixels\n` +
        `\nFiles are named as: part_ROW_COL.png`
    );
    
    // Добавляем изображения
    splitImages.forEach((img) => {
        const base64Data = img.dataUrl.split(',')[1];
        zip.file(img.name, base64Data, {base64: true});
    });
    
    // Генерируем и скачиваем ZIP
    const content = await zip.generateAsync({type: 'blob'});
    saveAs(content, `split_image_${rows}x${cols}.zip`);
}

// Скачивание всех частей как PNG
async function downloadAllAsPng() {
    if (splitImages.length === 0) return;
    
    const { rows, cols } = getGridSize();
    
    // Скачиваем каждое изображение
    for (let i = 0; i < splitImages.length; i++) {
        const img = splitImages[i];
        const link = document.createElement('a');
        link.download = img.name;
        link.href = img.dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Небольшая задержка между скачиваниями
        if (i < splitImages.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    }
}

// Регистрация Service Worker для PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(() => console.log('Service Worker registered'))
            .catch(err => console.error('Service Worker error:', err));
    });
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', init);