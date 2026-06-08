let frames = [];
let selectedFrames = new Set();
let videoFile = null;
let isExtracting = false;

const uploadArea = document.getElementById('uploadArea');
const videoInput = document.getElementById('videoInput');
const videoElement = document.getElementById('videoElement');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// 初始化 FPS 滑块视觉
updateFPS(document.getElementById('fpsInput').value);

// 拖拽上传
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
    if (files.length > 0 && files[0].type.startsWith('video/')) {
        handleFile(files[0]);
    } else {
        showToast('请上传视频文件');
    }
});

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) handleFile(file);
}

function handleFile(file) {
    videoFile = file;
    document.getElementById('extractBtn').disabled = false;

    const url = URL.createObjectURL(file);
    videoElement.src = url;

    videoElement.onloadedmetadata = () => {
        const duration = videoElement.duration;
        const fps = parseInt(document.getElementById('fpsInput').value);
        const maxDuration = parseFloat(document.getElementById('maxDuration').value);
        const estimatedFrames = Math.floor(Math.min(duration, maxDuration) * fps);
        const pages = Math.ceil(estimatedFrames / 8);

        uploadArea.innerHTML = `
            <div class="upload-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <div class="upload-text">${file.name}</div>
            <div class="upload-hint">
                时长: ${duration.toFixed(1)}s | 预计提取: ${estimatedFrames} 帧 | 约 ${pages} 页A4纸
            </div>
        `;
        showToast('视频已加载，点击"开始提取帧"');
    };
}

function updateFPS(value) {
    document.getElementById('fpsValue').textContent = value + ' fps';
    const slider = document.getElementById('fpsInput');
    const min = parseFloat(slider.min) || 1;
    const max = parseFloat(slider.max) || 30;
    const pct = ((value - min) / (max - min)) * 100;
    slider.style.setProperty('--range-pct', pct + '%');
    const badge = document.getElementById('qualityBadge');
    if (value >= 15) {
        badge.textContent = '超高';
        badge.className = 'quality-badge quality-high';
    } else if (value >= 8) {
        badge.textContent = '高质量';
        badge.className = 'quality-badge quality-high';
    } else if (value >= 4) {
        badge.textContent = '标准';
        badge.className = 'quality-badge quality-medium';
    } else {
        badge.textContent = '低';
        badge.className = 'quality-badge quality-low';
    }
}

async function startExtraction() {
    if (isExtracting) return;
    isExtracting = true;

    const fps = parseInt(document.getElementById('fpsInput').value);
    const maxDuration = parseFloat(document.getElementById('maxDuration').value);
    const duration = videoElement.duration;
    const totalFrames = Math.floor(Math.min(duration, maxDuration) * fps);
    const interval = 1 / fps;

    document.getElementById('progressSection').classList.add('active');
    document.getElementById('statTotal').textContent = totalFrames;
    document.getElementById('statTime').textContent = duration.toFixed(1) + 's';
    document.getElementById('statPages').textContent = Math.ceil(totalFrames / 8);

    frames = [];
    selectedFrames.clear();

    // 设置canvas尺寸
    const scale = parseFloat(document.getElementById('frameSize').value);
    canvas.width = videoElement.videoWidth * scale;
    canvas.height = videoElement.videoHeight * scale;

    // 等待视频准备好
    await new Promise(resolve => {
        if (videoElement.readyState >= 2) resolve();
        else videoElement.oncanplay = resolve;
    });

    for (let i = 0; i < totalFrames; i++) {
        const time = i * interval;
        videoElement.currentTime = time;

        await new Promise(resolve => {
            videoElement.onseeked = resolve;
        });

        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        frames.push({
            id: i,
            src: dataUrl,
            time: time,
            selected: true
        });
        selectedFrames.add(i);

        const progress = ((i + 1) / totalFrames) * 100;
        document.getElementById('progressBar').style.width = progress + '%';
        document.getElementById('progressBar').textContent = Math.round(progress) + '%';
        document.getElementById('statCurrent').textContent = i + 1;

        // 每10帧让UI更新一次
        if (i % 10 === 0) {
            await new Promise(r => setTimeout(r, 0));
        }
    }

    isExtracting = false;
    document.getElementById('progressBar').classList.add('complete');
    document.getElementById('progressBar').textContent = '完成';
    showToast(`成功提取 ${frames.length} 帧`);
    showPreview();
}

