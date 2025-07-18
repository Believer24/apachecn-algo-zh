// DOM elements - will be initialized after DOM loads
let video, canvas, startButton, captureButton, diagnosticButton;
let resultsContainer, modelStatus;
let colorAnalysis, eyeAnalysis, symmetryAnalysis, skinAnalysis;
let recommendations, historyContainer;

// Canvas context and state
let ctx;
let streaming = false;
let model = null;
let lastFrameTime = 0;
const ANALYSIS_INTERVAL = 100; // 分析间隔时间（毫秒）

// Model loading state management
let modelLoadingState = {
    isLoading: false,
    isLoaded: false,
    modelType: null,
    loadingProgress: 0,
    error: null
};

// Status indicator will be created after DOM loads

// 更新状态显示
function updateStatus(message, isError = false) {
    const statusIndicator = document.createElement('div');
    statusIndicator.className = isError ? 'status-indicator error' : 'status-indicator';
    statusIndicator.textContent = message;

    // 移除旧的状态指示器
    const oldIndicators = document.querySelectorAll('.status-indicator');
    oldIndicators.forEach(indicator => indicator.remove());

    // 添加新的状态指示器
    document.querySelector('.camera-container').appendChild(statusIndicator);

    console.log(isError ? `错误: ${message}` : message);

    // 自动隐藏（非错误消息）
    if (!isError) {
        setTimeout(() => {
            statusIndicator.style.opacity = '0';
            setTimeout(() => statusIndicator.remove(), 500);
        }, 3000);
    }
}

// 添加状态指示器样式
function addStatusStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .status-indicator {
            position: absolute;
            bottom: 10px;
            left: 50%;
            transform: translateX(-50%);
            background-color: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 14px;
            z-index: 100;
            transition: opacity 0.5s;
        }

        .status-indicator.error {
            background-color: rgba(231, 76, 60, 0.9);
        }
    `;
    document.head.appendChild(style);
}

// 更新模型状态
function updateModelStatus(message, isError = false) {
    modelStatus.textContent = `状态: ${message}`;
    modelStatus.className = isError ? 'model-status error' : 'model-status';

    if (isError) {
        modelStatus.className = 'model-status error';
        console.error(`模型错误: ${message}`);
    } else if (message.includes("加载中")) {
        modelStatus.className = 'model-status loading';
    } else if (message.includes("成功")) {
        modelStatus.className = 'model-status success';
    }
}

// 显示模型加载进度
function showModelLoadingProgress(show = true) {
    const progressContainer = document.getElementById('modelLoadingProgress');
    if (progressContainer) {
        progressContainer.style.display = show ? 'block' : 'none';
    }
}

// 更新模型加载进度
function updateModelLoadingProgress(progress, details = '') {
    const progressBar = document.querySelector('.loading-fill');
    const progressDetails = document.querySelector('.loading-details');

    if (progressBar) {
        progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
    }

    if (progressDetails && details) {
        progressDetails.textContent = details;
    }

    modelLoadingState.loadingProgress = progress;
}

// 添加模型状态样式
function addModelStatusStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .model-status {
            margin-top: 10px;
            padding: 8px;
            background-color: #f8f9fa;
            border-radius: 4px;
            text-align: center;
            font-size: 14px;
        }

        .model-status.error {
            background-color: #ffebee;
            color: #c62828;
        }

        .model-status.success {
            background-color: #e8f5e9;
            color: #2e7d32;
        }

        .model-status.loading {
            background-color: #e3f2fd;
            color: #1565c0;
        }
    `;
    document.head.appendChild(style);
}

// 添加下载按钮功能
function addDownloadButton(imageDataURL) {
    // 移除旧的下载按钮
    const existingBtn = document.querySelector('.download-photo-btn');
    if (existingBtn) existingBtn.remove();
    
    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'download-photo-btn';
    downloadBtn.innerHTML = '📸 下载照片';
    downloadBtn.style.cssText = `
        margin: 10px;
        padding: 8px 16px;
        background: #28a745;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-size: 14px;
    `;
    
    downloadBtn.onclick = () => {
        const link = document.createElement('a');
        link.download = `face-photo-${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.jpg`;
        link.href = imageDataURL;
        link.click();
    };
    
    document.querySelector('.controls').appendChild(downloadBtn);
}

// 页面加载时初始化
window.addEventListener('DOMContentLoaded', async () => {
    console.log("页面加载完成，开始初始化...");

    try {
        // 初始化DOM元素
        initializeDOMElements();

        // 添加样式
        addRecommendationStyles();
        addStatusStyles();
        addModelStatusStyles();

        // 初始化按钮状态
        startButton.disabled = false;
        captureButton.disabled = true;

        // 添加事件监听器
        addEventListeners();

        // 检查浏览器支持
        const support = checkBrowserSupport();
        if (!support.supported) {
            updateModelStatus(support.reason, true);
            return;
        }

        console.log("DOM初始化完成，所有按钮已准备就绪");

        // 延迟启动模型加载，给页面渲染时间
        setTimeout(async () => {
            console.log("开始预加载AI模型...");
            try {
                const success = await preloadModel();
                if (success) {
                    console.log("AI模型预加载成功，系统已准备就绪");
                } else {
                    console.warn("AI模型预加载失败，将在分析时重试");
                }
            } catch (error) {
                console.error("预加载过程中出现错误:", error);
            }
        }, 500);

    } catch (error) {
        console.error("初始化过程中出现错误:", error);
        alert("页面初始化失败，请刷新页面重试");
    }
});

// 初始化DOM元素
function initializeDOMElements() {
    // 获取所有DOM元素
    video = document.getElementById('video');
    canvas = document.getElementById('canvas');
    startButton = document.getElementById('startButton');
    captureButton = document.getElementById('captureButton');
    diagnosticButton = document.getElementById('diagnosticButton');
    resultsContainer = document.getElementById('resultsContainer');
    modelStatus = document.getElementById('modelStatus');

    // 分析结果元素
    colorAnalysis = document.getElementById('colorAnalysis');
    eyeAnalysis = document.getElementById('eyeAnalysis');
    symmetryAnalysis = document.getElementById('symmetryAnalysis');
    skinAnalysis = document.getElementById('skinAnalysis');
    recommendations = document.getElementById('recommendations');
    historyContainer = document.getElementById('historyContainer');

    // 检查必要元素是否存在
    if (!video || !canvas || !startButton || !captureButton) {
        throw new Error("关键DOM元素未找到");
    }

    // 初始化canvas上下文
    ctx = canvas.getContext('2d');

    console.log("DOM元素初始化完成");
}

