// ==================== WebGL 渲染器 ====================
class WebGLRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl', {
            alpha: false,
            antialias: false,
            preserveDrawingBuffer: true
        }) || canvas.getContext('experimental-webgl');

        if (!this.gl) {
            throw new Error('WebGL not supported');
        }

        this.programs = {};
        this.buffers = {};
        this.textures = {};
        this.init();
    }

    init() {
        const gl = this.gl;

        // 图片着色器
        this.programs.image = this.createProgram(
            `attribute vec2 a_position;
             attribute vec2 a_texCoord;
             varying vec2 v_texCoord;
             void main() {
                 gl_Position = vec4(a_position, 0.0, 1.0);
                 v_texCoord = a_texCoord;
             }`,
            `precision mediump float;
             uniform sampler2D u_image;
             varying vec2 v_texCoord;
             void main() {
                 gl_FragColor = texture2D(u_image, v_texCoord);
             }`
        );

        // 线条着色器
        this.programs.line = this.createProgram(
            `attribute vec2 a_position;
             uniform vec2 u_resolution;
             void main() {
                 vec2 clipSpace = (a_position / u_resolution) * 2.0 - 1.0;
                 gl_Position = vec4(clipSpace * vec2(1, -1), 0.0, 1.0);
             }`,
            `precision mediump float;
             uniform vec4 u_color;
             void main() {
                 gl_FragColor = u_color;
             }`
        );

        // 矩形填充着色器
        this.programs.rect = this.programs.line;

        // 创建缓冲区
        this.buffers.quad = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.quad);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -1, -1, 0, 1,
             1, -1, 1, 1,
            -1,  1, 0, 0,
             1,  1, 1, 0
        ]), gl.STATIC_DRAW);

        this.buffers.lines = gl.createBuffer();
    }

    createProgram(vertexSrc, fragmentSrc) {
        const gl = this.gl;

        const vs = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vs, vertexSrc);
        gl.compileShader(vs);

        const fs = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fs, fragmentSrc);
        gl.compileShader(fs);

        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);

        return program;
    }

    setImage(image) {
        const gl = this.gl;

        if (this.textures.image) {
            gl.deleteTexture(this.textures.image);
        }

        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

        this.textures.image = texture;
    }

    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.gl.viewport(0, 0, width, height);
    }

    clear() {
        const gl = this.gl;
        gl.clearColor(0.95, 0.95, 0.95, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
    }

    drawImage() {
        const gl = this.gl;
        const program = this.programs.image;

        gl.useProgram(program);

        const posLoc = gl.getAttribLocation(program, 'a_position');
        const texLoc = gl.getAttribLocation(program, 'a_texCoord');

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.quad);
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);
        gl.enableVertexAttribArray(texLoc);
        gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 16, 8);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.textures.image);
        gl.uniform1i(gl.getUniformLocation(program, 'u_image'), 0);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    drawRect(x, y, w, h, color, filled = true) {
        const gl = this.gl;
        const program = this.programs.rect;

        gl.useProgram(program);

        const resLoc = gl.getUniformLocation(program, 'u_resolution');
        const colorLoc = gl.getUniformLocation(program, 'u_color');
        const posLoc = gl.getAttribLocation(program, 'a_position');

        gl.uniform2f(resLoc, this.canvas.width, this.canvas.height);
        gl.uniform4f(colorLoc, color[0], color[1], color[2], color[3]);

        let vertices;
        if (filled) {
            vertices = new Float32Array([
                x, y,
                x + w, y,
                x, y + h,
                x + w, y + h
            ]);
        } else {
            vertices = new Float32Array([
                x, y, x + w, y,
                x + w, y, x + w, y + h,
                x + w, y + h, x, y + h,
                x, y + h, x, y
            ]);
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.lines);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        if (filled) {
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        } else {
            gl.drawArrays(gl.LINES, 0, 8);
        }
    }

    drawLine(x1, y1, x2, y2, color, lineWidth = 1) {
        const gl = this.gl;
        const program = this.programs.line;

        gl.useProgram(program);
        gl.lineWidth(lineWidth);

        const resLoc = gl.getUniformLocation(program, 'u_resolution');
        const colorLoc = gl.getUniformLocation(program, 'u_color');
        const posLoc = gl.getAttribLocation(program, 'a_position');

        gl.uniform2f(resLoc, this.canvas.width, this.canvas.height);
        gl.uniform4f(colorLoc, color[0], color[1], color[2], color[3]);

        const vertices = new Float32Array([x1, y1, x2, y2]);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.lines);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        gl.drawArrays(gl.LINES, 0, 2);
    }

    drawCircle(cx, cy, radius, color, filled = true) {
        const gl = this.gl;
        const program = this.programs.line;

        gl.useProgram(program);

        const resLoc = gl.getUniformLocation(program, 'u_resolution');
        const colorLoc = gl.getUniformLocation(program, 'u_color');
        const posLoc = gl.getAttribLocation(program, 'a_position');

        gl.uniform2f(resLoc, this.canvas.width, this.canvas.height);
        gl.uniform4f(colorLoc, color[0], color[1], color[2], color[3]);

        const segments = 32;
        const vertices = [];

        if (filled) {
            vertices.push(cx, cy);
            for (let i = 0; i <= segments; i++) {
                const angle = (i / segments) * Math.PI * 2;
                vertices.push(cx + Math.cos(angle) * radius);
                vertices.push(cy + Math.sin(angle) * radius);
            }
        } else {
            for (let i = 0; i <= segments; i++) {
                const angle = (i / segments) * Math.PI * 2;
                vertices.push(cx + Math.cos(angle) * radius);
                vertices.push(cy + Math.sin(angle) * radius);
            }
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.lines);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        if (filled) {
            gl.drawArrays(gl.TRIANGLE_FAN, 0, segments + 2);
        } else {
            gl.drawArrays(gl.LINE_STRIP, 0, segments + 1);
        }
    }

    hexToGL(hex) {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        return [r, g, b, 1.0];
    }
}

// ==================== 全局状态 ====================
const state = {
    originalImage: null,
    processedImage: null,  // 处理后的图片（抠背景后）
    imageCache: null,
    rows: 6,
    cols: 4,
    gridColor: '#ff0000',
    lineWidth: 2,
    mode: 'uniform',

    centerLinesX: [],
    centerLinesY: [],
    cellWidth: 100,
    cellHeight: 100,

    // 图片在原图上的缩放比例（用于网格计算）
    scale: 1,
    canvasWidth: 0,
    canvasHeight: 0,

    // 视图变换
    view: {
        zoom: 1,
        offsetX: 0,
        offsetY: 0
    },

    // 画布拖拽
    isPanning: false,
    panStart: { x: 0, y: 0 },
    viewStart: { x: 0, y: 0 },

    // 颜色拾取模式
    isPickingColor: false,

    // 单独调整模式
    individualMode: false,
    individualAreas: {},  // 存储每个单元格的独立边界 { index: { x, y, width, height } }
    editingCell: null,    // 当前正在编辑的单元格
    resizeHandle: null,   // 当前拖动的调整手柄
    dragStartArea: null,  // 拖动开始时的区域
    hoveredCell: null,    // 当前悬停的单元格
    hoveredHandle: null,  // 当前悬停的手柄

    dragging: null,
    hovered: null,

    disabledCells: new Set(),
    croppedImages: [],
    customAreas: {},
    customNames: {},  // 自定义图片名称

    // 历史记录
    history: [],
    historyIndex: -1,
    maxHistory: 50
};

let renderer = null;
let previewScale = 0.25; // 预览图使用 1/4 尺寸

// ==================== DOM 元素 ====================
const elements = {};

// ==================== 本地存储 ====================
const STORAGE_KEY = 'emoji-cutter-settings';

function saveSettings() {
    const settings = {
        rows: state.rows,
        cols: state.cols,
        gridColor: state.gridColor,
        lineWidth: state.lineWidth,
        mode: state.mode,
        cellWidth: state.cellWidth,
        cellHeight: state.cellHeight
    };
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {}
}

function loadSettings() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const s = JSON.parse(saved);
            state.rows = s.rows || 6;
            state.cols = s.cols || 4;
            state.gridColor = s.gridColor || '#ff0000';
            state.lineWidth = s.lineWidth || 2;
            state.mode = s.mode || 'uniform';
            state.cellWidth = s.cellWidth || 100;
            state.cellHeight = s.cellHeight || 100;
            return true;
        }
    } catch (e) {}
    return false;
}

// ==================== 历史记录管理 ====================
function captureHistoryState() {
    return {
        disabledCells: new Set(state.disabledCells),
        customAreas: JSON.parse(JSON.stringify(state.customAreas)),
        customNames: JSON.parse(JSON.stringify(state.customNames)),
        centerLinesX: [...state.centerLinesX],
        centerLinesY: [...state.centerLinesY],
        cellWidth: state.cellWidth,
        cellHeight: state.cellHeight,
        processedImage: state.processedImage,
        imageCache: state.imageCache
    };
}

function restoreHistoryState(snapshot) {
    state.disabledCells = new Set(snapshot.disabledCells);
    state.customAreas = JSON.parse(JSON.stringify(snapshot.customAreas));
    state.customNames = JSON.parse(JSON.stringify(snapshot.customNames));
    state.centerLinesX = [...snapshot.centerLinesX];
    state.centerLinesY = [...snapshot.centerLinesY];
    state.cellWidth = snapshot.cellWidth;
    state.cellHeight = snapshot.cellHeight;
    state.processedImage = snapshot.processedImage;
    state.imageCache = snapshot.imageCache;

    // 更新渲染器纹理
    if (renderer) {
        renderer.setImage(state.imageCache || state.originalImage);
    }
}

function saveHistory() {
    // 删除当前索引之后的所有历史
    if (state.historyIndex < state.history.length - 1) {
        state.history = state.history.slice(0, state.historyIndex + 1);
    }

    // 添加新的历史状态
    const snapshot = captureHistoryState();
    state.history.push(snapshot);

    // 限制历史记录数量
    if (state.history.length > state.maxHistory) {
        state.history.shift();
    } else {
        state.historyIndex++;
    }

    updateHistoryUI();
}

function undo() {
    if (state.historyIndex > 0) {
        state.historyIndex--;
        restoreHistoryState(state.history[state.historyIndex]);
        scheduleRender();
        schedulePreviewUpdate();
        updateHistoryUI();
    }
}

function redo() {
    if (state.historyIndex < state.history.length - 1) {
        state.historyIndex++;
        restoreHistoryState(state.history[state.historyIndex]);
        scheduleRender();
        schedulePreviewUpdate();
        updateHistoryUI();
    }
}

function updateHistoryUI() {
    const undoBtn = document.getElementById('historyUndo');
    const redoBtn = document.getElementById('historyRedo');
    const historyInfo = document.getElementById('historyInfo');

    undoBtn.disabled = state.historyIndex <= 0;
    redoBtn.disabled = state.historyIndex >= state.history.length - 1;

    historyInfo.textContent = `${state.historyIndex}/${state.history.length - 1}`;
}

function clearHistory() {
    state.history = [];
    state.historyIndex = -1;
    updateHistoryUI();
}

function applySettingsToUI() {
    document.getElementById('rowsRange').value = Math.min(state.rows, 12);
    document.getElementById('rowsInput').value = state.rows;
    document.getElementById('colsRange').value = Math.min(state.cols, 12);
    document.getElementById('colsInput').value = state.cols;
    document.getElementById('gridColor').value = state.gridColor;
    document.getElementById('colorValue').textContent = state.gridColor;
    document.getElementById('lineWidth').value = state.lineWidth;
    document.getElementById('lineWidthValue').textContent = state.lineWidth + 'px';
    document.getElementById('cellWidth').value = state.cellWidth;
    document.getElementById('cellHeight').value = state.cellHeight;

    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === state.mode);
    });

    document.querySelectorAll('.quick-grid-btn').forEach(btn => {
        const r = parseInt(btn.dataset.rows);
        const c = parseInt(btn.dataset.cols);
        btn.classList.toggle('active', r === state.rows && c === state.cols);
    });

    updateModeUI();
}

