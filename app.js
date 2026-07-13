let originalImage = null;
let splitImages = [];

// Элементы DOM
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const controls = document.getElementById('controls');
const preview = document.getElementById('preview');
const originalImg = document.getElementById('originalImg');
const gridPreview = document.getElementById('gridPreview');
const splitBtn = document.getElementById('splitBtn');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const gridSize = document.getElementById('gridSize');
const customRows = document.getElementById('customRows');
const customCols = document.getElementById('customCols');

// Обработчики событий
uploadArea.addEventListener('click', () => fileInput.click());

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

splitBtn.addEventListener('click', splitImage);
downloadAllBtn.addEventListener('click', downloadAllAsZip);

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
            originalImg.src = e.target.result;
            controls.style.display = 'grid';
            preview.classList.remove('active');
            
            // Автоматически выбираем подходящий размер сетки
            autoSelectGridSize();
        };
        originalImage.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// Автоматический выбор размера сетки
function autoSelectGridSize() {
    const aspectRatio = originalImage.width / originalImage.height;
    let suggestedGrid = 2;
    
    if (aspectRatio > 1.5) {
        suggestedGrid = 3;
    } else if (aspectRatio > 2) {
        suggestedGrid = 4;
    }
    
    gridSize.value = suggestedGrid;
    customRows.value = suggestedGrid;
    customCols.value = suggestedGrid;
}

// Нарезка изображения
function splitImage() {
    if (!originalImage) return;

    const useCustom = customRows.value && customCols.value;
    const rows = parseInt(useCustom ? customRows.value : gridSize.value);
    const cols = parseInt(useCustom ? customCols.value : gridSize.value);

    // Фиксированный размер каждой части
    const pieceWidth = 100;
    const pieceHeight = 100;

    // Вычисляем итоговый размер изображения
    const targetWidth = cols * pieceWidth;
    const targetHeight = rows * pieceHeight;

    // Создаем canvas для масштабирования
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
            ctx.drawImage(
                tempCanvas,
                x, y, pieceWidth, pieceHeight,
                0, 0, pieceWidth, pieceHeight
            );

            // Конвертируем в DataURL
            const dataUrl = canvas.toDataURL('image/png');
            splitImages.push({
                dataUrl: dataUrl,
                name: `part_${row}_${col}.png`,
                row: row,
                col: col
            });

            // Показываем превью
            const img = document.createElement('img');
            img.src = dataUrl;
            gridPreview.appendChild(img);
        }
    }

    // Устанавливаем CSS grid для превью
    gridPreview.style.gridTemplateColumns = `repeat(${cols}, 100px)`;
    
    preview.classList.add('active');
    preview.scrollIntoView({ behavior: 'smooth' });
}

// Скачивание всех частей в ZIP
async function downloadAllAsZip() {
    if (splitImages.length === 0) return;

    const zip = new JSZip();
    
    // Добавляем файл README
    const useCustom = customRows.value && customCols.value;
    const rows = parseInt(useCustom ? customRows.value : gridSize.value);
    const cols = parseInt(useCustom ? customCols.value : gridSize.value);
    
    zip.file("README.txt", 
        `Image Split Result\n` +
        `Grid: ${rows} × ${cols}\n` +
        `Piece size: 100×100 pixels\n` +
        `Total size: ${cols * 100}×${rows * 100} pixels\n` +
        `\nFiles are named as: part_ROW_COL.png`
    );

    // Добавляем изображения
    splitImages.forEach((img, index) => {
        const base64Data = img.dataUrl.split(',')[1];
        zip.file(img.name, base64Data, {base64: true});
    });

    // Генерируем и скачиваем ZIP
    const content = await zip.generateAsync({type: 'blob'});
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `split_image_${rows}x${cols}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Регистрация Service Worker для PWA
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
        .then(() => console.log('Service Worker registered'))
        .catch(err => console.error('Service Worker error:', err));
}