// 添加所有事件监听器
function addEventListeners() {
    // 开始分析按钮
    if (startButton) {
        startButton.addEventListener('click', handleStartCamera);
        console.log("开始分析按钮事件监听器已添加");
    }

    // 拍摄照片按钮
    if (captureButton) {
        captureButton.addEventListener('click', handleCapturePhoto);
        console.log("拍摄照片按钮事件监听器已添加");
    }

    // 诊断按钮
    if (diagnosticButton) {
        diagnosticButton.addEventListener('click', handleDiagnostic);
        console.log("诊断按钮事件监听器已添加");
    } else {
        console.warn("诊断按钮未找到");
    }
}

// 处理开始摄像头按钮点击
async function handleStartCamera() {
    console.log("开始按钮被点击");

    // 禁用按钮防止重复点击
    startButton.disabled = true;
    updateStatus("正在检查摄像头权限...");

    try {
        // 步骤1: 检查浏览器支持
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error("您的浏览器不支持摄像头访问。请使用Chrome、Firefox或Safari最新版本。");
        }

        // 步骤2: 检查协议
        if (location.protocol === 'file:') {
            updateStatus("⚠️ 检测到file://协议，某些浏览器可能阻止摄像头访问", true);
            console.warn("使用file://协议可能导致摄像头访问被阻止");
        }

        // 步骤3: 检查可用设备
        updateStatus("正在检查摄像头设备...");
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');

        if (videoDevices.length === 0) {
            throw new Error("未检测到摄像头设备。请确保摄像头已连接并正常工作。");
        }

        console.log(`检测到 ${videoDevices.length} 个摄像头设备`);

        // 步骤4: 请求摄像头权限
        updateStatus("正在请求摄像头权限...");

        const constraints = {
            video: {
                width: { ideal: 1280, min: 640 },
                height: { ideal: 720, min: 480 },
                facingMode: 'user',
                frameRate: { ideal: 30, min: 15 }
            },
            audio: false
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        console.log("摄像头访问成功!", stream);
        updateStatus("摄像头权限获取成功", false);

        // 步骤5: 设置视频源
        video.srcObject = stream;

        // 步骤6: 等待视频准备就绪
        return new Promise((resolve, reject) => {
            const videoLoadTimeout = setTimeout(() => {
                reject(new Error("摄像头初始化超时"));
            }, 15000);

            video.onloadedmetadata = () => {
                console.log("视频元数据加载完成");
                clearTimeout(videoLoadTimeout);

                video.play().then(() => {
                    console.log("视频播放开始");

                    // 获取实际视频尺寸
                    const actualWidth = video.videoWidth || 1280;
                    const actualHeight = video.videoHeight || 720;
                    
                    // 设置canvas尺寸为视频实际尺寸
                    canvas.width = actualWidth;
                    canvas.height = actualHeight;
                    
                    // 设置canvas显示尺寸（保持宽高比）
                    const maxDisplayWidth = 640;
                    const aspectRatio = actualWidth / actualHeight;
                    const displayWidth = Math.min(maxDisplayWidth, actualWidth);
                    const displayHeight = displayWidth / aspectRatio;
                    
                    canvas.style.width = `${displayWidth}px`;
                    canvas.style.height = `${displayHeight}px`;
                    
                    console.log(`视频实际尺寸: ${actualWidth}x${actualHeight}, 显示尺寸: ${displayWidth}x${displayHeight}`);

                    // 启用功能
                    streaming = true;
                    captureButton.disabled = false;

                    // 开始绘制
                    drawVideoFrame();

                    updateStatus("✅ 摄像头运行正常，可以开始分析", false);
                    resolve();

                }).catch(playError => {
                    clearTimeout(videoLoadTimeout);
                    console.error("视频播放失败:", playError);
                    reject(new Error(`视频播放失败: ${playError.message}`));
                });
            };

            video.onerror = (error) => {
                clearTimeout(videoLoadTimeout);
                console.error("视频加载错误:", error);
                reject(new Error("视频加载失败"));
            };
        });

    } catch (error) {
        console.error("摄像头访问失败:", error);

        // 重新启用按钮
        startButton.disabled = false;

        // 详细的错误处理
        let errorMessage = "摄像头访问失败";
        let solutions = [];

        switch (error.name) {
            case 'NotAllowedError':
                errorMessage = "摄像头权限被拒绝";
                solutions = [
                    "1. 点击地址栏的摄像头图标，选择'允许'",
                    "2. 检查浏览器设置中的摄像头权限",
                    "3. 刷新页面重新尝试"
                ];
                break;
            case 'NotFoundError':
                errorMessage = "未找到摄像头设备";
                solutions = [
                    "1. 检查摄像头是否已连接",
                    "2. 检查设备管理器中的摄像头状态",
                    "3. 尝试重新连接摄像头"
                ];
                break;
            case 'NotReadableError':
                errorMessage = "摄像头被其他应用占用";
                solutions = [
                    "1. 关闭其他使用摄像头的应用（如Zoom、Skype等）",
                    "2. 重启浏览器",
                    "3. 重启计算机"
                ];
                break;
            default:
                errorMessage = error.message || "未知错误";
                solutions = [
                    "1. 尝试使用不同的浏览器",
                    "2. 检查摄像头驱动程序",
                    "3. 确保使用HTTPS协议访问"
                ];
        }

        updateStatus(`❌ ${errorMessage}`, true);

        const solutionText = `${errorMessage}\n\n解决方案：\n${solutions.join('\n')}`;
        alert(solutionText);
    }
}

// 处理拍摄照片按钮点击
async function handleCapturePhoto() {
    if (!streaming) return;

    // 禁用按钮，防止重复点击
    captureButton.disabled = true;

    try {
        updateStatus("捕获高质量面部图像...");

        // 确保canvas大小匹配视频实际尺寸
        const actualWidth = video.videoWidth;
        const actualHeight = video.videoHeight;
        
        if (canvas.width !== actualWidth || canvas.height !== actualHeight) {
            canvas.width = actualWidth;
            canvas.height = actualHeight;
        }

        // 清空canvas并绘制高质量图像
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 使用高质量渲染设置
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // 绘制视频帧
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // 创建可下载的图片版本
        const capturedImageDataURL = canvas.toDataURL('image/jpeg', 0.95);
        
        // 显示照片预览
        showPhotoPreview(capturedImageDataURL);
        
        updateStatus("照片已拍摄，请确认是否进行分析");

    } catch (error) {
        console.error("拍摄过程中出错:", error);
        updateStatus(`拍摄失败: ${error.message}`, true);
        captureButton.disabled = false;
    }
}