function showPreview() {
    document.getElementById('previewSection').classList.add('active');
    const grid = document.getElementById('frameGrid');
    grid.innerHTML = '';

    frames.forEach((frame, index) => {
        const div = document.createElement('div');
        div.className = 'frame-item selected';
        div.dataset.index = index;
        div.onclick = () => toggleFrame(index);

        div.innerHTML = `
            <img src="${frame.src}" alt="帧 ${index + 1}">
            <div class="frame-number">#${index + 1}</div>
        `;

        grid.appendChild(div);
    });

    updateSelectedCount();
}

function toggleFrame(index) {
    const items = document.querySelectorAll('.frame-item');
    const item = items[index];

    if (selectedFrames.has(index)) {
        selectedFrames.delete(index);
        item.classList.remove('selected');
    } else {
        selectedFrames.add(index);
        item.classList.add('selected');
    }
    updateSelectedCount();
}

function selectAll() {
    frames.forEach((_, i) => selectedFrames.add(i));
    document.querySelectorAll('.frame-item').forEach(item => item.classList.add('selected'));
    updateSelectedCount();
}

function deselectAll() {
    selectedFrames.clear();
    document.querySelectorAll('.frame-item').forEach(item => item.classList.remove('selected'));
    updateSelectedCount();
}

function deleteSelected() {
    if (selectedFrames.size === 0) {
        showToast('请先选择要删除的帧');
        return;
    }
    document.getElementById('deleteConfirmText').textContent =
        `确定要删除选中的 ${selectedFrames.size} 帧吗？此操作不可撤销。`;
    document.getElementById('deleteConfirmModal').classList.add('active');
}

function confirmDelete() {
    const selectedArray = Array.from(selectedFrames).sort((a, b) => b - a);
    const newFrames = [];

    frames.forEach((frame, i) => {
        if (!selectedFrames.has(i)) {
            newFrames.push(frame);
        }
    });

    frames = newFrames;
    selectedFrames.clear();
    closeDeleteConfirm();
    showPreview();
    showToast(`已删除 ${selectedArray.length} 帧，剩余 ${frames.length} 帧`);
}

function closeDeleteConfirm(event) {
    if (event && event.target !== event.currentTarget) return;
    document.getElementById('deleteConfirmModal').classList.remove('active');
}

function updateSelectedCount() {
    document.getElementById('selectedCount').textContent = `已选择: ${selectedFrames.size} 帧 / 共 ${frames.length} 帧`;
}