// ==================== 初始化 ====================
function init() {
    elements.uploadArea = document.getElementById('uploadArea');
    elements.fileInput = document.getElementById('fileInput');
    elements.mainCanvas = document.getElementById('mainCanvas');
    elements.canvasContainer = document.getElementById('canvasContainer');
    elements.placeholder = document.getElementById('placeholder');
    elements.imageInfo = document.getElementById('imageInfo');
    elements.previewGrid = document.getElementById('previewGrid');
    elements.exportBtn = document.getElementById('exportBtn');
    elements.exportSingleBtn = document.getElementById('exportSingleBtn');
    elements.progressOverlay = document.getElementById('progressOverlay');
    elements.progressText = document.getElementById('progressText');
    elements.modeHint = document.getElementById('modeHint');
    elements.editHint = document.getElementById('editHint');
    elements.cellSizeControl = document.getElementById('cellSizeControl');

    // 初始化 WebGL 渲染器
    try {
        renderer = new WebGLRenderer(elements.mainCanvas);
    } catch (e) {
        console.error('WebGL init failed:', e);
        alert('您的浏览器不支持 WebGL，请使用现代浏览器');
        return;
    }

    loadSettings();
    applySettingsToUI();
    setupEventListeners();
    setupMobileTabs();
}

// ==================== 渲染 ====================
let renderPending = false;

function scheduleRender() {
    if (!renderPending) {
        renderPending = true;
        requestAnimationFrame(() => {
            renderPending = false;
            performRender();
        });
    }
}

function performRender() {
    if (!renderer) return;

    const canvas = elements.mainCanvas;
    const containerWidth = elements.canvasContainer.clientWidth;
    const containerHeight = elements.canvasContainer.clientHeight;

    // 调整 canvas 大小以填满容器
    if (canvas.width !== containerWidth || canvas.height !== containerHeight) {
        renderer.resize(containerWidth, containerHeight);
    }

    const gl = renderer.gl;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // 绘制棋盘格背景
    drawCheckerboard(containerWidth, containerHeight);

    if (!state.originalImage) return;

    // 计算图片在画布上的位置和大小
    const imgW = state.originalImage.width * state.view.zoom;
    const imgH = state.originalImage.height * state.view.zoom;

    // 绘制图片阴影
    const shadowOffset = 4;
    const imgX = state.view.offsetX;
    const imgY = state.view.offsetY;
    renderer.drawRect(imgX + shadowOffset, imgY + shadowOffset, imgW, imgH, [0, 0, 0, 0.3], true);

    // 绘制图片
    drawImageAtPosition(imgX, imgY, imgW, imgH);

    // 绘制网格
    if (state.mode === 'uniform') {
        drawUniformGridGL(imgX, imgY, imgW, imgH);
    } else {
        drawCenterLineModeGL(imgX, imgY, imgW, imgH);
    }
}

function drawCheckerboard(w, h) {
    const size = 10;
    const isDark = !document.documentElement.getAttribute('data-theme');
    const color1 = isDark ? [0.165, 0.165, 0.165, 1] : [0.75, 0.75, 0.75, 1];
    const color2 = isDark ? [0.145, 0.145, 0.145, 1] : [0.85, 0.85, 0.85, 1];

    // 用纯色填充背景
    renderer.gl.clearColor(color2[0], color2[1], color2[2], 1.0);
    renderer.gl.clear(renderer.gl.COLOR_BUFFER_BIT);

    // 绘制棋盘格
    for (let y = 0; y < h; y += size * 2) {
        for (let x = 0; x < w; x += size * 2) {
            renderer.drawRect(x, y, size, size, color1, true);
            renderer.drawRect(x + size, y + size, size, size, color1, true);
        }
    }
}

function drawImageAtPosition(x, y, w, h) {
    const gl = renderer.gl;
    const program = renderer.programs.image;

    gl.useProgram(program);

    // 转换到裁剪空间
    const canvas = renderer.canvas;
    const x1 = (x / canvas.width) * 2 - 1;
    const y1 = 1 - (y / canvas.height) * 2;
    const x2 = ((x + w) / canvas.width) * 2 - 1;
    const y2 = 1 - ((y + h) / canvas.height) * 2;

    const posLoc = gl.getAttribLocation(program, 'a_position');
    const texLoc = gl.getAttribLocation(program, 'a_texCoord');

    const vertices = new Float32Array([
        x1, y2, 0, 1,
        x2, y2, 1, 1,
        x1, y1, 0, 0,
        x2, y1, 1, 0
    ]);

    gl.bindBuffer(gl.ARRAY_BUFFER, renderer.buffers.quad);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(texLoc);
    gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 16, 8);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, renderer.textures.image);
    gl.uniform1i(gl.getUniformLocation(program, 'u_image'), 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function drawUniformGridGL(imgX, imgY, imgW, imgH) {
    const cellW = imgW / state.cols;
    const cellH = imgH / state.rows;
    const color = renderer.hexToGL(state.gridColor);

    // 绘制所有单元格
    for (let row = 0; row < state.rows; row++) {
        for (let col = 0; col < state.cols; col++) {
            const idx = row * state.cols + col;
            const isDisabled = state.disabledCells.has(idx);
            const hasCustom = state.customAreas && state.customAreas[idx];

            const x = imgX + col * cellW;
            const y = imgY + row * cellH;

            if (isDisabled) {
                // 禁用遮罩
                renderer.drawRect(x, y, cellW, cellH, [0, 0, 0, 0.5], true);
                // X 标记
                renderer.drawLine(x + 10, y + 10, x + cellW - 10, y + cellH - 10, [1, 0.3, 0.3, 1]);
                renderer.drawLine(x + cellW - 10, y + 10, x + 10, y + cellH - 10, [1, 0.3, 0.3, 1]);
            } else if (hasCustom) {
                const custom = state.customAreas[idx];
                const cx = imgX + custom.x * state.view.zoom;
                const cy = imgY + custom.y * state.view.zoom;
                const cw = custom.width * state.view.zoom;
                const ch = custom.height * state.view.zoom;

                renderer.drawRect(x, y, cellW, cellH, [0.5, 0.5, 0.5, 0.2], true);
                renderer.drawRect(cx, cy, cw, ch, [0.3, 0.8, 0.4, 0.25], true);
                renderer.drawRect(cx, cy, cw, ch, [0.3, 0.8, 0.4, 1], false);
            }
        }
    }

    // 网格线
    for (let i = 1; i < state.cols; i++) {
        const x = imgX + i * cellW;
        renderer.drawLine(x, imgY, x, imgY + imgH, color);
    }
    for (let i = 1; i < state.rows; i++) {
        const y = imgY + i * cellH;
        renderer.drawLine(imgX, y, imgX + imgW, y, color);
    }

    // 边框
    renderer.drawRect(imgX, imgY, imgW, imgH, color, false);
}

function drawCenterLineModeGL(imgX, imgY, imgW, imgH) {
    const zoom = state.view.zoom;
    const halfW = state.cellWidth / 2 * zoom;
    const halfH = state.cellHeight / 2 * zoom;
    const color = renderer.hexToGL(state.gridColor);
    const hoverColor = [1, 1, 0, 1];
    const customColor = [0.3, 0.8, 0.4, 1];
    const editingColor = [0.3, 0.6, 1, 1];

    // 单独调整模式
    if (state.individualMode) {
        drawIndividualModeGL(imgX, imgY, imgW, imgH);
        return;
    }

    // 裁剪区域框
    let index = 0;
    for (const cy of state.centerLinesY) {
        for (const cx of state.centerLinesX) {
            const displayX = imgX + cx * zoom;
            const displayY = imgY + cy * zoom;
            const left = displayX - halfW;
            const top = displayY - halfH;
            const rectW = state.cellWidth * zoom;
            const rectH = state.cellHeight * zoom;

            const isDisabled = state.disabledCells.has(index);
            const hasCustom = state.customAreas && state.customAreas[index];

            if (isDisabled) {
                renderer.drawRect(left, top, rectW, rectH, [0, 0, 0, 0.5], true);
                renderer.drawLine(left + 10, top + 10, left + rectW - 10, top + rectH - 10, [1, 0.3, 0.3, 1]);
                renderer.drawLine(left + rectW - 10, top + 10, left + 10, top + rectH - 10, [1, 0.3, 0.3, 1]);
                renderer.drawRect(left, top, rectW, rectH, [1, 0.3, 0.3, 0.8], false);
            } else if (hasCustom) {
                const custom = state.customAreas[index];
                const customLeft = imgX + custom.x * zoom;
                const customTop = imgY + custom.y * zoom;
                const customW = custom.width * zoom;
                const customH = custom.height * zoom;

                renderer.drawRect(left, top, rectW, rectH, [0.5, 0.5, 0.5, 0.15], true);
                renderer.drawRect(left, top, rectW, rectH, [1, 1, 1, 0.3], false);
                renderer.drawRect(customLeft, customTop, customW, customH, [0.3, 0.8, 0.4, 0.25], true);
                renderer.drawRect(customLeft, customTop, customW, customH, customColor, false);
            } else {
                renderer.drawRect(left, top, rectW, rectH, [0.4, 0.5, 0.9, 0.15], true);
                renderer.drawRect(left, top, rectW, rectH, [1, 1, 1, 0.8], false);
            }

            index++;
        }
    }

    // 垂直中心线
    for (let i = 0; i < state.centerLinesX.length; i++) {
        const x = imgX + state.centerLinesX[i] * zoom;
        const isActive = (state.hovered?.type === 'x' && state.hovered?.index === i) ||
                        (state.dragging?.type === 'x' && state.dragging?.index === i);

        renderer.drawLine(x, imgY, x, imgY + imgH, isActive ? hoverColor : color);

        const radius = isActive ? 10 : 8;
        renderer.drawCircle(x, imgY + imgH / 2, radius, [1, 1, 1, 1], true);
        renderer.drawCircle(x, imgY + imgH / 2, radius, isActive ? hoverColor : color, false);
    }

    // 水平中心线
    for (let i = 0; i < state.centerLinesY.length; i++) {
        const y = imgY + state.centerLinesY[i] * zoom;
        const isActive = (state.hovered?.type === 'y' && state.hovered?.index === i) ||
                        (state.dragging?.type === 'y' && state.dragging?.index === i);

        renderer.drawLine(imgX, y, imgX + imgW, y, isActive ? hoverColor : color);

        const radius = isActive ? 10 : 8;
        renderer.drawCircle(imgX + imgW / 2, y, radius, [1, 1, 1, 1], true);
        renderer.drawCircle(imgX + imgW / 2, y, radius, isActive ? hoverColor : color, false);
    }
}

// 单独调整模式绘制
function drawIndividualModeGL(imgX, imgY, imgW, imgH) {
    const zoom = state.view.zoom;
    const halfW = state.cellWidth / 2;
    const halfH = state.cellHeight / 2;
    const normalColor = [0.6, 0.6, 0.6, 1];
    const hoverColor = [1, 1, 0, 1];
    const editingColor = [0.3, 0.6, 1, 1];
    const customColor = [0.3, 0.8, 0.4, 1];
    const handleSize = 6;

    let index = 0;
    for (const cy of state.centerLinesY) {
        for (const cx of state.centerLinesX) {
            const isDisabled = state.disabledCells.has(index);
            const hasCustom = state.customAreas && state.customAreas[index];
            const isEditing = state.editingCell === index;
            const isHovered = state.hoveredCell === index;

            let area;
            if (hasCustom) {
                area = state.customAreas[index];
            } else {
                area = {
                    x: cx - halfW,
                    y: cy - halfH,
                    width: state.cellWidth,
                    height: state.cellHeight
                };
                // 边界约束
                area.x = Math.max(0, Math.min(state.originalImage.width - area.width, area.x));
                area.y = Math.max(0, Math.min(state.originalImage.height - area.height, area.y));
            }

            const left = imgX + area.x * zoom;
            const top = imgY + area.y * zoom;
            const rectW = area.width * zoom;
            const rectH = area.height * zoom;

            if (isDisabled) {
                renderer.drawRect(left, top, rectW, rectH, [0, 0, 0, 0.5], true);
                renderer.drawLine(left + 10, top + 10, left + rectW - 10, top + rectH - 10, [1, 0.3, 0.3, 1]);
                renderer.drawLine(left + rectW - 10, top + 10, left + 10, top + rectH - 10, [1, 0.3, 0.3, 1]);
                renderer.drawRect(left, top, rectW, rectH, [1, 0.3, 0.3, 0.8], false);
            } else {
                // 填充背景
                const bgColor = isEditing ? [0.3, 0.6, 1, 0.15] :
                               hasCustom ? [0.3, 0.8, 0.4, 0.15] :
                               isHovered ? [1, 1, 0, 0.1] : [0.5, 0.5, 0.5, 0.1];
                renderer.drawRect(left, top, rectW, rectH, bgColor, true);

                // 边框
                const borderColor = isEditing ? editingColor :
                                   hasCustom ? customColor :
                                   isHovered ? hoverColor : normalColor;
                renderer.drawRect(left, top, rectW, rectH, borderColor, false);

                // 绘制调整手柄（仅在悬停或编辑时）
                if (isEditing || isHovered) {
                    const handles = getResizeHandles(left, top, rectW, rectH, handleSize * zoom);
                    for (const h of handles) {
                        const isActiveHandle = state.resizeHandle === h.name && state.editingCell === index;
                        const handleColor = isActiveHandle ? [1, 1, 1, 1] : borderColor;
                        renderer.drawRect(h.x - h.size/2, h.y - h.size/2, h.size, h.size, handleColor, true);
                    }
                }
            }

            index++;
        }
    }
}

// 获取调整手柄位置
function getResizeHandles(x, y, w, h, size) {
    return [
        { name: 'nw', x: x, y: y, size },
        { name: 'n', x: x + w/2, y: y, size },
        { name: 'ne', x: x + w, y: y, size },
        { name: 'w', x: x, y: y + h/2, size },
        { name: 'e', x: x + w, y: y + h/2, size },
        { name: 'sw', x: x, y: y + h, size },
        { name: 's', x: x + w/2, y: y + h, size },
        { name: 'se', x: x + w, y: y + h, size }
    ];
}

// ==================== 事件监听 ====================
function setupEventListeners() {
    elements.uploadArea.addEventListener('click', () => elements.fileInput.click());
    elements.fileInput.addEventListener('change', handleFileSelect);

    elements.uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.uploadArea.classList.add('dragover');
    });
    elements.uploadArea.addEventListener('dragleave', () => {
        elements.uploadArea.classList.remove('dragover');
    });
    elements.uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.uploadArea.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.mode = btn.dataset.mode;
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // 切换模式时重置单独调整模式
            state.individualMode = false;
            document.getElementById('individualModeCheckbox').checked = false;

            updateModeUI();
            saveSettings();
            if (state.originalImage) {
                initializeCenterLines();
                scheduleRender();
                schedulePreviewUpdate();
            }
        });
    });

    // 单独调整模式切换
    document.getElementById('individualModeCheckbox').addEventListener('change', (e) => {
        state.individualMode = e.target.checked;
        state.editingCell = null;
        state.resizeHandle = null;
        updateModeUI();
        scheduleRender();
    });

    setupGridControls();
    setupCanvasEvents();

    document.getElementById('gridColor').addEventListener('input', (e) => {
        state.gridColor = e.target.value;
        document.getElementById('colorValue').textContent = state.gridColor;
        scheduleRender();
        saveSettings();
    });

    document.getElementById('lineWidth').addEventListener('input', (e) => {
        state.lineWidth = parseInt(e.target.value);
        document.getElementById('lineWidthValue').textContent = state.lineWidth + 'px';
        scheduleRender();
        saveSettings();
    });

    document.getElementById('cellWidth').addEventListener('change', (e) => {
        state.cellWidth = Math.max(10, parseInt(e.target.value) || 100);
        e.target.value = state.cellWidth;
        scheduleRender();
        schedulePreviewUpdate();
        saveSettings();
        saveHistory();
    });

    document.getElementById('cellHeight').addEventListener('change', (e) => {
        state.cellHeight = Math.max(10, parseInt(e.target.value) || 100);
        e.target.value = state.cellHeight;
        scheduleRender();
        schedulePreviewUpdate();
        saveSettings();
        saveHistory();
    });

    document.getElementById('autoCalcSize').addEventListener('click', () => {
        autoCalculateCellSize();
        scheduleRender();
        schedulePreviewUpdate();
        saveHistory();
    });

    document.getElementById('resetLines').addEventListener('click', () => {
        initializeCenterLines();
        state.disabledCells.clear();
        scheduleRender();
        schedulePreviewUpdate();
        saveHistory();
    });

    document.getElementById('quality').addEventListener('input', (e) => {
        document.getElementById('qualityValue').textContent = Math.round(e.target.value * 100) + '%';
    });

    elements.exportBtn.addEventListener('click', exportAsZip);
    elements.exportSingleBtn.addEventListener('click', exportSeparately);

    // 历史记录按钮
    document.getElementById('historyUndo').addEventListener('click', undo);
    document.getElementById('historyRedo').addEventListener('click', redo);

    // 快捷键
    document.addEventListener('keydown', (e) => {
        // Ctrl+Z 撤销
        if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            undo();
        }
        // Ctrl+Y 重做
        else if (e.ctrlKey && e.key === 'y') {
            e.preventDefault();
            redo();
        }
        // Ctrl+Shift+Z 重做（备选）
        else if (e.ctrlKey && e.shiftKey && e.key === 'Z') {
            e.preventDefault();
            redo();
        }
    });

    // 主题切换
    setupThemeToggle();

    // 折叠面板
    setupCollapsiblePanels();

    // 大图预览弹窗
    setupImagePreviewModal();

    // 缩放控制
    setupZoomControls();

    // 抠背景功能
    setupBackgroundRemoval();

    // 窗口大小改变时重新渲染
    window.addEventListener('resize', () => {
        scheduleRender();
    });

    // 初始渲染（显示棋盘格背景）
    scheduleRender();
}