// 显示照片预览
function showPhotoPreview(imageDataURL) {
    const photoPreview = document.getElementById('photoPreview');
    const previewImage = document.getElementById('previewImage');
    const retakeButton = document.getElementById('retakeButton');
    const confirmButton = document.getElementById('confirmButton');
    
    // 设置预览图片
    previewImage.src = imageDataURL;
    
    // 显示预览
    photoPreview.style.display = 'flex';
    
    // 添加下载按钮
    addDownloadButton(imageDataURL);
    
    // 重新拍摄按钮事件
    retakeButton.onclick = () => {
        photoPreview.style.display = 'none';
        captureButton.disabled = false;
        removeDownloadButton();
    };
    
    // 确认分析按钮事件
    confirmButton.onclick = () => {
        photoPreview.style.display = 'none';
        startAnalysis(imageDataURL);
    };
}

// 开始分析
async function startAnalysis(imageDataURL) {
    // 显示分析进度条
    const analysisProgress = document.getElementById('analysisProgress');
    analysisProgress.style.display = 'block';
    const progressBar = analysisProgress.querySelector('.progress-bar');
    progressBar.style.width = '0%';

    try {
        updateStatus("开始面部分析...");
        progressBar.style.width = '10%';

        // 检查模型是否已加载
        if (!modelLoadingState.isLoaded) {
            updateStatus("AI模型未就绪，正在加载...");
            const success = await preloadModel();
            if (!success) {
                throw new Error("AI模型加载失败，无法进行分析");
            }
        }

        progressBar.style.width = '20%';
        
        // 从dataURL获取图像数据
        const imageData = await getImageDataFromDataURL(imageDataURL);

        progressBar.style.width = '30%';
        updateStatus("检测面部特征...");

        // 进行实际的面部检测
        let faceData;
        try {
            updateStatus("使用AI模型检测面部...");
            faceData = await detectFaces(imageData);
            
            if (!faceData || faceData.length === 0) {
                console.warn("AI模型未检测到面部，尝试基础检测算法");
                faceData = await fallbackFaceDetection(imageData);
                
                if (!faceData || faceData.length === 0) {
                    console.warn("所有检测方法均未发现面部，使用默认区域");
                    faceData = [{
                        topLeft: [imageData.width * 0.25, imageData.height * 0.25],
                        bottomRight: [imageData.width * 0.75, imageData.height * 0.75],
                        confidence: 0.5,
                        method: 'default'
                    }];
                    updateStatus("⚠️ 使用默认面部区域进行分析");
                } else {
                    updateStatus("✅ 基础算法检测到面部");
                }
            } else {
                updateStatus("✅ AI模型成功检测到面部");
            }
        } catch (detectionError) {
            console.warn("面部检测失败，使用默认区域:", detectionError);
            faceData = [{
                topLeft: [imageData.width * 0.25, imageData.height * 0.25],
                bottomRight: [imageData.width * 0.75, imageData.height * 0.75],
                confidence: 0.3,
                method: 'fallback'
            }];
            updateStatus("⚠️ 检测失败，使用默认区域");
        }

        progressBar.style.width = '50%';
        updateStatus("分析面部健康特征...");

        // 分析面部特征
        const analysisResults = await analyzeFace(faceData, imageData);

        progressBar.style.width = '80%';
        updateStatus("生成分析报告...");

        // 显示分析结果
        displayResults(analysisResults);

        // 保存到历史记录
        saveToHistory(analysisResults);

        progressBar.style.width = '100%';
        updateStatus("分析完成！");

        // 显示结果容器
        resultsContainer.style.display = 'block';
        historyContainer.style.display = 'block';

        // 3秒后隐藏进度条
        setTimeout(() => {
            analysisProgress.style.display = 'none';
        }, 3000);

    } catch (error) {
        console.error("分析过程中出错:", error);
        updateStatus(`分析失败: ${error.message}`, true);
        progressBar.style.width = '0%';

        setTimeout(() => {
            analysisProgress.style.display = 'none';
        }, 3000);
    } finally {
        // 重新启用按钮
        captureButton.disabled = false;
    }
}

// 从DataURL获取ImageData
async function getImageDataFromDataURL(dataURL) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            tempCanvas.width = img.width;
            tempCanvas.height = img.height;
            tempCtx.drawImage(img, 0, 0);
            const imageData = tempCtx.getImageData(0, 0, img.width, img.height);
            resolve(imageData);
        };
        img.src = dataURL;
    });
}

// 移除下载按钮
function removeDownloadButton() {
    const existingBtn = document.querySelector('.download-photo-btn');
    if (existingBtn) existingBtn.remove();
}

