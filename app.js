const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');

// UI DOM References
const sleepyTallyDisplay = document.getElementById('sleepyTally');
const earValueDisplay = document.getElementById('earValue');
const marValueDisplay = document.getElementById('marValue');
const toneSelector = document.getElementById('alarmTone');
const sensitivitySlider = document.getElementById('sensitivityRange');

// Arena & Page DOM Elements
const arenaStatus = document.getElementById('arena-status');
const arenaZone = document.getElementById('arenaZone');
const targetNode = document.getElementById('targetNode');
const finalScoreText = document.getElementById('finalScoreText');
const verdictHeadline = document.getElementById('verdictHeadline');

// Structural Core Tracking Parameters
let audioCtx = null;
let alarmInterval = null;
let eyesClosedStartTime = null;
let isLockdownActive = false;
let criticalSlumpCount = 0;
let coreSessionScore = 100;
let exitVerifiedFlag = false;

// Real-Time Sparkline Wave Array Metrics
const sparkCanvas = document.getElementById('sparklineCanvas');
const sparkCtx = sparkCanvas.getContext('2d');
let earHistory = new Array(60).fill(0.25);

// Long-term Productivity Log for final analysis graph
let sessionProductivityTimeline = [];
const auditCanvas = document.getElementById('sessionAuditCanvas');
const auditCtx = auditCanvas.getContext('2d');

function resizeSparkline() {
    sparkCanvas.width = sparkCanvas.parentElement.clientWidth;
    sparkCanvas.height = sparkCanvas.parentElement.clientHeight;
}
window.addEventListener('resize', resizeSparkline);
resizeSparkline();

function drawSparkline(val) {
    earHistory.push(val);
    earHistory.shift();
    sparkCtx.clearRect(0, 0, sparkCanvas.width, sparkCanvas.height);
    
    sparkCtx.strokeStyle = isLockdownActive ? '#ff2a74' : '#b026ff';
    sparkCtx.lineWidth = 3;
    sparkCtx.beginPath();
    
    const step = sparkCanvas.width / (earHistory.length - 1);
    for(let i=0; i<earHistory.length; i++) {
        const y = sparkCanvas.height - ((earHistory[i] - 0.1) / 0.35) * sparkCanvas.height;
        if(i === 0) sparkCtx.moveTo(0, y);
        else sparkCtx.lineTo(i * step, y);
    }
    sparkCtx.stroke();
}

// Custom Render Engine for Session Timeline Audit Chart
function drawSessionAuditChart() {
    auditCanvas.width = auditCanvas.parentElement.clientWidth;
    auditCanvas.height = auditCanvas.parentElement.clientHeight;
    
    auditCtx.clearRect(0, 0, auditCanvas.width, auditCanvas.height);
    
    if (sessionProductivityTimeline.length === 0) return;

    // Draw Grid Lines
    auditCtx.strokeStyle = 'rgba(255, 230, 242, 0.05)';
    auditCtx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
        let yLine = (auditCanvas.height / 4) * i;
        auditCtx.beginPath();
        auditCtx.moveTo(0, yLine);
        auditCtx.lineTo(auditCanvas.width, yLine);
        auditCtx.stroke();
    }

    // Draw Performance Path Line
    auditCtx.strokeStyle = '#00f2fe';
    auditCtx.lineWidth = 3;
    auditCtx.beginPath();

    const horizontalStep = auditCanvas.width / (sessionProductivityTimeline.length === 1 ? 1 : sessionProductivityTimeline.length - 1);
    
    for (let i = 0; i < sessionProductivityTimeline.length; i++) {
        // Map score values (0 - 100) down vertical coordinate plane smoothly
        const yCoord = auditCanvas.height - (sessionProductivityTimeline[i] / 100) * (auditCanvas.height - 20) - 10;
        const xCoord = i * horizontalStep;
        
        if (i === 0) auditCtx.moveTo(xCoord, yCoord);
        else auditCtx.lineTo(xCoord, yCoord);
    }
    auditCtx.stroke();

    // Fill area gradient layout under productivity path line
    let gradientFill = auditCtx.createLinearGradient(0, 0, 0, auditCanvas.height);
    gradientFill.addColorStop(0, 'rgba(0, 242, 254, 0.2)');
    gradientFill.addColorStop(1, 'rgba(176, 38, 255, 0)');
    auditCtx.fillStyle = gradientFill;
    
    auditCtx.lineTo((sessionProductivityTimeline.length - 1) * horizontalStep, auditCanvas.height);
    auditCtx.lineTo(0, auditCanvas.height);
    auditCtx.closePath();
    auditCtx.fill();
}

// Log data performance index snapshots every 3 seconds
setInterval(() => {
    if (!exitVerifiedFlag) {
        sessionProductivityTimeline.push(coreSessionScore);
        if (sessionProductivityTimeline.length > 100) sessionProductivityTimeline.shift();
    }
}, 3000);