function setupGridControls() {
    const rowsRange = document.getElementById('rowsRange');
    const rowsInput = document.getElementById('rowsInput');
    const colsRange = document.getElementById('colsRange');
    const colsInput = document.getElementById('colsInput');

    rowsRange.addEventListener('input', (e) => {
        state.rows = parseInt(e.target.value);
        rowsInput.value = state.rows;
        onGridSettingsChange();
    });
    rowsInput.addEventListener('change', (e) => {
        state.rows = Math.max(1, Math.min(20, parseInt(e.target.value) || 1));
        rowsInput.value = state.rows;
        rowsRange.value = Math.min(state.rows, 12);
        onGridSettingsChange();
    });

    colsRange.addEventListener('input', (e) => {
        state.cols = parseInt(e.target.value);
        colsInput.value = state.cols;
        onGridSettingsChange();
    });
    colsInput.addEventListener('change', (e) => {
        state.cols = Math.max(1, Math.min(20, parseInt(e.target.value) || 1));
        colsInput.value = state.cols;
        colsRange.value = Math.min(state.cols, 12);
        onGridSettingsChange();
    });

    document.querySelectorAll('.quick-grid-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.rows = parseInt(btn.dataset.rows);
            state.cols = parseInt(btn.dataset.cols);
            document.getElementById('rowsRange').value = Math.min(state.rows, 12);
            document.getElementById('rowsInput').value = state.rows;
            document.getElementById('colsRange').value = Math.min(state.cols, 12);
            document.getElementById('colsInput').value = state.cols;

            document.querySelectorAll('.quick-grid-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            onGridSettingsChange();
        });
    });
}