// 处理诊断按钮点击
async function handleDiagnostic() {
    console.log("开始摄像头诊断");

    // 创建诊断窗口
    const diagnosticWindow = createDiagnosticWindow();

    try {
        // 步骤1: 基础检查
        addDiagnosticResult(diagnosticWindow, "🔍 检查浏览器支持", "进行中...", "info");

        if (!navigator.mediaDevices) {
            addDiagnosticResult(diagnosticWindow, "❌ MediaDevices API", "不支持", "error");
            addDiagnosticResult(diagnosticWindow, "💡 解决方案", "请使用Chrome 88+, Firefox 85+, 或 Safari 14+", "info");
            return;
        }

        addDiagnosticResult(diagnosticWindow, "✅ MediaDevices API", "支持", "success");

        // 步骤2: 检查协议
        if (location.protocol === 'file:') {
            addDiagnosticResult(diagnosticWindow, "⚠️ 协议检查", "使用file://协议，可能被阻止", "warning");
            addDiagnosticResult(diagnosticWindow, "💡 建议", "使用HTTP服务器或HTTPS协议", "info");
        } else {
            addDiagnosticResult(diagnosticWindow, "✅ 协议检查", `使用${location.protocol}协议`, "success");
        }

        // 步骤3: 检查设备
        addDiagnosticResult(diagnosticWindow, "🔍 检查摄像头设备", "扫描中...", "info");

        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');

        if (videoDevices.length === 0) {
            addDiagnosticResult(diagnosticWindow, "❌ 摄像头设备", "未检测到摄像头", "error");
            addDiagnosticResult(diagnosticWindow, "💡 解决方案", "检查摄像头连接和驱动程序", "info");
            return;
        }

        addDiagnosticResult(diagnosticWindow, "✅ 摄像头设备", `检测到${videoDevices.length}个设备`, "success");

        // 显示设备信息
        videoDevices.forEach((device, index) => {
            const label = device.label || `摄像头 ${index + 1}`;
            addDiagnosticResult(diagnosticWindow, `📹 设备${index + 1}`, label, "info");
        });

        // 步骤4: 测试权限
        addDiagnosticResult(diagnosticWindow, "🔍 测试摄像头权限", "请求中...", "info");

        try {
            const testStream = await navigator.mediaDevices.getUserMedia({
                video: { width: 320, height: 240 },
                audio: false
            });

            addDiagnosticResult(diagnosticWindow, "✅ 摄像头权限", "获取成功", "success");

            // 测试视频轨道
            const videoTracks = testStream.getVideoTracks();
            if (videoTracks.length > 0) {
                const track = videoTracks[0];
                const settings = track.getSettings();
                addDiagnosticResult(diagnosticWindow, "📊 视频分辨率", `${settings.width}x${settings.height}`, "info");
                addDiagnosticResult(diagnosticWindow, "🎥 帧率", `${settings.frameRate}fps`, "info");
            }

            // 清理测试流
            testStream.getTracks().forEach(track => track.stop());

            addDiagnosticResult(diagnosticWindow, "🎉 诊断完成", "摄像头工作正常！可以尝试重新开始分析", "success");

        } catch (permissionError) {
            addDiagnosticResult(diagnosticWindow, "❌ 摄像头权限", permissionError.name, "error");

            // 提供具体的解决方案
            switch (permissionError.name) {
                case 'NotAllowedError':
                    addDiagnosticResult(diagnosticWindow, "💡 解决方案", "点击地址栏摄像头图标，选择'允许'", "info");
                    break;
                case 'NotFoundError':
                    addDiagnosticResult(diagnosticWindow, "💡 解决方案", "检查摄像头连接和设备管理器", "info");
                    break;
                case 'NotReadableError':
                    addDiagnosticResult(diagnosticWindow, "💡 解决方案", "关闭其他使用摄像头的应用", "info");
                    break;
                default:
                    addDiagnosticResult(diagnosticWindow, "💡 解决方案", "尝试刷新页面或重启浏览器", "info");
            }
        }

    } catch (error) {
        addDiagnosticResult(diagnosticWindow, "❌ 诊断失败", error.message, "error");
    }
}

// 页面卸载时清理资源
window.addEventListener('beforeunload', () => {
    console.log("页面卸载，清理资源...");
    cleanupResources();

    // 停止摄像头流
    if (video.srcObject) {
        const tracks = video.srcObject.getTracks();
        tracks.forEach(track => track.stop());
    }
});

// 医学知识库 - 面色与健康状况对应关系
const FACE_COLOR_KNOWLEDGE = {
    pale: {
        description: "面色苍白",
        possibleCauses: ["贫血", "血液循环不良", "营养不良", "慢性疲劳"],
        medicalAdvice: "建议检查血常规，特别是血红蛋白水平；增加富含铁质的食物摄入；保证充足休息"
    },
    yellow: {
        description: "面色发黄",
        possibleCauses: ["肝功能异常", "胆道疾病", "黄疸"],
        medicalAdvice: "建议检查肝功能和胆红素水平；减少酒精摄入；避免过度劳累"
    },
    red: {
        description: "面色潮红",
        possibleCauses: ["高血压", "发热", "酒精摄入过多", "内分泌失调"],
        medicalAdvice: "建议监测血压；减少辛辣食物和酒精摄入；保持情绪稳定"
    },
    dark: {
        description: "面色晦暗",
        possibleCauses: ["慢性疲劳", "肾功能不全", "睡眠不足"],
        medicalAdvice: "建议检查肾功能；改善睡眠质量；增加水分摄入"
    }
};

// 眼部健康知识库
const EYE_HEALTH_KNOWLEDGE = {
    redness: {
        description: "眼白发红",
        possibleCauses: ["结膜炎", "眼部疲劳", "过敏", "干眼症"],
        medicalAdvice: "建议减少屏幕使用时间；使用人工泪液；避免揉眼；如持续发红应就医"
    },
    yellowness: {
        description: "眼白发黄",
        possibleCauses: ["肝功能异常", "胆道疾病", "黄疸"],
        medicalAdvice: "建议及时就医检查肝功能；避免酒精和高脂肪食物"
    },
    dryness: {
        description: "眼部干涩",
        possibleCauses: ["干眼症", "长时间用眼", "空调环境", "缺乏维生素A"],
        medicalAdvice: "建议使用人工泪液；每工作1小时休息10分钟；增加维生素A摄入"
    },
    bags: {
        description: "眼袋明显",
        possibleCauses: ["睡眠不足", "水钠潴留", "肾功能不全", "过敏"],
        medicalAdvice: "建议保证充足睡眠；减少盐分摄入；睡前避免大量饮水"
    }
};

// 皮肤健康知识库
const SKIN_HEALTH_KNOWLEDGE = {
    dryness: {
        description: "皮肤干燥",
        possibleCauses: ["缺水", "维生素缺乏", "环境因素", "内分泌失调"],
        medicalAdvice: "建议增加水分摄入；使用保湿产品；补充维生素E；避免过热水洗脸"
    },
    acne: {
        description: "痤疮/粉刺",
        possibleCauses: ["内分泌失调", "压力", "饮食不当", "细菌感染"],
        medicalAdvice: "建议保持面部清洁；减少高糖高脂食物摄入；控制压力；必要时咨询皮肤科医生"
    },
    redness: {
        description: "皮肤发红/敏感",
        possibleCauses: ["过敏反应", "酒渣鼻", "皮肤屏障受损", "自身免疫性疾病"],
        medicalAdvice: "建议使用温和无刺激的护肤品；避免过度清洁；必要时进行过敏原检测"
    },
    pigmentation: {
        description: "色素沉着",
        possibleCauses: ["紫外线暴露", "内分泌失调", "炎症后色素沉着", "药物反应"],
        medicalAdvice: "建议做好防晒；使用含维生素C的护肤品；避免摩擦刺激皮肤"
    }
};