function generatePrintPages() {
    if (frames.length === 0) {
        showToast('没有可打印的帧');
        return;
    }

    const container = document.getElementById('printPages');
    container.innerHTML = '';

    const framesPerPage = 8;
    const totalPages = Math.ceil(frames.length / framesPerPage);

    // 每页内按行优先顺序填充（行 0 左→行 0 右→行 1 左→...）
    const colSwap = false;

    for (let page = 0; page < totalPages; page++) {
        const pageDiv = document.createElement('div');
        pageDiv.className = 'a4-sheet';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'a4-content';

        const startIdx = page * framesPerPage;
        const endIdx = Math.min(startIdx + framesPerPage, frames.length);

        // 2x4 网格：行索引 0..3，每行 2 列。
        // 填充顺序：行 0 左→行 0 右→行 1 左→...
        for (let slot = 0; slot < framesPerPage; slot++) {
            const i = startIdx + slot;
            if (i >= endIdx) {
                const frameDiv = document.createElement('div');
                frameDiv.className = 'print-frame empty';
                contentDiv.appendChild(frameDiv);
                continue;
            }

            // 把 slot 映射到 (行, 列)
            let row = Math.floor(slot / 2);
            let col = slot % 2;
            if (colSwap) col = 1 - col;
            const gridIndex = row * 2 + col;

            // 找到当前 contentDiv 中第 gridIndex 个元素
            while (contentDiv.children.length <= gridIndex) {
                const placeholder = document.createElement('div');
                placeholder.className = 'print-frame empty';
                contentDiv.appendChild(placeholder);
            }

            const frameDiv = document.createElement('div');
            frameDiv.className = 'print-frame';

            const img = document.createElement('img');
            img.src = frames[i].src;
            img.alt = `帧 ${i + 1}`;

            frameDiv.appendChild(img);

            // 替换占位符为真实帧
            contentDiv.replaceChild(frameDiv, contentDiv.children[gridIndex]);
        }

        // 兜底：若仍有占位（边界情况），保持 empty
        while (contentDiv.children.length < framesPerPage) {
            const placeholder = document.createElement('div');
            placeholder.className = 'print-frame empty';
            contentDiv.appendChild(placeholder);
        }

        pageDiv.appendChild(contentDiv);

        // 添加页码
        const pageNum = document.createElement('div');
        pageNum.className = 'print-page-number';
        pageNum.textContent = `第 ${page + 1} 页`;
        pageDiv.appendChild(pageNum);

        container.appendChild(pageDiv);
    }

    document.getElementById('printSection').classList.add('active');
    document.getElementById('previewSection').classList.remove('active');
    document.getElementById('controlPanel').style.display = 'none';
    document.getElementById('progressSection').style.display = 'none';

    showToast('打印页面已生成！');

    // 滚动到打印区域
    setTimeout(() => {
        document.getElementById('printSection').scrollIntoView({ behavior: 'smooth' });
    }, 100);
}

function backToEdit() {
    document.getElementById('printSection').classList.remove('active');
    document.getElementById('previewSection').classList.add('active');
    document.getElementById('controlPanel').style.display = 'block';
    document.getElementById('progressSection').classList.add('active');
}

function renderSheetToBlob(sheet, pageIndex) {
    return new Promise((resolve) => {
        const tempCanvas = document.createElement('canvas');
        const ctx = tempCanvas.getContext('2d');
        const scale = 2;
        tempCanvas.width = 794 * scale;
        tempCanvas.height = 1123 * scale;
        ctx.scale(scale, scale);
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 794, 1123);
        const images = sheet.querySelectorAll('.print-frame img');
        const positions = [
            {x: 10, y: 10}, {x: 407, y: 10},
            {x: 10, y: 290}, {x: 407, y: 290},
            {x: 10, y: 570}, {x: 407, y: 570},
            {x: 10, y: 850}, {x: 407, y: 850}
        ];
        let loaded = 0;
        const totalImages = images.length;
        if (totalImages === 0) {
            ctx.font = 'bold 12px sans-serif';
            ctx.fillStyle = '#6b7280';
            ctx.textAlign = 'right';
            ctx.fillText(`第 ${pageIndex + 1} 页`, 784, 1113);
            tempCanvas.toBlob((blob) => resolve(blob), 'image/png');
            return;
        }
        images.forEach((img, i) => {
            if (i < positions.length) {
                const pos = positions[i];
                const imgObj = new Image();
                imgObj.crossOrigin = 'anonymous';
                imgObj.onload = () => {
                    const maxW = 377;
                    const maxH = 270;
                    const ratio = Math.min(maxW / imgObj.width, maxH / imgObj.height);
                    const w = imgObj.width * ratio;
                    const h = imgObj.height * ratio;
                    const x = pos.x + (maxW - w) / 2;
                    const y = pos.y + (maxH - h) / 2;
                    ctx.drawImage(imgObj, x, y, w, h);
                    loaded++;
                    if (loaded === totalImages) {
                        ctx.font = 'bold 12px sans-serif';
                        ctx.fillStyle = '#6b7280';
                        ctx.textAlign = 'right';
                        ctx.fillText(`第 ${pageIndex + 1} 页`, 784, 1113);
                        tempCanvas.toBlob((blob) => resolve(blob), 'image/png');
                    }
                };
                imgObj.onerror = () => {
                    loaded++;
                    if (loaded === totalImages) {
                        ctx.font = 'bold 12px sans-serif';
                        ctx.fillStyle = '#6b7280';
                        ctx.textAlign = 'right';
                        ctx.fillText(`第 ${pageIndex + 1} 页`, 784, 1113);
                        tempCanvas.toBlob((blob) => resolve(blob), 'image/png');
                    }
                };
                imgObj.src = img.src;
            }
        });
    });
}