function setupCanvasEvents() {
    let lastMoveTime = 0;
    const THROTTLE = 16;

    // 统一坐标获取函数（支持鼠标和触摸）
    function getEventCoords(e) {
        if (e.touches && e.touches.length > 0) {
            const rect = elements.mainCanvas.getBoundingClientRect();
            return {
                x: e.touches[0].clientX - rect.left,
                y: e.touches[0].clientY - rect.top
            };
        }
        return getCanvasCoords(e);
    }

    // 鼠标/触摸按下事件
    function handlePointerDown(e) {
        if (!state.originalImage) return;

        const coords = getEventCoords(e);

        // 拾色模式
        if (state.isPickingColor) {
            if (e.type === 'touchstart') e.preventDefault();
            pickColorFromImage(coords.x, coords.y);
            e.preventDefault();
            return;
        }

        // 单独调整模式
        if (state.mode === 'centerline' && state.individualMode) {
            const result = findCellHandleAtPosition(coords.x, coords.y);
            if (result) {
                if (e.type === 'touchstart') e.preventDefault();
                state.editingCell = result.cellIndex;
                state.resizeHandle = result.handle;
                state.dragStartArea = getCellArea(result.cellIndex);
                state.lastDragPos = canvasToImageCoords(coords.x, coords.y);
                e.preventDefault();
                e.stopPropagation();
                return;
            }
        }

        if (state.mode === 'centerline' && !state.individualMode) {
            const line = findLineAtPosition(coords.x, coords.y);
            if (line) {
                if (e.type === 'touchstart') e.preventDefault();
                state.dragging = line;
                elements.mainCanvas.style.cursor = line.type === 'x' ? 'ew-resize' : 'ns-resize';
                e.preventDefault();
                e.stopPropagation();
                return;
            }
        }
    }

    elements.mainCanvas.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; // 只处理左键
        handlePointerDown(e);
    });

    // 触摸事件只在需要时阻止默认行为
    elements.mainCanvas.addEventListener('touchstart', (e) => {
        // 只在画布上有图片时才处理触摸
        if (state.originalImage) {
            e.preventDefault();
        }
        handlePointerDown(e);
    }, { passive: false });

    // 双击进入编辑模式
    elements.mainCanvas.addEventListener('dblclick', (e) => {
        if (!state.originalImage) return;

        const coords = getCanvasCoords(e);

        // 在中心线模式下，如果双击的是线条则忽略
        if (state.mode === 'centerline' && !state.individualMode) {
            const line = findLineAtPosition(coords.x, coords.y);
            if (line) return;
        }

        const cellIndex = findCellAtPosition(coords.x, coords.y);
        if (cellIndex >= 0) {
            openCropEditor(cellIndex);
        }
    });

    let currentHovered = null;

    // 鼠标/触摸移动事件
    function handlePointerMove(e) {
        const now = performance.now();
        if (now - lastMoveTime < THROTTLE) return;
        lastMoveTime = now;

        if (!state.originalImage) return;

        const coords = getEventCoords(e);

        // 单独调整模式下拖拽
        if (state.editingCell !== null && state.resizeHandle && state.individualMode) {
            const imgCoords = canvasToImageCoords(coords.x, coords.y);
            resizeCellArea(state.editingCell, state.resizeHandle, imgCoords, e.shiftKey);
            scheduleRender();
            return;
        }

        if (state.dragging) {
            const imgCoords = canvasToImageCoords(coords.x, coords.y);

            if (state.dragging.type === 'x') {
                let newX = imgCoords.x;
                newX = Math.max(10, Math.min(state.originalImage.width - 10, newX));
                state.centerLinesX[state.dragging.index] = newX;
            } else {
                let newY = imgCoords.y;
                newY = Math.max(10, Math.min(state.originalImage.height - 10, newY));
                state.centerLinesY[state.dragging.index] = newY;
            }
            scheduleRender();
            return;
        }

        // 单独调整模式悬停检测
        if (state.mode === 'centerline' && state.individualMode) {
            const result = findCellHandleAtPosition(coords.x, coords.y);
            const cellIndex = findCellAtPosition(coords.x, coords.y);

            if (result) {
                state.hoveredCell = result.cellIndex;
                state.hoveredHandle = result.handle;
                elements.mainCanvas.style.cursor = getResizeCursor(result.handle);
            } else if (cellIndex >= 0) {
                state.hoveredCell = cellIndex;
                state.hoveredHandle = null;
                elements.mainCanvas.style.cursor = 'move';
            } else {
                state.hoveredCell = null;
                state.hoveredHandle = null;
                if (!state.isPanning) {
                    elements.mainCanvas.style.cursor = 'grab';
                }
            }
            scheduleRender();
            return;
        }

        if (state.mode !== 'centerline') return;

        const line = findLineAtPosition(coords.x, coords.y);
        const key = line ? `${line.type}-${line.index}` : null;

        if (key !== currentHovered) {
            currentHovered = key;
            state.hovered = line;
            if (line) {
                elements.mainCanvas.style.cursor = line.type === 'x' ? 'ew-resize' : 'ns-resize';
            } else if (!state.isPanning) {
                elements.mainCanvas.style.cursor = 'grab';
            }
            scheduleRender();
        }
    }

    elements.mainCanvas.addEventListener('mousemove', handlePointerMove, { passive: true });

    // 触摸移动只在需要时阻止默认行为
    elements.mainCanvas.addEventListener('touchmove', (e) => {
        // 只在拖拽或调整时阻止默认滚动
        if (state.dragging || state.resizeHandle || state.isPanning) {
            e.preventDefault();
        }
        handlePointerMove(e);
    }, { passive: false });

    // 鼠标/触摸释放事件
    function handlePointerUp() {
        if (state.editingCell !== null && state.resizeHandle) {
            state.resizeHandle = null;
            state.dragStartArea = null;
            elements.mainCanvas.style.cursor = 'grab';
            schedulePreviewUpdate();
            saveHistory(); // 保存单元格调整历史
        }
        if (state.dragging) {
            state.dragging = null;
            state.hovered = null;
            currentHovered = null;
            elements.mainCanvas.style.cursor = 'grab';
            schedulePreviewUpdate();
            saveHistory(); // 保存中心线拖动历史
        }
    }

    window.addEventListener('mouseup', handlePointerUp, { passive: true });
    window.addEventListener('touchend', handlePointerUp, { passive: true });

    elements.mainCanvas.addEventListener('mouseleave', () => {
        if (!state.dragging && !state.isPanning && !state.resizeHandle) {
            state.hovered = null;
            state.hoveredCell = null;
            state.hoveredHandle = null;
            currentHovered = null;
            scheduleRender();
        }
    }, { passive: true });
}

// 获取单元格区域
function getCellArea(index) {
    const halfW = state.cellWidth / 2;
    const halfH = state.cellHeight / 2;

    if (state.customAreas && state.customAreas[index]) {
        return { ...state.customAreas[index] };
    }

    // 根据中心线计算
    const row = Math.floor(index / state.cols);
    const col = index % state.cols;

    if (row >= state.centerLinesY.length || col >= state.centerLinesX.length) {
        return null;
    }

    const cx = state.centerLinesX[col];
    const cy = state.centerLinesY[row];

    let area = {
        x: cx - halfW,
        y: cy - halfH,
        width: state.cellWidth,
        height: state.cellHeight
    };

    // 边界约束
    area.x = Math.max(0, Math.min(state.originalImage.width - area.width, area.x));
    area.y = Math.max(0, Math.min(state.originalImage.height - area.height, area.y));

    return area;
}

// 查找单元格和手柄
function findCellHandleAtPosition(canvasX, canvasY) {
    if (!state.originalImage || state.mode !== 'centerline' || !state.individualMode) return null;

    const imgCoords = canvasToImageCoords(canvasX, canvasY);
    const zoom = state.view.zoom;
    const handleThreshold = 10 / zoom;

    let index = 0;
    for (const cy of state.centerLinesY) {
        for (const cx of state.centerLinesX) {
            const area = getCellArea(index);
            if (!area) {
                index++;
                continue;
            }

            // 检查是否在手柄范围内
            const handles = [
                { name: 'nw', x: area.x, y: area.y },
                { name: 'n', x: area.x + area.width/2, y: area.y },
                { name: 'ne', x: area.x + area.width, y: area.y },
                { name: 'w', x: area.x, y: area.y + area.height/2 },
                { name: 'e', x: area.x + area.width, y: area.y + area.height/2 },
                { name: 'sw', x: area.x, y: area.y + area.height },
                { name: 's', x: area.x + area.width/2, y: area.y + area.height },
                { name: 'se', x: area.x + area.width, y: area.y + area.height }
            ];

            for (const h of handles) {
                if (Math.abs(imgCoords.x - h.x) < handleThreshold && Math.abs(imgCoords.y - h.y) < handleThreshold) {
                    return { cellIndex: index, handle: h.name };
                }
            }

            // 检查是否在单元格内部（用于移动）
            if (imgCoords.x >= area.x && imgCoords.x <= area.x + area.width &&
                imgCoords.y >= area.y && imgCoords.y <= area.y + area.height) {
                return { cellIndex: index, handle: 'move' };
            }

            index++;
        }
    }

    return null;
}

// 调整单元格区域大小
function resizeCellArea(index, handle, imgCoords, shiftKey) {
    if (!state.dragStartArea) return;

    let area = getCellArea(index) || { ...state.dragStartArea };
    const imgW = state.originalImage.width;
    const imgH = state.originalImage.height;
    const minSize = 20;

    if (handle === 'move') {
        // 移动整个区域
        if (!state.lastDragPos) {
            state.lastDragPos = imgCoords;
            return;
        }
        const dx = imgCoords.x - state.lastDragPos.x;
        const dy = imgCoords.y - state.lastDragPos.y;

        area.x = Math.max(0, Math.min(imgW - area.width, area.x + dx));
        area.y = Math.max(0, Math.min(imgH - area.height, area.y + dy));

        state.lastDragPos = imgCoords;
    } else {
        // 调整大小
        let newX = area.x, newY = area.y, newW = area.width, newH = area.height;

        if (handle.includes('w')) {
            newX = Math.max(0, Math.min(area.x + area.width - minSize, imgCoords.x));
            newW = area.x + area.width - newX;
        }
        if (handle.includes('e')) {
            newW = Math.max(minSize, Math.min(imgW - area.x, imgCoords.x - area.x));
        }
        if (handle.includes('n')) {
            newY = Math.max(0, Math.min(area.y + area.height - minSize, imgCoords.y));
            newH = area.y + area.height - newY;
        }
        if (handle.includes('s')) {
            newH = Math.max(minSize, Math.min(imgH - area.y, imgCoords.y - area.y));
        }

        // 按住Shift保持1:1正方形
        if (shiftKey && handle !== 'n' && handle !== 's' && handle !== 'e' && handle !== 'w') {
            // 角落手柄：取宽高的最大值作为正方形边长
            const size = Math.max(newW, newH);

            if (handle.includes('w')) {
                newX = area.x + area.width - size;
                newX = Math.max(0, newX);
                newW = area.x + area.width - newX;
            } else {
                newW = Math.min(size, imgW - area.x);
            }

            if (handle.includes('n')) {
                newY = area.y + area.height - size;
                newY = Math.max(0, newY);
                newH = area.y + area.height - newY;
            } else {
                newH = Math.min(size, imgH - area.y);
            }

            // 确保是正方形
            const finalSize = Math.min(newW, newH);
            if (handle.includes('w')) {
                newX = area.x + area.width - finalSize;
            }
            if (handle.includes('n')) {
                newY = area.y + area.height - finalSize;
            }
            newW = finalSize;
            newH = finalSize;
        }

        area.x = newX;
        area.y = newY;
        area.width = newW;
        area.height = newH;
    }

    // 保存到 customAreas
    if (!state.customAreas) {
        state.customAreas = {};
    }
    state.customAreas[index] = area;
}

// 获取调整大小光标
function getResizeCursor(handle) {
    const cursors = {
        'nw': 'nwse-resize',
        'se': 'nwse-resize',
        'ne': 'nesw-resize',
        'sw': 'nesw-resize',
        'n': 'ns-resize',
        's': 'ns-resize',
        'e': 'ew-resize',
        'w': 'ew-resize',
        'move': 'move'
    };
    return cursors[handle] || 'default';
}