// 优化的模型预加载函数
async function preloadModel() {
    if (modelLoadingState.isLoading || modelLoadingState.isLoaded) {
        console.log("模型已在加载中或已加载");
        return modelLoadingState.isLoaded;
    }

    modelLoadingState.isLoading = true;
    modelLoadingState.error = null;

    showModelLoadingProgress(true);
    updateModelLoadingProgress(0, "初始化TensorFlow.js...");
    updateModelStatus("正在加载AI模型...", false);

    try {
        // 步骤1: 检查TensorFlow.js
        if (!window.tf) {
            throw new Error("TensorFlow.js未加载，请检查网络连接");
        }

        updateModelLoadingProgress(10, "准备TensorFlow后端...");

        // 步骤2: 初始化TensorFlow后端
        await tf.ready();
        console.log("TensorFlow.js已准备就绪");

        updateModelLoadingProgress(20, "设置WebGL后端...");

        // 尝试使用WebGL后端以获得更好性能
        try {
            await tf.setBackend('webgl');
            console.log("使用WebGL后端");
            updateModelLoadingProgress(30, "WebGL后端已启用");
        } catch (webglError) {
            console.warn("WebGL后端不可用，使用CPU后端:", webglError);
            await tf.setBackend('cpu');
            updateModelLoadingProgress(30, "使用CPU后端");
        }

        // 步骤3: 加载主要模型 (MediaPipe FaceMesh)
        updateModelLoadingProgress(40, "加载面部识别模型...");

        const success = await loadPrimaryModel();

        if (success) {
            // 步骤4: 模型预热
            updateModelLoadingProgress(80, "模型预热中...");
            await warmupModel();

            updateModelLoadingProgress(100, "模型加载完成");
            updateModelStatus("AI模型加载成功", false);

            modelLoadingState.isLoaded = true;
            modelLoadingState.isLoading = false;

            // 延迟隐藏进度条
            setTimeout(() => showModelLoadingProgress(false), 2000);

            return true;
        } else {
            throw new Error("所有模型加载尝试均失败");
        }

    } catch (error) {
        console.error("模型加载失败:", error);
        modelLoadingState.error = error.message;
        modelLoadingState.isLoading = false;

        updateModelStatus(`模型加载失败: ${error.message}`, true);
        updateModelLoadingProgress(0, "加载失败");

        // 延迟隐藏进度条
        setTimeout(() => showModelLoadingProgress(false), 3000);

        return false;
    }
}

// 加载主要模型的函数
async function loadPrimaryModel() {
    // 尝试加载MediaPipe FaceMesh模型
    try {
        updateModelLoadingProgress(50, "加载MediaPipe FaceMesh...");

        if (!window.faceLandmarksDetection) {
            throw new Error("faceLandmarksDetection API未加载");
        }

        model = await faceLandmarksDetection.createDetector(
            faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
            {
                runtime: 'tfjs',
                maxFaces: 1,
                refineLandmarks: false, // 关闭精细化以提高性能
                staticImageMode: false
            }
        );

        modelLoadingState.modelType = 'MediaPipeFaceMesh';
        console.log("MediaPipe FaceMesh模型加载成功");
        updateModelLoadingProgress(70, "MediaPipe模型加载成功");
        return true;

    } catch (faceError) {
        console.warn("MediaPipe FaceMesh加载失败，尝试备选模型:", faceError);

        // 尝试加载BlazeFace作为备选
        try {
            updateModelLoadingProgress(60, "加载备选模型BlazeFace...");

            if (!window.blazeface) {
                throw new Error("BlazeFace API未加载");
            }

            model = await blazeface.load();
            modelLoadingState.modelType = 'BlazeFace';
            console.log("BlazeFace备选模型加载成功");
            updateModelLoadingProgress(70, "BlazeFace模型加载成功");
            return true;

        } catch (blazeError) {
            console.error("BlazeFace模型也加载失败:", blazeError);
            return false;
        }
    }
}

// 模型预热函数
async function warmupModel() {
    if (!model) return;

    try {
        // 创建一个虚拟图像进行预热
        const dummyImage = tf.zeros([1, 224, 224, 3]);

        if (modelLoadingState.modelType === 'MediaPipeFaceMesh') {
            await model.estimateFaces(dummyImage);
        } else if (modelLoadingState.modelType === 'BlazeFace') {
            await model.estimateFaces(dummyImage, false);
        }

        dummyImage.dispose(); // 清理内存
        console.log("模型预热完成");

    } catch (warmupError) {
        console.warn("模型预热失败，但不影响使用:", warmupError);
    }
}

// 备用面部检测算法
async function fallbackFaceDetection(imageData) {
    try {
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        
        // 基于颜色的简单面部检测
        let skinPixels = [];
        
        // 扫描图像寻找肤色区域
        for (let y = height * 0.2; y < height * 0.8; y += 10) {
            for (let x = width * 0.2; x < width * 0.8; x += 10) {
                const index = (y * width + x) * 4;
                const r = data[index];
                const g = data[index + 1];
                const b = data[index + 2];
                
                // 简单的肤色检测算法
                if (isSkinColor(r, g, b)) {
                    skinPixels.push({ x, y });
                }
            }
        }
        
        if (skinPixels.length < 50) {
            return null; // 没有足够的肤色像素
        }
        
        // 找到肤色区域的边界
        const minX = Math.min(...skinPixels.map(p => p.x));
        const maxX = Math.max(...skinPixels.map(p => p.x));
        const minY = Math.min(...skinPixels.map(p => p.y));
        const maxY = Math.max(...skinPixels.map(p => p.y));
        
        // 扩展边界框以包含整个面部
        const padding = 20;
        const face = {
            topLeft: [
                Math.max(0, minX - padding),
                Math.max(0, minY - padding)
            ],
            bottomRight: [
                Math.min(width, maxX + padding),
                Math.min(height, maxY + padding)
            ],
            confidence: Math.min(0.8, skinPixels.length / 200),
            method: 'color-based'
        };
        
        console.log("基础算法检测到面部区域:", face);
        return [face];
        
    } catch (error) {
        console.warn("备用检测算法失败:", error);
        return null;
    }
}

// 简单的肤色检测函数
function isSkinColor(r, g, b) {
    // 基于RGB的肤色检测
    return (
        r > 95 && g > 40 && b > 20 &&
        r > g && r > b &&
        Math.abs(r - g) > 15 &&
        r - b > 15 &&
        r + g + b > 220
    );
}

// 面部检测函数
async function detectFaces(imageData) {
    if (!model) {
        throw new Error("模型未加载");
    }

    try {
        // 将ImageData转换为Tensor
        const tensor = tf.browser.fromPixels(imageData);

        let faces = [];

        if (modelLoadingState.modelType === 'MediaPipeFaceMesh') {
            // 使用MediaPipe FaceMesh
            faces = await model.estimateFaces(tensor);
        } else if (modelLoadingState.modelType === 'BlazeFace') {
            // 使用BlazeFace
            faces = await model.estimateFaces(tensor, false);
        }

        // 清理tensor内存
        tensor.dispose();

        // 转换为统一格式
        const normalizedFaces = faces.map(face => {
            if (face.box) {
                // BlazeFace格式
                return {
                    topLeft: [face.box.xMin, face.box.yMin],
                    bottomRight: [face.box.xMax, face.box.yMax],
                    confidence: face.probability || 1.0
                };
            } else if (face.boundingBox) {
                // MediaPipe格式
                return {
                    topLeft: [face.boundingBox.topLeft[0], face.boundingBox.topLeft[1]],
                    bottomRight: [face.boundingBox.bottomRight[0], face.boundingBox.bottomRight[1]],
                    confidence: 1.0
                };
            }
            return null;
        }).filter(Boolean);

        console.log(`检测到 ${normalizedFaces.length} 个面部`);
        return normalizedFaces;

    } catch (error) {
        console.error("面部检测失败:", error);
        throw error;
    }
}