// Client Side Router Switches
function switchView(targetViewId) {
    document.querySelectorAll('.app-view').forEach(view => view.classList.remove('active-view'));
    document.querySelectorAll('nav button').forEach(btn => btn.classList.remove('active-nav'));
    
    document.getElementById(targetViewId).classList.add('active-view');
    
    if (targetViewId === 'view-dashboard') document.getElementById('nav-dash').classList.add('active-nav');
    if (targetViewId === 'view-arena') document.getElementById('nav-arena').classList.add('active-nav');
    if (targetViewId === 'view-report') {
        document.getElementById('nav-report').classList.add('active-nav');
        compileAuditReportData();
        setTimeout(drawSessionAuditChart, 50); // Delay execution ensuring layout dimensions sync cleanly
    }
}

// Audio Synthesizer Controls
function triggerLockdownSequence(reasonText) {
    if (alarmInterval) return;
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    isLockdownActive = true;
    document.body.classList.add('lockdown-active');
    
    criticalSlumpCount++;
    sleepyTallyDisplay.innerText = criticalSlumpCount;
    coreSessionScore = Math.max(0, coreSessionScore - 12);

    switchView('view-arena');
    arenaStatus.innerText = `🚨 CRITICAL LOCKDOWN: ${reasonText} DETECTED!`;
    spawnReflexTarget();

    alarmInterval = setInterval(() => {
        let osc = audioCtx.createOscillator();
        let gain = audioCtx.createGain();
        osc.type = toneSelector.value;
        osc.frequency.setValueAtTime(950, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
    }, 300);
}

function spawnReflexTarget() {
    const maxX = arenaZone.clientWidth - 60;
    const maxY = arenaZone.clientHeight - 60;
    
    const randomX = Math.floor(Math.random() * maxX) + 30;
    const randomY = Math.floor(Math.random() * maxY) + 30;
    
    targetNode.style.left = `${randomX}px`;
    targetNode.style.top = `${randomY}px`;
    targetNode.style.display = 'block';
}

function hitReflexTarget() {
    if (!isLockdownActive) return;
    
    targetNode.style.display = 'none';
    clearInterval(alarmInterval);
    alarmInterval = null;
    isLockdownActive = false;
    document.body.classList.remove('lockdown-active');
    
    arenaStatus.innerText = "System Restored. Bio-Feedback Stable.";
    setTimeout(() => { switchView('view-dashboard'); }, 800);
}

function getDistance(p1, p2) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

function trackBiometrics(results) {
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];

        const eTop = landmarks[159], eBottom = landmarks[145];
        const eLeft = landmarks[33], eRight = landmarks[133];
        const ear = getDistance(eTop, eBottom) / getDistance(eLeft, eRight);

        const mTop = landmarks[13], mBottom = landmarks[14];
        const mLeft = landmarks[78], mRight = landmarks[308];
        const mar = getDistance(mTop, mBottom) / getDistance(mLeft, mRight);

        earValueDisplay.innerText = ear.toFixed(2);
        marValueDisplay.innerText = mar.toFixed(2);
        drawSparkline(ear);

        if (isLockdownActive) return;

        const earLimit = parseFloat(sensitivitySlider.value) / 100;

        if (mar > 0.85) {
            triggerLockdownSequence("YAWN EXPRESSION");
            return;
        }

        if (ear < earLimit) {
            if (!eyesClosedStartTime) {
                eyesClosedStartTime = Date.now();
            } else if (Date.now() - eyesClosedStartTime > 1400) {
                triggerLockdownSequence("DROWSY PROFILE");
            }
        } else {
            eyesClosedStartTime = null;
        }
    }
}

const faceMesh = new FaceMesh({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
});
faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
faceMesh.onResults(trackBiometrics);

const camera = new Camera(videoElement, {
    onFrame: async () => { await faceMesh.send({ image: videoElement }); },
    width: 640, height: 480
});
camera.start();

function compileAuditReportData() {
    finalScoreText.innerText = `${coreSessionScore}%`;
    let statusSummary = "Optimal Readiness Architecture";
    if (coreSessionScore < 80) statusSummary = "Fatigue Stress Detected";
    if (coreSessionScore < 50) statusSummary = "Severe Neural Depletion. Sleep Advised.";
    verdictHeadline.innerText = statusSummary;
}

window.addEventListener('beforeunload', (e) => {
    if (!exitVerifiedFlag) {
        e.preventDefault();
        e.returnValue = '';
        switchView('view-report');
    }
});

function terminateSession() {
    exitVerifiedFlag = true;
    window.close();
    alert("Session data safely compiled. Core tracking ended.");
}