// ==================== 坐标计算 ====================
function getCanvasCoords(e) {
    const rect = elements.mainCanvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

// 将画布坐标转换为图片坐标
function canvasToImageCoords(canvasX, canvasY) {
    return {
        x: (canvasX - state.view.offsetX) / state.view.zoom,
        y: (canvasY - state.view.offsetY) / state.view.zoom
    };
}

function findCellAtPosition(canvasX, canvasY) {
    if (!state.originalImage) return -1;

    const imgCoords = canvasToImageCoords(canvasX, canvasY);
    const x = imgCoords.x;
    const y = imgCoords.y;

    // 检查是否在图片范围内
    if (x < 0 || x > state.originalImage.width || y < 0 || y > state.originalImage.height) {
        return -1;
    }

    if (state.mode === 'uniform') {
        const cellW = state.originalImage.width / state.cols;
        const cellH = state.originalImage.height / state.rows;
        const col = Math.floor(x / cellW);
        const row = Math.floor(y / cellH);
        if (col >= 0 && col < state.cols && row >= 0 && row < state.rows) {
            return row * state.cols + col;
        }
    } else {
        const halfW = state.cellWidth / 2;
        const halfH = state.cellHeight / 2;

        let index = 0;
        for (const cy of state.centerLinesY) {
            for (const cx of state.centerLinesX) {
                const left = cx - halfW;
                const top = cy - halfH;

                if (x >= left && x <= left + halfW * 2 && y >= top && y <= top + halfH * 2) {
                    return index;
                }
                index++;
            }
        }
    }
    return -1;
}

function findLineAtPosition(canvasX, canvasY) {
    if (state.mode !== 'centerline') return null;

    const imgCoords = canvasToImageCoords(canvasX, canvasY);
    const hitRadius = 15 / state.view.zoom;

    for (let i = 0; i < state.centerLinesX.length; i++) {
        if (Math.abs(imgCoords.x - state.centerLinesX[i]) < hitRadius) {
            return { type: 'x', index: i };
        }
    }

    for (let i = 0; i < state.centerLinesY.length; i++) {
        if (Math.abs(imgCoords.y - state.centerLinesY[i]) < hitRadius) {
            return { type: 'y', index: i };
        }
    }

    return null;
}

// ==================== 文件处理 ====================
function handleFileSelect(e) {
    if (e.target.files[0]) {
        handleFile(e.target.files[0]);
    }
}

async function handleFile(file) {
    if (!file.type.match(/^image\/(jpeg|png|gif|webp)$/)) {
        alert('请选择有效的图片文件 (JPG, PNG, GIF, WebP)');
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        const img = new Image();
        img.onload = async () => {
            // 清空所有修改状态
            state.originalImage = img;
            state.processedImage = null;
            state.disabledCells.clear();
            state.customAreas = {};
            state.customNames = {};
            state.individualAreas = {};
            state.editingCell = null;
            state.resizeHandle = null;
            state.dragStartArea = null;
            state.hoveredCell = null;
            state.hoveredHandle = null;
            state.croppedImages = [];

            try {
                state.imageCache = await createImageBitmap(img);
            } catch (err) {
                state.imageCache = null;
            }

            initializeCenterLines();
            displayImage();
            updateImageInfo(file.name);

            // 初始化历史记录
            clearHistory();
            saveHistory();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// ==================== 显示图片 ====================
function displayImage() {
    if (!state.originalImage || !renderer) return;

    elements.placeholder.classList.add('hidden');
    elements.imageInfo.classList.remove('hidden');

    // 设置纹理
    renderer.setImage(state.imageCache || state.originalImage);

    // 计算适应窗口的缩放
    zoomToFit();

    schedulePreviewUpdate();

    elements.exportBtn.disabled = false;
    elements.exportSingleBtn.disabled = false;
}

// ==================== 缩放控制 ====================
function setupZoomControls() {
    document.getElementById('zoomIn').addEventListener('click', () => {
        zoomBy(0.25);
    });

    document.getElementById('zoomOut').addEventListener('click', () => {
        zoomBy(-0.25);
    });

    document.getElementById('zoomFit').addEventListener('click', () => {
        zoomToFit();
    });

    document.getElementById('zoomReset').addEventListener('click', () => {
        zoomTo100();
    });

    // 鼠标滚轮缩放
    elements.mainCanvas.addEventListener('wheel', (e) => {
        if (!state.originalImage) return;
        e.preventDefault();

        const rect = elements.mainCanvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        zoomAtPoint(delta, mouseX, mouseY);
    }, { passive: false });

    // 双指缩放支持
    let lastTouchDistance = 0;
    let lastTouchCenter = { x: 0, y: 0 };
    let isPinching = false;

    elements.mainCanvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2 && state.originalImage) {
            e.preventDefault();
            isPinching = true;
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            lastTouchDistance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );
            const rect = elements.mainCanvas.getBoundingClientRect();
            lastTouchCenter = {
                x: ((touch1.clientX + touch2.clientX) / 2) - rect.left,
                y: ((touch1.clientY + touch2.clientY) / 2) - rect.top
            };
        }
    }, { passive: false });

    elements.mainCanvas.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && isPinching) {
            e.preventDefault();
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const currentDistance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );

            if (lastTouchDistance > 0) {
                const scale = currentDistance / lastTouchDistance;
                const delta = (scale - 1) * 0.5;
                zoomAtPoint(delta, lastTouchCenter.x, lastTouchCenter.y);
            }

            lastTouchDistance = currentDistance;
        }
    }, { passive: false });

    elements.mainCanvas.addEventListener('touchend', () => {
        lastTouchDistance = 0;
        isPinching = false;
    });

    // 左键/单指拖拽画布
    function handlePanStart(e) {
        // 如果是双指触摸，不启动拖拽
        if (e.touches && e.touches.length !== 1) return;

        // 如果正在调整单元格，不启动画布拖拽
        if (state.editingCell !== null || state.resizeHandle) {
            return;
        }
        // 如果在单独调整模式下点击了单元格或手柄，不启动画布拖拽
        if (state.mode === 'centerline' && state.individualMode) {
            const coords = e.touches
                ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
                : { x: e.clientX, y: e.clientY };
            const rect = elements.mainCanvas.getBoundingClientRect();
            const canvasCoords = {
                x: coords.x - rect.left,
                y: coords.y - rect.top
            };
            const result = findCellHandleAtPosition(canvasCoords.x, canvasCoords.y);
            if (result) {
                return;
            }
        }
        // 检查是否点击了中心线
        if (state.mode === 'centerline' && !state.individualMode) {
            const coords = e.touches
                ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
                : { x: e.clientX, y: e.clientY };
            const rect = elements.mainCanvas.getBoundingClientRect();
            const canvasCoords = {
                x: coords.x - rect.left,
                y: coords.y - rect.top
            };
            const line = findLineAtPosition(canvasCoords.x, canvasCoords.y);
            if (line) {
                return; // 不启动拖拽，让线条拖拽接管
            }
        }

        if ((e.button === 0 || e.touches) && !state.dragging) {
            // 触摸时只在画布上启动拖拽才阻止默认行为
            if (e.type === 'touchstart' && state.originalImage) {
                e.preventDefault();
            }
            state.isPanning = true;
            const coords = e.touches
                ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
                : { x: e.clientX, y: e.clientY };
            state.panStart = coords;
            state.viewStart = { x: state.view.offsetX, y: state.view.offsetY };
            elements.mainCanvas.style.cursor = 'grabbing';
        }
    }

    function handlePanMove(e) {
        // 如果正在调整单元格，不移动画布
        if (state.editingCell !== null && state.resizeHandle) {
            return;
        }
        if (state.isPanning && !state.dragging) {
            // 触摸移动画布时阻止默认滚动
            if (e.type === 'touchmove') {
                e.preventDefault();
            }
            const coords = e.touches
                ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
                : { x: e.clientX, y: e.clientY };
            const dx = coords.x - state.panStart.x;
            const dy = coords.y - state.panStart.y;
            state.view.offsetX = state.viewStart.x + dx;
            state.view.offsetY = state.viewStart.y + dy;
            scheduleRender();
        }
    }

    const stopPanning = () => {
        if (state.isPanning) {
            state.isPanning = false;
            elements.mainCanvas.style.cursor = 'grab';
        }
    };

    elements.mainCanvas.addEventListener('mousedown', handlePanStart);
    elements.mainCanvas.addEventListener('touchstart', handlePanStart, { passive: false });

    elements.mainCanvas.addEventListener('mousemove', handlePanMove);
    elements.mainCanvas.addEventListener('touchmove', handlePanMove, { passive: false });

    elements.mainCanvas.addEventListener('mouseup', stopPanning);
    elements.mainCanvas.addEventListener('touchend', stopPanning);
    window.addEventListener('mouseup', stopPanning);
    window.addEventListener('touchend', stopPanning);
}

function zoomBy(delta) {
    if (!state.originalImage) return;

    const containerWidth = elements.canvasContainer.clientWidth;
    const containerHeight = elements.canvasContainer.clientHeight;

    // 以画布中心为缩放中心
    zoomAtPoint(delta, containerWidth / 2, containerHeight / 2);
}

function zoomAtPoint(delta, centerX, centerY) {
    if (!state.originalImage) return;

    const oldZoom = state.view.zoom;
    const newZoom = Math.max(0.1, Math.min(10, oldZoom + delta));

    if (newZoom === oldZoom) return;

    // 计算鼠标位置相对于图片的位置
    const imgX = (centerX - state.view.offsetX) / oldZoom;
    const imgY = (centerY - state.view.offsetY) / oldZoom;

    // 更新缩放
    state.view.zoom = newZoom;

    // 调整偏移，保持鼠标位置下的图片点不变
    state.view.offsetX = centerX - imgX * newZoom;
    state.view.offsetY = centerY - imgY * newZoom;

    updateZoomDisplay();
    scheduleRender();
}

function zoomToFit() {
    if (!state.originalImage) return;

    const containerWidth = elements.canvasContainer.clientWidth;
    const containerHeight = elements.canvasContainer.clientHeight;
    const padding = 40;

    const scaleX = (containerWidth - padding) / state.originalImage.width;
    const scaleY = (containerHeight - padding) / state.originalImage.height;
    state.view.zoom = Math.min(scaleX, scaleY, 1);

    // 居中
    const imgW = state.originalImage.width * state.view.zoom;
    const imgH = state.originalImage.height * state.view.zoom;
    state.view.offsetX = (containerWidth - imgW) / 2;
    state.view.offsetY = (containerHeight - imgH) / 2;

    updateZoomDisplay();
    scheduleRender();
}

function zoomTo100() {
    if (!state.originalImage) return;

    const containerWidth = elements.canvasContainer.clientWidth;
    const containerHeight = elements.canvasContainer.clientHeight;

    state.view.zoom = 1;

    // 居中
    const imgW = state.originalImage.width;
    const imgH = state.originalImage.height;
    state.view.offsetX = (containerWidth - imgW) / 2;
    state.view.offsetY = (containerHeight - imgH) / 2;

    updateZoomDisplay();
    scheduleRender();
}

function updateZoomDisplay() {
    const percent = Math.round(state.view.zoom * 100);
    document.getElementById('zoomValue').textContent = percent + '%';
}

// ==================== 模式UI ====================
function updateModeUI() {
    const individualToggle = document.getElementById('individualModeToggle');

    if (state.mode === 'uniform') {
        elements.modeHint.textContent = '自动将图片等分为网格，点击单元格可禁用';
        elements.editHint.textContent = '(点击单元格禁用/启用)';
        elements.cellSizeControl.classList.add('hidden');
        individualToggle.classList.add('hidden');
    } else {
        if (state.individualMode) {
            elements.modeHint.textContent = '单独调整模式：拖拽边框调整每个单元格';
            elements.editHint.textContent = '(拖拽边框调整 / 双击编辑)';
        } else {
            elements.modeHint.textContent = '拖拽中心线设置位置，点击单元格可禁用';
            elements.editHint.textContent = '(拖拽线条 / 点击单元格禁用)';
        }
        elements.cellSizeControl.classList.remove('hidden');
        individualToggle.classList.remove('hidden');
    }
}

// ==================== 网格设置 ====================
function onGridSettingsChange() {
    state.disabledCells.clear();
    state.customAreas = {};
    updateCellSizeInfo();
    initializeCenterLines();
    scheduleRender();
    schedulePreviewUpdate();
    saveSettings();
    saveHistory();
}

function initializeCenterLines() {
    if (!state.originalImage) return;

    const imgW = state.originalImage.width;
    const imgH = state.originalImage.height;

    state.centerLinesX = [];
    state.centerLinesY = [];

    for (let i = 0; i < state.cols; i++) {
        state.centerLinesX.push((i + 0.5) * imgW / state.cols);
    }

    for (let i = 0; i < state.rows; i++) {
        state.centerLinesY.push((i + 0.5) * imgH / state.rows);
    }

    autoCalculateCellSize();
}

function autoCalculateCellSize() {
    if (!state.originalImage || state.centerLinesX.length === 0) return;

    let minDistX = Infinity;
    let minDistY = Infinity;

    for (let i = 1; i < state.centerLinesX.length; i++) {
        minDistX = Math.min(minDistX, state.centerLinesX[i] - state.centerLinesX[i-1]);
    }
    for (let i = 1; i < state.centerLinesY.length; i++) {
        minDistY = Math.min(minDistY, state.centerLinesY[i] - state.centerLinesY[i-1]);
    }

    if (state.centerLinesX.length > 0) {
        minDistX = Math.min(minDistX, state.centerLinesX[0] * 2);
        minDistX = Math.min(minDistX, (state.originalImage.width - state.centerLinesX[state.centerLinesX.length-1]) * 2);
    }
    if (state.centerLinesY.length > 0) {
        minDistY = Math.min(minDistY, state.centerLinesY[0] * 2);
        minDistY = Math.min(minDistY, (state.originalImage.height - state.centerLinesY[state.centerLinesY.length-1]) * 2);
    }

    state.cellWidth = Math.floor(minDistX * 0.95);
    state.cellHeight = Math.floor(minDistY * 0.95);

    document.getElementById('cellWidth').value = state.cellWidth;
    document.getElementById('cellHeight').value = state.cellHeight;
}