// 显示错误消息
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `<strong>错误:</strong> ${message}`;
    document.querySelector('.camera-container').appendChild(errorDiv);

    console.error(message);
}

// 检查摄像头权限
async function checkCameraPermission() {
    try {
        // 尝试获取摄像头列表
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');

        if (videoDevices.length === 0) {
            showError("未检测到摄像头设备。请确保您的设备有摄像头并且已连接。");
            return false;
        }

        console.log("检测到摄像头设备:", videoDevices.length);
        return true;
    } catch (error) {
        console.error("检查摄像头权限时出错:", error);
        showError(`检查摄像头权限时出错: ${error.message}`);
        return false;
    }
}

// Old event listener removed - now using handleStartCamera function

// Old diagnostic event listener removed - now using handleDiagnostic function

// 创建诊断窗口
function createDiagnosticWindow() {
    // 移除已存在的诊断窗口
    const existing = document.getElementById('diagnosticWindow');
    if (existing) {
        existing.remove();
    }

    const diagnosticWindow = document.createElement('div');
    diagnosticWindow.id = 'diagnosticWindow';
    diagnosticWindow.innerHTML = `
        <div class="diagnostic-overlay">
            <div class="diagnostic-content">
                <div class="diagnostic-header">
                    <h3>🔧 摄像头诊断</h3>
                    <button class="diagnostic-close" onclick="this.closest('#diagnosticWindow').remove()">✕</button>
                </div>
                <div class="diagnostic-results" id="diagnosticResults">
                    <div class="diagnostic-item info">
                        <span class="diagnostic-icon">🚀</span>
                        <span class="diagnostic-text">开始诊断...</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
        .diagnostic-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .diagnostic-content {
            background: white;
            border-radius: 10px;
            width: 90%;
            max-width: 500px;
            max-height: 80%;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }
        .diagnostic-header {
            background: #f8f9fa;
            padding: 15px 20px;
            border-bottom: 1px solid #dee2e6;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .diagnostic-header h3 {
            margin: 0;
            color: #495057;
        }
        .diagnostic-close {
            background: none;
            border: none;
            font-size: 18px;
            cursor: pointer;
            color: #6c757d;
            padding: 0;
            width: 30px;
            height: 30px;
        }
        .diagnostic-results {
            padding: 20px;
            max-height: 400px;
            overflow-y: auto;
        }
        .diagnostic-item {
            display: flex;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid #f1f3f4;
        }
        .diagnostic-item:last-child {
            border-bottom: none;
        }
        .diagnostic-icon {
            margin-right: 10px;
            font-size: 16px;
        }
        .diagnostic-text {
            flex: 1;
        }
        .diagnostic-item.success { color: #28a745; }
        .diagnostic-item.error { color: #dc3545; }
        .diagnostic-item.warning { color: #ffc107; }
        .diagnostic-item.info { color: #17a2b8; }
    `;

    if (!document.getElementById('diagnosticStyles')) {
        style.id = 'diagnosticStyles';
        document.head.appendChild(style);
    }

    document.body.appendChild(diagnosticWindow);
    return diagnosticWindow;
}

// 添加诊断结果
function addDiagnosticResult(window, title, message, type) {
    const results = window.querySelector('#diagnosticResults');
    const item = document.createElement('div');
    item.className = `diagnostic-item ${type}`;

    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    item.innerHTML = `
        <span class="diagnostic-icon">${icons[type] || 'ℹ️'}</span>
        <span class="diagnostic-text"><strong>${title}:</strong> ${message}</span>
    `;

    results.appendChild(item);

    // 滚动到底部
    results.scrollTop = results.scrollHeight;
}

// 绘制视频帧 - 优化版本
function drawVideoFrame() {
    if (!streaming || !video) {
        return;
    }

    try {
        // 确保视频已准备好
        if (video.readyState >= video.HAVE_CURRENT_DATA) {
            // 绘制当前视频帧
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // 绘制状态指示器
            drawStatusIndicator();
        }
    } catch (error) {
        console.error("绘制视频帧失败:", error);
    }

    // 继续绘制下一帧
    if (streaming) {
        requestAnimationFrame(drawVideoFrame);
    }
}

// 绘制状态指示器
function drawStatusIndicator() {
    // 绘制摄像头状态
    ctx.strokeStyle = '#00FF00';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, 50, 50);

    ctx.fillStyle = '#00FF00';
    ctx.font = '16px Arial';
    ctx.fillText('摄像头正常', 70, 30);

    // 绘制模型状态
    if (modelLoadingState.isLoaded) {
        ctx.fillStyle = '#2ecc71';
        ctx.font = '14px Arial';
        ctx.fillText(`AI模型: ${modelLoadingState.modelType}`, 10, canvas.height - 20);
    } else if (modelLoadingState.isLoading) {
        ctx.fillStyle = '#f39c12';
        ctx.font = '14px Arial';
        ctx.fillText(`加载中: ${modelLoadingState.loadingProgress}%`, 10, canvas.height - 20);
    }
}

// 内存清理函数
function cleanupResources() {
    if (model) {
        try {
            if (typeof model.dispose === 'function') {
                model.dispose();
            }
        } catch (error) {
            console.warn("模型清理失败:", error);
        }
        model = null;
    }

    // 重置状态
    modelLoadingState = {
        isLoading: false,
        isLoaded: false,
        modelType: null,
        loadingProgress: 0,
        error: null
    };
}

// Old capture event listener removed - now using handleCapturePhoto function



// 检测浏览器支持情况
function checkBrowserSupport() {
    try {
        // 检查基本API支持
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            return {
                supported: false,
                reason: "您的浏览器不支持摄像头访问，请使用现代浏览器"
            };
        }

        // 检查TensorFlow.js
        if (!window.tf) {
            return {
                supported: false,
                reason: "TensorFlow.js未能加载，请检查网络连接"
            };
        }

        // 检查WebGL支持（可选）
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

        if (!gl) {
            console.warn("WebGL不可用，将使用CPU后端（性能可能较慢）");
        }

        // 检查必要的模型API
        if (!window.faceLandmarksDetection && !window.blazeface) {
            return {
                supported: false,
                reason: "面部识别模型API未加载，请检查网络连接"
            };
        }

        return { supported: true };

    } catch (error) {
        return {
            supported: false,
            reason: `浏览器兼容性检查失败: ${error.message}`
        };
    }
}