async function downloadFramesZIP() {
    if (frames.length === 0) {
        showToast('没有可下载的帧');
        return;
    }
    showToast('正在打包帧ZIP...');
    const zip = new JSZip();
    const folder = zip.folder('视频拆图VidPic-帧');
    const promises = frames.map((frame, index) => {
        return fetch(frame)
            .then(res => res.blob())
            .then(blob => {
                folder.file(`帧${index + 1}.png`, blob);
            });
    });
    await Promise.all(promises);
    const content = await zip.generateAsync({type: 'blob'});
    saveAs(content, '视频拆图VidPic-帧.zip');
    showToast('帧ZIP下载完成！');
}

async function downloadFramesBatch() {
    if (frames.length === 0) {
        showToast('没有可下载的帧');
        return;
    }
    showToast('正在批量下载帧...');
    for (let i = 0; i < frames.length; i++) {
        saveAs(frames[i], `帧${i + 1}.png`);
        if (i < frames.length - 1) {
            await new Promise(r => setTimeout(r, 400));
        }
    }
    showToast('批量下载帧完成！');
}

async function downloadPDF() {
    showToast('正在打包ZIP...');
    const zip = new JSZip();
    const folder = zip.folder('视频拆图VidPic');
    const sheets = document.querySelectorAll('.a4-sheet');
    const promises = Array.from(sheets).map((sheet, index) => {
        return renderSheetToBlob(sheet, index).then(blob => {
            folder.file(`第${index + 1}页.png`, blob);
        });
    });
    await Promise.all(promises);
    const content = await zip.generateAsync({type: 'blob'});
    saveAs(content, '视频拆图VidPic.zip');
    showToast('ZIP下载完成！');
}

async function downloadPages() {
    showToast('正在批量下载图片...');
    const sheets = document.querySelectorAll('.a4-sheet');
    for (let i = 0; i < sheets.length; i++) {
        const blob = await renderSheetToBlob(sheets[i], i);
        saveAs(blob, `第${i + 1}页.png`);
        if (i < sheets.length - 1) {
            await new Promise(r => setTimeout(r, 400));
        }
    }
    showToast('批量下载完成！');
}

function resetAll() {
    if (isExtracting) {
        showToast('正在提取中，请等待...');
        return;
    }
    location.reload();
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// 键盘快捷键
document.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (document.getElementById('previewSection').classList.contains('active')) {
            deleteSelected();
        }
    }
});

function showTipModal() {
    document.getElementById('tipModal').classList.add('active');
}

function closeTipModal(event) {
    if (event && event.target !== event.currentTarget) return;
    document.getElementById('tipModal').classList.remove('active');
}

// ===== 深浅模式切换 =====
function toggleTheme() {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('vidpic-theme', next);
}

// 初始化主题
(function initTheme() {
    const saved = localStorage.getItem('vidpic-theme');
    if (saved) {
        document.documentElement.setAttribute('data-theme', saved);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
})();