// ==================== 预览 (使用压缩图) ====================
let previewTimeout = null;
let previewCanvas = null;
let previewCtx = null;

function schedulePreviewUpdate() {
    if (previewTimeout) clearTimeout(previewTimeout);
    previewTimeout = setTimeout(() => {
        generatePreviews();
        updateCellSizeInfo();
    }, 200);
}

function generatePreviews() {
    if (!state.originalImage) return;

    state.croppedImages = [];
    elements.previewGrid.innerHTML = '';

    const cropAreas = getCropAreas();

    const totalCells = state.rows * state.cols;
    const prefix = document.getElementById('filePrefix').value || 'emoji';

    // 预览使用小尺寸
    const maxPreviewSize = 100;

    for (let idx = 0; idx < totalCells; idx++) {
        const isDisabled = state.disabledCells.has(idx);
        const area = cropAreas[idx];
        const customName = state.customNames[idx] || `${prefix}_${idx + 1}`;

        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item' + (isDisabled ? ' disabled' : '');
        previewItem.dataset.index = idx;

        if (!isDisabled) {
            // 计算预览尺寸
            const previewW = Math.min(area.width, maxPreviewSize);
            const previewH = Math.min(area.height, maxPreviewSize);
            const scale = Math.min(previewW / area.width, previewH / area.height);

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = Math.floor(area.width * scale);
            tempCanvas.height = Math.floor(area.height * scale);
            const ctx = tempCanvas.getContext('2d');

            // 使用原图裁剪（预览用小图）
            const sourceImage = state.processedImage || state.originalImage;
            ctx.drawImage(
                sourceImage,
                area.x, area.y, area.width, area.height,
                0, 0, tempCanvas.width, tempCanvas.height
            );

            const dataUrl = tempCanvas.toDataURL('image/jpeg', 0.6);

            // 保存裁剪区域信息，导出时再用原图
            state.croppedImages.push({
                dataUrl,
                area: area,
                index: idx + 1,
                name: customName
            });

            previewItem.innerHTML = `
                <span class="index">#${idx + 1}</span>
                <img src="${dataUrl}" alt="预览 ${idx + 1}" title="双击查看大图">
                <span class="preview-name" title="双击编辑名称">${customName}</span>
                <div class="preview-actions">
                    <button class="action-btn" data-action="download" title="单独下载">
                        <i data-feather="download"></i>
                    </button>
                    <button class="action-btn" data-action="edit" title="编辑裁剪区域">
                        <i data-feather="crop"></i>
                    </button>
                    <button class="action-btn" data-action="delete" title="禁用">
                        <i data-feather="eye-off"></i>
                    </button>
                </div>
            `;

            // 双击图片查看大图
            const img = previewItem.querySelector('img');
            img.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                // 生成高清大图
                const fullCanvas = document.createElement('canvas');
                fullCanvas.width = area.width;
                fullCanvas.height = area.height;
                const fullCtx = fullCanvas.getContext('2d');
                const sourceImage = state.processedImage || state.originalImage;
                fullCtx.drawImage(
                    sourceImage,
                    area.x, area.y, area.width, area.height,
                    0, 0, area.width, area.height
                );
                const fullDataUrl = fullCanvas.toDataURL('image/png');
                showImagePreview(fullDataUrl, customName);
            });

            // 双击名称编辑
            const nameSpan = previewItem.querySelector('.preview-name');
            nameSpan.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                startNameEdit(previewItem, idx, customName);
            });
        } else {
            previewItem.innerHTML = `
                <span class="index">#${idx + 1}</span>
                <div class="preview-placeholder"></div>
                <span class="preview-name disabled-text">已禁用</span>
                <div class="preview-actions">
                    <button class="action-btn" data-action="restore" title="恢复">
                        <i data-feather="eye"></i>
                    </button>
                </div>
            `;
        }

        // 操作按钮事件
        previewItem.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                if (action === 'download') {
                    downloadSingleImage(idx);
                } else if (action === 'edit') {
                    openCropEditor(idx);
                } else if (action === 'delete') {
                    state.disabledCells.add(idx);
                    scheduleRender();
                    schedulePreviewUpdate();
                } else if (action === 'restore') {
                    state.disabledCells.delete(idx);
                    scheduleRender();
                    schedulePreviewUpdate();
                }
            });
        });

        elements.previewGrid.appendChild(previewItem);

        // 重新渲染 Feather 图标
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
    }

    const enabledCount = totalCells - state.disabledCells.size;
    document.getElementById('previewCount').textContent = enabledCount;
}

function getCropAreas() {
    const areas = [];

    if (state.mode === 'uniform') {
        const cellW = state.originalImage.width / state.cols;
        const cellH = state.originalImage.height / state.rows;

        for (let row = 0; row < state.rows; row++) {
            for (let col = 0; col < state.cols; col++) {
                const idx = row * state.cols + col;
                if (state.customAreas && state.customAreas[idx]) {
                    areas.push({ ...state.customAreas[idx] });
                } else {
                    areas.push({
                        x: col * cellW,
                        y: row * cellH,
                        width: cellW,
                        height: cellH
                    });
                }
            }
        }
    } else {
        const halfW = state.cellWidth / 2;
        const halfH = state.cellHeight / 2;

        let idx = 0;
        for (const cy of state.centerLinesY) {
            for (const cx of state.centerLinesX) {
                if (state.customAreas && state.customAreas[idx]) {
                    areas.push({ ...state.customAreas[idx] });
                } else {
                    let x = cx - halfW;
                    let y = cy - halfH;

                    x = Math.max(0, Math.min(state.originalImage.width - state.cellWidth, x));
                    y = Math.max(0, Math.min(state.originalImage.height - state.cellHeight, y));

                    areas.push({ x, y, width: state.cellWidth, height: state.cellHeight });
                }
                idx++;
            }
        }
    }

    return areas;
}

// ==================== 信息显示 ====================
function updateImageInfo(fileName) {
    document.getElementById('fileName').textContent = fileName;
    document.getElementById('imageSize').textContent =
        `${state.originalImage.width} × ${state.originalImage.height} 像素`;
    updateCellSizeInfo();
}

function updateCellSizeInfo() {
    if (!state.originalImage) return;

    const total = state.rows * state.cols;
    const enabled = total - state.disabledCells.size;

    if (state.mode === 'uniform') {
        const cellW = Math.floor(state.originalImage.width / state.cols);
        const cellH = Math.floor(state.originalImage.height / state.rows);
        document.getElementById('cellSize').textContent =
            `${cellW} × ${cellH} 像素 (${enabled}/${total}张)`;
    } else {
        document.getElementById('cellSize').textContent =
            `${state.cellWidth} × ${state.cellHeight} 像素 (${enabled}/${total}张)`;
    }
}

// ==================== 单个图片下载 ====================
function downloadSingleImage(index) {
    const item = state.croppedImages.find(img => img.index === index + 1);
    if (!item) {
        alert('图片不存在');
        return;
    }

    const format = document.getElementById('exportFormat').value;
    const quality = parseFloat(document.getElementById('quality').value);
    const mimeType = format === 'jpeg' ? 'image/jpeg' :
                    format === 'webp' ? 'image/webp' : 'image/png';

    // 使用原图裁剪
    const canvas = document.createElement('canvas');
    canvas.width = item.area.width;
    canvas.height = item.area.height;
    const ctx = canvas.getContext('2d');

    const sourceImage = state.processedImage || state.originalImage;
    ctx.drawImage(
        sourceImage,
        item.area.x, item.area.y, item.area.width, item.area.height,
        0, 0, item.area.width, item.area.height
    );

    const dataUrl = format === 'png' ?
        canvas.toDataURL(mimeType) :
        canvas.toDataURL(mimeType, quality);

    const link = document.createElement('a');
    link.download = `${item.name}.${format}`;
    link.href = dataUrl;
    link.click();
}