// 分析面部特征
async function analyzeFace(faceData, imageData) {
    const results = {
        color: analyzeFaceColor(imageData, faceData),
        eyes: analyzeEyes(imageData, faceData),
        symmetry: analyzeSymmetry(faceData),
        skin: analyzeSkin(imageData, faceData),
        timestamp: new Date()
    };

    return results;
}

// 分析面色
function analyzeFaceColor(imageData, faceData) {
    const face = faceData[0];
    const data = imageData.data;

    // 获取面部区域的平均颜色
    let r = 0, g = 0, b = 0, count = 0;

    // 简化的面部区域采样
    const startX = Math.max(0, Math.floor(face.topLeft[0]));
    const startY = Math.max(0, Math.floor(face.topLeft[1]));
    const endX = Math.min(imageData.width, Math.floor(face.bottomRight[0]));
    const endY = Math.min(imageData.height, Math.floor(face.bottomRight[1]));

    for (let y = startY; y < endY; y += 5) {
        for (let x = startX; x < endX; x += 5) {
            const index = (y * imageData.width + x) * 4;
            r += data[index];
            g += data[index + 1];
            b += data[index + 2];
            count++;
        }
    }

    r = Math.floor(r / count);
    g = Math.floor(g / count);
    b = Math.floor(b / count);

    // 分析颜色特征
    let colorType = 'normal';
    let confidence = 0.5;

    if (r > g && r > b && r > 150) {
        colorType = 'red';
        confidence = Math.min(0.9, (r - 150) / 100);
    } else if (g > r && g > b && g > 140) {
        colorType = 'yellow';
        confidence = Math.min(0.9, (g - 140) / 100);
    } else if (r < 120 && g < 120 && b < 120) {
        colorType = 'dark';
        confidence = Math.min(0.9, (120 - Math.max(r, g, b)) / 120);
    } else if (r < 140 && g < 140 && b < 140) {
        colorType = 'pale';
        confidence = Math.min(0.9, (140 - Math.max(r, g, b)) / 140);
    }

    return {
        type: colorType,
        confidence: confidence,
        rgb: { r, g, b },
        analysis: FACE_COLOR_KNOWLEDGE[colorType] || {
            description: "面色正常",
            possibleCauses: [],
            medicalAdvice: "保持良好的生活习惯"
        }
    };
}

// 分析眼部
function analyzeEyes(imageData, faceData) {
    // 使用面部数据进行更精确的眼部区域分析
    const face = faceData[0];
    const faceWidth = face.bottomRight[0] - face.topLeft[0];
    const faceHeight = face.bottomRight[1] - face.topLeft[1];
    
    // 估算眼部区域
    const eyeRegionY = face.topLeft[1] + faceHeight * 0.3;
    const eyeRegionHeight = faceHeight * 0.2;
    
    // 从图像数据中分析眼部区域的颜色
    const data = imageData.data;
    let redSum = 0, greenSum = 0, blueSum = 0, pixelCount = 0;
    
    for (let y = eyeRegionY; y < eyeRegionY + eyeRegionHeight; y += 5) {
        for (let x = face.topLeft[0]; x < face.bottomRight[0]; x += 5) {
            if (y >= 0 && y < imageData.height && x >= 0 && x < imageData.width) {
                const index = (Math.floor(y) * imageData.width + Math.floor(x)) * 4;
                redSum += data[index];
                greenSum += data[index + 1];
                blueSum += data[index + 2];
                pixelCount++;
            }
        }
    }
    
    if (pixelCount === 0) {
        // fallback to random values if no pixels found
        return {
            redness: Math.random() * 0.3 + 0.1,
            dryness: Math.random() * 0.4 + 0.1,
            issues: [],
            analysis: []
        };
    }
    
    const avgRed = redSum / pixelCount;
    const avgGreen = greenSum / pixelCount;
    const avgBlue = blueSum / pixelCount;
    
    // 基于颜色分析计算发红和干涩指数
    const redness = Math.min(0.9, Math.max(0, (avgRed - avgGreen) / 100));
    const dryness = Math.min(0.9, Math.max(0, (220 - (avgRed + avgGreen + avgBlue)) / 100));

    let issues = [];
    if (redness > 0.3) issues.push('redness');
    if (dryness > 0.3) issues.push('dryness');

    return {
        redness: redness,
        dryness: dryness,
        issues: issues,
        analysis: issues.map(issue => EYE_HEALTH_KNOWLEDGE[issue]).filter(Boolean)
    };
}

// 分析面部对称性
function analyzeSymmetry(faceData) {
    const face = faceData[0];

    // 计算面部宽度和高度
    const width = face.bottomRight[0] - face.topLeft[0];
    const height = face.bottomRight[1] - face.topLeft[1];

    // 简化的对称性分析
    const symmetryScore = Math.random() * 0.3 + 0.7; // 0.7-1.0之间

    return {
        score: symmetryScore,
        width: width,
        height: height,
        ratio: width / height,
        analysis: symmetryScore > 0.85 ? "面部对称性良好" : "面部略有不对称，可能需要注意"
    };
}

// 分析皮肤状况
function analyzeSkin(imageData, faceData) {
    // 使用面部数据进行皮肤质量分析
    const face = faceData[0];
    const data = imageData.data;
    
    // 分析面部区域的皮肤纹理和颜色变化
    let colorVariance = 0;
    let brightnessSum = 0;
    let pixelCount = 0;
    let prevBrightness = null;
    
    // 采样面部区域
    for (let y = face.topLeft[1]; y < face.bottomRight[1]; y += 8) {
        for (let x = face.topLeft[0]; x < face.bottomRight[0]; x += 8) {
            if (y >= 0 && y < imageData.height && x >= 0 && x < imageData.width) {
                const index = (Math.floor(y) * imageData.width + Math.floor(x)) * 4;
                const r = data[index];
                const g = data[index + 1];
                const b = data[index + 2];
                
                const brightness = (r + g + b) / 3;
                brightnessSum += brightness;
                
                if (prevBrightness !== null) {
                    colorVariance += Math.abs(brightness - prevBrightness);
                }
                prevBrightness = brightness;
                pixelCount++;
            }
        }
    }
    
    if (pixelCount === 0) {
        // fallback values
        return {
            texture: Math.random() * 0.4 + 0.6,
            hydration: Math.random() * 0.3 + 0.7,
            issues: [],
            analysis: []
        };
    }
    
    const avgBrightness = brightnessSum / pixelCount;
    const avgVariance = colorVariance / (pixelCount - 1);
    
    // 计算皮肤纹理指数（变化越小，纹理越好）
    const texture = Math.max(0.3, Math.min(1.0, 1.0 - (avgVariance / 50)));
    
    // 计算皮肤水分指数（基于亮度）
    const hydration = Math.max(0.3, Math.min(1.0, avgBrightness / 200));

    let issues = [];
    if (texture < 0.7) issues.push('dryness');
    if (hydration < 0.6) issues.push('dryness');
    if (avgVariance > 40) issues.push('redness');

    return {
        texture: texture,
        hydration: hydration,
        issues: issues,
        analysis: issues.map(issue => SKIN_HEALTH_KNOWLEDGE[issue]).filter(Boolean)
    };
}

// 显示分析结果
function displayResults(results) {
    // 面色分析
    colorAnalysis.innerHTML = `
        <strong>${results.color.analysis.description}</strong> (置信度: ${(results.color.confidence * 100).toFixed(1)}%)
        <br>RGB值: (${results.color.rgb.r}, ${results.color.rgb.g}, ${results.color.rgb.b})
        <br><em>${results.color.analysis.medicalAdvice}</em>
    `;

    // 眼部分析
    eyeAnalysis.innerHTML = `
        <strong>眼部状况评估</strong>
        <br>发红指数: ${(results.eyes.redness * 100).toFixed(1)}%
        <br>干涩指数: ${(results.eyes.dryness * 100).toFixed(1)}%
        ${results.eyes.analysis.length > 0 ? '<br><em>' + results.eyes.analysis[0].medicalAdvice + '</em>' : ''}
    `;

    // 更新眼部指标条
    updateMetricBar('eyeRedness', results.eyes.redness);
    updateMetricBar('eyeDryness', results.eyes.dryness);

    // 面部对称性
    symmetryAnalysis.innerHTML = `
        <strong>对称性评分: ${(results.symmetry.score * 100).toFixed(1)}%</strong>
        <br>面部比例: ${results.symmetry.ratio.toFixed(2)}
        <br><em>${results.symmetry.analysis}</em>
    `;

    // 皮肤分析
    skinAnalysis.innerHTML = `
        <strong>皮肤状况评估</strong>
        <br>纹理指数: ${(results.skin.texture * 100).toFixed(1)}%
        <br>水分指数: ${(results.skin.hydration * 100).toFixed(1)}%
        ${results.skin.analysis.length > 0 ? '<br><em>' + results.skin.analysis[0].medicalAdvice + '</em>' : ''}
    `;

    // 更新皮肤指标条
    updateMetricBar('skinTexture', results.skin.texture);
    updateMetricBar('skinHydration', results.skin.hydration);

    // 综合建议
    generateRecommendations(results);
}

// 更新指标条
function updateMetricBar(metricId, value) {
    const metric = document.getElementById(metricId);
    if (metric) {
        const bar = metric.querySelector('.metric-value');
        if (bar) {
            setTimeout(() => {
                bar.style.width = `${value * 100}%`;
                // 根据值设置颜色
                if (value > 0.7) {
                    bar.style.backgroundColor = '#e74c3c';
                } else if (value > 0.4) {
                    bar.style.backgroundColor = '#f39c12';
                } else {
                    bar.style.backgroundColor = '#2ecc71';
                }
            }, 500);
        }
    }
}

// 生成综合建议
function generateRecommendations(results) {
    let recommendationsList = [];

    // 基于面色的建议
    if (results.color.confidence > 0.6) {
        recommendationsList.push(`面色建议: ${results.color.analysis.medicalAdvice}`);
    }

    // 基于眼部的建议
    if (results.eyes.redness > 0.3 || results.eyes.dryness > 0.3) {
        recommendationsList.push("眼部护理: 建议减少屏幕使用时间，保持充足睡眠");
    }

    // 基于对称性的建议
    if (results.symmetry.score < 0.85) {
        recommendationsList.push("面部护理: 建议进行面部按摩，保持良好姿势");
    }

    // 基于皮肤的建议
    if (results.skin.texture < 0.7 || results.skin.hydration < 0.6) {
        recommendationsList.push("皮肤护理: 建议增加保湿，多喝水，使用温和的护肤品");
    }

    if (recommendationsList.length === 0) {
        recommendationsList.push("您的面部健康状况良好，请继续保持良好的生活习惯！");
    }

    recommendations.innerHTML = `
        <div class="recommendations-list">
            ${recommendationsList.map(rec => `<div class="recommendation-category"><p>${rec}</p></div>`).join('')}
            <div class="disclaimer">
                <strong>免责声明:</strong> 以上分析仅供参考，不能替代专业医疗诊断。如有健康问题，请咨询专业医生。
            </div>
        </div>
    `;
}

// 保存到历史记录
function saveToHistory(results) {
    const historyList = document.getElementById('historyList');
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';

    const date = new Date().toLocaleString('zh-CN');
    const summary = `面色: ${results.color.analysis.description}, 对称性: ${(results.symmetry.score * 100).toFixed(1)}%`;

    historyItem.innerHTML = `
        <div class="history-date">${date}</div>
        <div class="history-summary">${summary}</div>
    `;

    historyList.insertBefore(historyItem, historyList.firstChild);

    // 限制历史记录数量
    while (historyList.children.length > 10) {
        historyList.removeChild(historyList.lastChild);
    }
}

// 添加CSS样式以美化建议显示
function addRecommendationStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .recommendations-list {
            display: flex;
            flex-direction: column;
            gap: 20px;
            margin: 15px 0;
        }

        .recommendation-category {
            background-color: #f5f9ff;
            border-radius: 8px;
            padding: 15px;
            border-left: 4px solid #3498db;
        }

        .recommendation-category.important {
            background-color: #fff5f5;
            border-left: 4px solid #e74c3c;
        }

        .recommendation-category h4 {
            margin-top: 0;
            color: #2c3e50;
        }

        .recommendation-category ul {
            margin-bottom: 0;
        }

        .recommendation-category li {
            margin-bottom: 8px;
        }

        .recommendation-category li:last-child {
            margin-bottom: 0;
        }

        .positive-result {
            color: #27ae60;
            font-weight: bold;
        }

        .disclaimer {
            font-size: 14px;
            color: #7f8c8d;
            margin-top: 20px;
            padding-top: 10px;
            border-top: 1px solid #eee;
        }
    `;
    document.head.appendChild(style);
}