// ==================== 导出 (使用原图) ====================
async function exportAsZip() {
    if (state.croppedImages.length === 0) {
        alert('没有可导出的图片');
        return;
    }

    showProgress('正在生成 ZIP 压缩包...');

    try {
        const zip = new JSZip();
        const format = document.getElementById('exportFormat').value;
        const quality = parseFloat(document.getElementById('quality').value);
        const prefix = document.getElementById('filePrefix').value || 'emoji';

        const mimeType = format === 'jpeg' ? 'image/jpeg' :
                        format === 'webp' ? 'image/webp' : 'image/png';

        for (let i = 0; i < state.croppedImages.length; i++) {
            const item = state.croppedImages[i];
            updateProgress(`正在处理 ${i + 1}/${state.croppedImages.length}...`);

            // 使用原图裁剪
            const canvas = document.createElement('canvas');
            canvas.width = item.area.width;
            canvas.height = item.area.height;
            const ctx = canvas.getContext('2d');

            const sourceImage = state.processedImage || state.originalImage;
            ctx.drawImage(
                sourceImage,
                item.area.x, item.area.y, item.area.width, item.area.height,
                0, 0, item.area.width, item.area.height
            );

            const dataUrl = format === 'png' ?
                canvas.toDataURL(mimeType) :
                canvas.toDataURL(mimeType, quality);

            const base64Data = dataUrl.split(',')[1];
            const fileName = item.name || `${prefix}_${item.index}`;
            zip.file(`${fileName}.${format}`, base64Data, { base64: true });

            // 让出主线程
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        updateProgress('正在压缩...');
        const content = await zip.generateAsync({ type: 'blob' });

        const link = document.createElement('a');
        link.download = `${prefix}_表情包_${state.croppedImages.length}张.zip`;
        link.href = URL.createObjectURL(content);
        link.click();
        URL.revokeObjectURL(link.href);

        hideProgress();
    } catch (error) {
        hideProgress();
        alert('导出失败: ' + error.message);
    }
}

async function exportSeparately() {
    if (state.croppedImages.length === 0) {
        alert('没有可导出的图片');
        return;
    }

    showProgress('正在准备下载...');

    const format = document.getElementById('exportFormat').value;
    const quality = parseFloat(document.getElementById('quality').value);
    const prefix = document.getElementById('filePrefix').value || 'emoji';

    const mimeType = format === 'jpeg' ? 'image/jpeg' :
                    format === 'webp' ? 'image/webp' : 'image/png';

    for (let i = 0; i < state.croppedImages.length; i++) {
        const item = state.croppedImages[i];
        updateProgress(`正在下载 ${i + 1}/${state.croppedImages.length}...`);

        const canvas = document.createElement('canvas');
        canvas.width = item.area.width;
        canvas.height = item.area.height;
        const ctx = canvas.getContext('2d');

        const sourceImage = state.processedImage || state.originalImage;
        ctx.drawImage(
            sourceImage,
            item.area.x, item.area.y, item.area.width, item.area.height,
            0, 0, item.area.width, item.area.height
        );

        const dataUrl = format === 'png' ?
            canvas.toDataURL(mimeType) :
            canvas.toDataURL(mimeType, quality);

        const link = document.createElement('a');
        const fileName = item.name || `${prefix}_${item.index}`;
        link.download = `${fileName}.${format}`;
        link.href = dataUrl;
        link.click();

        await new Promise(resolve => setTimeout(resolve, 200));
    }

    hideProgress();
}

// ==================== 进度 ====================
function showProgress(text) {
    elements.progressText.textContent = text;
    elements.progressOverlay.classList.remove('hidden');
}

function updateProgress(text) {
    elements.progressText.textContent = text;
}

function hideProgress() {
    elements.progressOverlay.classList.add('hidden');
}

// ==================== 裁剪编辑器 ====================
const cropEditor = {
    modal: null,
    canvas: null,
    ctx: null,
    currentIndex: -1,
    originalArea: null,
    cropArea: null,
    dragging: false,
    resizing: null,
    lastMouse: { x: 0, y: 0 },
    scale: 1,
    imageRegion: { x: 0, y: 0, width: 0, height: 0 }
};

function initCropEditor() {
    cropEditor.modal = document.getElementById('cropModal');
    cropEditor.canvas = document.getElementById('cropCanvas');
    cropEditor.ctx = cropEditor.canvas.getContext('2d');

    document.getElementById('cropModalClose').addEventListener('click', closeCropEditor);
    document.getElementById('cropReset').addEventListener('click', resetCrop);
    document.getElementById('cropCenter').addEventListener('click', centerCrop);
    document.getElementById('cropSave').addEventListener('click', saveCrop);
    document.getElementById('cropDisable').addEventListener('click', disableCurrentCell);

    cropEditor.modal.addEventListener('click', (e) => {
        if (e.target === cropEditor.modal) closeCropEditor();
    });

    cropEditor.canvas.addEventListener('mousedown', onCropMouseDown);
    cropEditor.canvas.addEventListener('mousemove', onCropMouseMove);
    cropEditor.canvas.addEventListener('mouseup', onCropMouseUp);
    cropEditor.canvas.addEventListener('mouseleave', onCropMouseUp);
}

function openCropEditor(index) {
    if (!state.originalImage) return;

    const isDisabled = state.disabledCells.has(index);
    const areas = getCropAreas();
    if (index >= areas.length) return;

    cropEditor.currentIndex = index;
    cropEditor.originalArea = { ...areas[index] };
    cropEditor.cropArea = { ...areas[index] };

    const imgW = state.originalImage.width;
    const imgH = state.originalImage.height;

    const maxCanvasW = Math.min(800, window.innerWidth * 0.8);
    const maxCanvasH = Math.min(600, window.innerHeight * 0.6);

    cropEditor.scale = Math.min(maxCanvasW / imgW, maxCanvasH / imgH, 1);

    cropEditor.canvas.width = Math.floor(imgW * cropEditor.scale);
    cropEditor.canvas.height = Math.floor(imgH * cropEditor.scale);

    cropEditor.imageRegion = {
        x: 0,
        y: 0,
        width: cropEditor.canvas.width,
        height: cropEditor.canvas.height
    };

    document.getElementById('cropModalIndex').textContent = `#${index + 1}`;

    // 更新禁用按钮状态
    const disableBtn = document.getElementById('cropDisable');
    if (isDisabled) {
        disableBtn.innerHTML = '<i data-feather="eye"></i> 启用';
        disableBtn.onclick = () => {
            state.disabledCells.delete(index);
            closeCropEditor();
            scheduleRender();
            schedulePreviewUpdate();
        };
    } else {
        disableBtn.innerHTML = '<i data-feather="eye-off"></i> 禁用';
        disableBtn.onclick = disableCurrentCell;
    }

    // 重新渲染 Feather 图标
    if (typeof feather !== 'undefined') {
        feather.replace();
    }

    cropEditor.modal.classList.remove('hidden');
    renderCropEditor();
}

function closeCropEditor() {
    cropEditor.modal.classList.add('hidden');
    cropEditor.currentIndex = -1;
}

function renderCropEditor() {
    const ctx = cropEditor.ctx;
    const canvas = cropEditor.canvas;
    const scale = cropEditor.scale;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.drawImage(state.originalImage, 0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cx = cropEditor.cropArea.x * scale;
    const cy = cropEditor.cropArea.y * scale;
    const cw = cropEditor.cropArea.width * scale;
    const ch = cropEditor.cropArea.height * scale;

    ctx.save();
    ctx.beginPath();
    ctx.rect(cx, cy, cw, ch);
    ctx.clip();
    ctx.drawImage(state.originalImage, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    ctx.strokeStyle = '#4f6ef7';
    ctx.lineWidth = 2;
    ctx.strokeRect(cx, cy, cw, ch);

    const handleSize = 8;
    ctx.fillStyle = '#4f6ef7';

    ctx.fillRect(cx - handleSize/2, cy - handleSize/2, handleSize, handleSize);
    ctx.fillRect(cx + cw - handleSize/2, cy - handleSize/2, handleSize, handleSize);
    ctx.fillRect(cx - handleSize/2, cy + ch - handleSize/2, handleSize, handleSize);
    ctx.fillRect(cx + cw - handleSize/2, cy + ch - handleSize/2, handleSize, handleSize);

    ctx.fillRect(cx + cw/2 - handleSize/2, cy - handleSize/2, handleSize, handleSize);
    ctx.fillRect(cx + cw/2 - handleSize/2, cy + ch - handleSize/2, handleSize, handleSize);
    ctx.fillRect(cx - handleSize/2, cy + ch/2 - handleSize/2, handleSize, handleSize);
    ctx.fillRect(cx + cw - handleSize/2, cy + ch/2 - handleSize/2, handleSize, handleSize);

    updateCropInfo();
}

function updateCropInfo() {
    const area = cropEditor.cropArea;
    document.getElementById('cropPosition').textContent =
        `${Math.round(area.x)}, ${Math.round(area.y)}`;
    document.getElementById('cropSize').textContent =
        `${Math.round(area.width)} x ${Math.round(area.height)}`;
}

function getCropHandle(x, y) {
    const scale = cropEditor.scale;
    const cx = cropEditor.cropArea.x * scale;
    const cy = cropEditor.cropArea.y * scale;
    const cw = cropEditor.cropArea.width * scale;
    const ch = cropEditor.cropArea.height * scale;
    const threshold = 12;

    const handles = [
        { name: 'nw', x: cx, y: cy },
        { name: 'ne', x: cx + cw, y: cy },
        { name: 'sw', x: cx, y: cy + ch },
        { name: 'se', x: cx + cw, y: cy + ch },
        { name: 'n', x: cx + cw/2, y: cy },
        { name: 's', x: cx + cw/2, y: cy + ch },
        { name: 'w', x: cx, y: cy + ch/2 },
        { name: 'e', x: cx + cw, y: cy + ch/2 }
    ];

    for (const h of handles) {
        if (Math.abs(x - h.x) < threshold && Math.abs(y - h.y) < threshold) {
            return h.name;
        }
    }

    if (x >= cx && x <= cx + cw && y >= cy && y <= cy + ch) {
        return 'move';
    }

    return null;
}

function onCropMouseDown(e) {
    const rect = cropEditor.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const handle = getCropHandle(x, y);
    if (handle) {
        if (handle === 'move') {
            cropEditor.dragging = true;
        } else {
            cropEditor.resizing = handle;
        }
        cropEditor.lastMouse = { x, y };
    }
}

function onCropMouseMove(e) {
    const rect = cropEditor.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (!cropEditor.dragging && !cropEditor.resizing) {
        const handle = getCropHandle(x, y);
        if (handle === 'move') {
            cropEditor.canvas.style.cursor = 'move';
        } else if (handle === 'nw' || handle === 'se') {
            cropEditor.canvas.style.cursor = 'nwse-resize';
        } else if (handle === 'ne' || handle === 'sw') {
            cropEditor.canvas.style.cursor = 'nesw-resize';
        } else if (handle === 'n' || handle === 's') {
            cropEditor.canvas.style.cursor = 'ns-resize';
        } else if (handle === 'e' || handle === 'w') {
            cropEditor.canvas.style.cursor = 'ew-resize';
        } else {
            cropEditor.canvas.style.cursor = 'default';
        }
        return;
    }

    const dx = (x - cropEditor.lastMouse.x) / cropEditor.scale;
    const dy = (y - cropEditor.lastMouse.y) / cropEditor.scale;
    cropEditor.lastMouse = { x, y };

    const area = cropEditor.cropArea;
    const imgW = state.originalImage.width;
    const imgH = state.originalImage.height;

    if (cropEditor.dragging) {
        area.x = Math.max(0, Math.min(imgW - area.width, area.x + dx));
        area.y = Math.max(0, Math.min(imgH - area.height, area.y + dy));
    } else if (cropEditor.resizing) {
        const r = cropEditor.resizing;
        let newX = area.x, newY = area.y, newW = area.width, newH = area.height;

        if (r.includes('w')) {
            newX = Math.max(0, Math.min(area.x + area.width - 20, area.x + dx));
            newW = area.x + area.width - newX;
        }
        if (r.includes('e')) {
            newW = Math.max(20, Math.min(imgW - area.x, area.width + dx));
        }
        if (r.includes('n')) {
            newY = Math.max(0, Math.min(area.y + area.height - 20, area.y + dy));
            newH = area.y + area.height - newY;
        }
        if (r.includes('s')) {
            newH = Math.max(20, Math.min(imgH - area.y, area.height + dy));
        }

        area.x = newX;
        area.y = newY;
        area.width = newW;
        area.height = newH;
    }

    renderCropEditor();
}

function onCropMouseUp() {
    cropEditor.dragging = false;
    cropEditor.resizing = null;
}

function resetCrop() {
    cropEditor.cropArea = { ...cropEditor.originalArea };
    renderCropEditor();
}

function centerCrop() {
    const imgW = state.originalImage.width;
    const imgH = state.originalImage.height;
    const area = cropEditor.cropArea;

    area.x = (imgW - area.width) / 2;
    area.y = (imgH - area.height) / 2;

    renderCropEditor();
}

function disableCurrentCell() {
    const index = cropEditor.currentIndex;
    if (index < 0) return;

    state.disabledCells.add(index);
    closeCropEditor();
    scheduleRender();
    schedulePreviewUpdate();
    saveHistory(); // 保存禁用操作历史
}

function saveCrop() {
    const index = cropEditor.currentIndex;
    if (index < 0) return;

    const area = cropEditor.cropArea;

    // 单独保存这个单元格的自定义裁剪区域
    if (!state.customAreas) {
        state.customAreas = {};
    }
    state.customAreas[index] = { ...area };

    closeCropEditor();
    scheduleRender();
    schedulePreviewUpdate();
    saveHistory(); // 保存裁剪修改历史
}

// ==================== 主题切换 ====================
function setupThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    const savedTheme = localStorage.getItem('theme') || 'light';

    // 应用保存的主题（默认亮色）
    if (savedTheme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }

    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';

        if (newTheme === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }

        localStorage.setItem('theme', newTheme);
    });
}

// ==================== 折叠面板 ====================
function setupCollapsiblePanels() {
    document.querySelectorAll('.collapsible .section-header').forEach(header => {
        header.addEventListener('click', () => {
            const panel = header.closest('.collapsible');
            panel.classList.toggle('collapsed');

            // 保存折叠状态
            const section = header.dataset.section;
            const collapsedSections = JSON.parse(localStorage.getItem('collapsedSections') || '{}');
            collapsedSections[section] = panel.classList.contains('collapsed');
            localStorage.setItem('collapsedSections', JSON.stringify(collapsedSections));
        });
    });

    // 恢复折叠状态
    const collapsedSections = JSON.parse(localStorage.getItem('collapsedSections') || '{}');
    document.querySelectorAll('.collapsible .section-header').forEach(header => {
        const section = header.dataset.section;
        const panel = header.closest('.collapsible');

        if (collapsedSections[section] !== undefined) {
            panel.classList.toggle('collapsed', collapsedSections[section]);
        }
    });
}

// ==================== 大图预览弹窗 ====================
function setupImagePreviewModal() {
    const modal = document.getElementById('imagePreviewModal');
    const closeBtn = document.getElementById('imagePreviewClose');
    const previewImg = document.getElementById('imagePreviewImg');
    const previewInfo = document.getElementById('imagePreviewInfo');

    closeBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    });

    // ESC 键关闭
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            modal.classList.add('hidden');
        }
    });
}

function showImagePreview(dataUrl, name) {
    const modal = document.getElementById('imagePreviewModal');
    const previewImg = document.getElementById('imagePreviewImg');
    const previewInfo = document.getElementById('imagePreviewInfo');

    previewImg.src = dataUrl;
    previewInfo.textContent = name;
    modal.classList.remove('hidden');
}

// ==================== 名称编辑 ====================
function startNameEdit(previewItem, idx, currentName) {
    const nameSpan = previewItem.querySelector('.preview-name');
    if (!nameSpan || nameSpan.querySelector('input')) return;

    const prefix = document.getElementById('filePrefix').value || 'emoji';
    const defaultName = `${prefix}_${idx + 1}`;

    // 创建输入框
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'name-input';
    input.value = state.customNames[idx] || '';
    input.placeholder = defaultName;

    // 替换 span 内容为 input
    nameSpan.textContent = '';
    nameSpan.appendChild(input);
    input.focus();
    input.select();

    const finishEdit = () => {
        const newName = input.value.trim();
        if (newName) {
            state.customNames[idx] = newName;
            nameSpan.textContent = newName;
        } else {
            delete state.customNames[idx];
            nameSpan.textContent = defaultName;
        }

        // 更新 croppedImages 中的名称
        const imageData = state.croppedImages.find(img => img.index === idx + 1);
        if (imageData) {
            imageData.name = newName || defaultName;
        }
    };

    input.addEventListener('blur', finishEdit);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
        } else if (e.key === 'Escape') {
            input.value = state.customNames[idx] || '';
            input.blur();
        }
    });
}

// ==================== 抠背景功能 ====================
function setupBackgroundRemoval() {
    const toleranceSlider = document.getElementById('bgTolerance');
    const toleranceValue = document.getElementById('bgToleranceValue');

    toleranceSlider.addEventListener('input', (e) => {
        toleranceValue.textContent = e.target.value;
    });

    // 拾色器按钮
    document.getElementById('pickBgColor').addEventListener('click', () => {
        if (!state.originalImage) {
            alert('请先导入图片');
            return;
        }
        state.isPickingColor = true;
        elements.mainCanvas.style.cursor = 'crosshair';
    });

    // 移除背景按钮
    document.getElementById('removeBgBtn').addEventListener('click', removeBackground);

    // 还原图片按钮
    document.getElementById('resetBgBtn').addEventListener('click', resetToOriginal);
}

// 从图片拾取颜色
function pickColorFromImage(canvasX, canvasY) {
    if (!state.originalImage) return;

    const imgCoords = canvasToImageCoords(canvasX, canvasY);
    const x = Math.floor(imgCoords.x);
    const y = Math.floor(imgCoords.y);

    if (x < 0 || x >= state.originalImage.width || y < 0 || y >= state.originalImage.height) {
        return;
    }

    // 创建临时 canvas 获取像素颜色
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = state.originalImage.width;
    tempCanvas.height = state.originalImage.height;
    const ctx = tempCanvas.getContext('2d');

    const sourceImg = state.processedImage || state.originalImage;
    ctx.drawImage(sourceImg, 0, 0);

    const pixel = ctx.getImageData(x, y, 1, 1).data;
    const hex = '#' + [pixel[0], pixel[1], pixel[2]].map(v => v.toString(16).padStart(2, '0')).join('');

    document.getElementById('bgRemoveColor').value = hex;
    state.isPickingColor = false;
    elements.mainCanvas.style.cursor = 'grab';
}

// 移除背景
async function removeBackground() {
    if (!state.originalImage) {
        alert('请先导入图片');
        return;
    }

    showProgress('正在处理背景...');

    // 使用 setTimeout 让 UI 有机会更新
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
        const bgColor = document.getElementById('bgRemoveColor').value;
        const tolerance = parseInt(document.getElementById('bgTolerance').value);
        const contiguous = document.getElementById('bgContiguous').checked;

        // 解析背景颜色
        const targetR = parseInt(bgColor.slice(1, 3), 16);
        const targetG = parseInt(bgColor.slice(3, 5), 16);
        const targetB = parseInt(bgColor.slice(5, 7), 16);

        // 创建处理 canvas
        const canvas = document.createElement('canvas');
        const width = state.originalImage.width;
        const height = state.originalImage.height;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // 使用原始图片作为基础
        ctx.drawImage(state.originalImage, 0, 0);
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        if (contiguous) {
            // 连续模式：使用异步泛洪填充从边缘开始
            await floodFillRemoveAsync(data, width, height, targetR, targetG, targetB, tolerance);
        } else {
            // 非连续模式：分块异步移除所有匹配颜色
            await removeAllMatchingAsync(data, width, height, targetR, targetG, targetB, tolerance);
        }

        ctx.putImageData(imageData, 0, 0);

        // 创建处理后的图片
        const processedDataUrl = canvas.toDataURL('image/png');
        const img = new Image();
        img.onload = () => {
            state.processedImage = img;

            // 更新纹理
            renderer.setImage(img);
            scheduleRender();
            schedulePreviewUpdate();
            hideProgress();
            saveHistory(); // 保存背景移除历史
        };
        img.src = processedDataUrl;

    } catch (error) {
        hideProgress();
        alert('处理失败: ' + error.message);
    }
}

// 非连续模式：异步移除所有匹配颜色
async function removeAllMatchingAsync(data, width, height, targetR, targetG, targetB, tolerance) {
    const totalPixels = width * height;
    const chunkSize = 50000;

    for (let start = 0; start < totalPixels; start += chunkSize) {
        const end = Math.min(start + chunkSize, totalPixels);

        for (let i = start; i < end; i++) {
            const idx = i * 4;
            if (colorMatch(data[idx], data[idx + 1], data[idx + 2], targetR, targetG, targetB, tolerance)) {
                data[idx + 3] = 0;
            }
        }

        const progress = Math.round((end / totalPixels) * 100);
        updateProgress(`正在处理... ${progress}%`);
        await new Promise(resolve => setTimeout(resolve, 0));
    }
}

// 颜色匹配
function colorMatch(r1, g1, b1, r2, g2, b2, tolerance) {
    const distance = Math.sqrt(
        Math.pow(r1 - r2, 2) +
        Math.pow(g1 - g2, 2) +
        Math.pow(b1 - b2, 2)
    );
    // 最大距离约为 441 (sqrt(255^2 * 3))
    const maxDistance = 441;
    const threshold = (tolerance / 100) * maxDistance;
    return distance <= threshold;
}

// 异步泛洪填充移除（从边缘开始）- 使用扫描线算法优化
async function floodFillRemoveAsync(data, width, height, targetR, targetG, targetB, tolerance) {
    const visited = new Uint8Array(width * height);
    const toRemove = []; // 记录需要移除的像素索引

    // 使用扫描线种子填充算法，更高效
    const stack = [];

    // 添加边缘像素作为种子点
    // 上边
    for (let x = 0; x < width; x++) {
        stack.push({ x, y: 0 });
    }
    // 下边
    for (let x = 0; x < width; x++) {
        stack.push({ x, y: height - 1 });
    }
    // 左边和右边
    for (let y = 1; y < height - 1; y++) {
        stack.push({ x: 0, y });
        stack.push({ x: width - 1, y });
    }

    let processedCount = 0;
    let lastUpdateTime = Date.now();

    while (stack.length > 0) {
        const { x, y } = stack.pop();
        const idx = y * width + x;

        if (x < 0 || x >= width || y < 0 || y >= height) continue;
        if (visited[idx]) continue;

        const pixelIdx = idx * 4;
        const r = data[pixelIdx];
        const g = data[pixelIdx + 1];
        const b = data[pixelIdx + 2];

        if (!colorMatch(r, g, b, targetR, targetG, targetB, tolerance)) {
            visited[idx] = 1;
            continue;
        }

        // 扫描线填充：找到当前行的左右边界
        let leftX = x;
        let rightX = x;

        // 向左扫描
        while (leftX > 0) {
            const leftIdx = y * width + (leftX - 1);
            if (visited[leftIdx]) break;
            const pIdx = leftIdx * 4;
            if (!colorMatch(data[pIdx], data[pIdx + 1], data[pIdx + 2], targetR, targetG, targetB, tolerance)) break;
            leftX--;
        }

        // 向右扫描
        while (rightX < width - 1) {
            const rightIdx = y * width + (rightX + 1);
            if (visited[rightIdx]) break;
            const pIdx = rightIdx * 4;
            if (!colorMatch(data[pIdx], data[pIdx + 1], data[pIdx + 2], targetR, targetG, targetB, tolerance)) break;
            rightX++;
        }

        // 标记这一行的所有像素为已访问并记录需要移除
        for (let fx = leftX; fx <= rightX; fx++) {
            const fIdx = y * width + fx;
            if (!visited[fIdx]) {
                visited[fIdx] = 1;
                toRemove.push(fIdx);
                processedCount++;
            }
        }

        // 检查上下两行，添加新的种子点
        for (let fx = leftX; fx <= rightX; fx++) {
            // 上一行
            if (y > 0) {
                const upIdx = (y - 1) * width + fx;
                if (!visited[upIdx]) {
                    stack.push({ x: fx, y: y - 1 });
                }
            }
            // 下一行
            if (y < height - 1) {
                const downIdx = (y + 1) * width + fx;
                if (!visited[downIdx]) {
                    stack.push({ x: fx, y: y + 1 });
                }
            }
        }

        // 定期让出主线程
        const now = Date.now();
        if (now - lastUpdateTime > 50) {
            lastUpdateTime = now;
            updateProgress(`正在扫描... 已处理 ${processedCount} 像素`);
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }

    // 批量设置透明度
    updateProgress(`正在应用更改...`);
    await new Promise(resolve => setTimeout(resolve, 0));

    const chunkSize = 100000;
    for (let i = 0; i < toRemove.length; i += chunkSize) {
        const end = Math.min(i + chunkSize, toRemove.length);
        for (let j = i; j < end; j++) {
            data[toRemove[j] * 4 + 3] = 0;
        }

        if (i + chunkSize < toRemove.length) {
            const progress = Math.round((end / toRemove.length) * 100);
            updateProgress(`正在应用更改... ${progress}%`);
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }
}

// 还原到原始图片
function resetToOriginal() {
    if (!state.originalImage) return;

    state.processedImage = null;
    renderer.setImage(state.imageCache || state.originalImage);
    scheduleRender();
    schedulePreviewUpdate();
    saveHistory(); // 保存重置操作历史
}

// ==================== 移动端标签页切换 ====================
function setupMobileTabs() {
    const mobileTabs = document.getElementById('mobileTabs');
    if (!mobileTabs) return;

    // 初始化：设置默认标签
    document.body.setAttribute('data-mobile-tab', 'settings');

    // 标签点击事件
    mobileTabs.addEventListener('click', (e) => {
        const tab = e.target.closest('.mobile-tab');
        if (!tab) return;

        const tabName = tab.dataset.tab;
        switchMobileTab(tabName);
    });
}

function switchMobileTab(tabName) {
    // 更新body的data属性
    document.body.setAttribute('data-mobile-tab', tabName);

    // 更新标签激活状态
    document.querySelectorAll('.mobile-tab').forEach(tab => {
        if (tab.dataset.tab === tabName) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    // 切换到工作空间时，重新渲染画布
    if (tabName === 'workspace' && state.originalImage) {
        // 延迟渲染，确保DOM已更新
        setTimeout(() => {
            scheduleRender();
        }, 100);
    }

    // 切换到资源管理时，确保预览图是最新的
    if (tabName === 'resources') {
        // 如果还没有预览图，生成一次
        if (state.croppedImages.length === 0 && state.originalImage) {
            schedulePreviewUpdate();
        }
    }
}

// ==================== 启动 ====================
init();
initCropEditor();
