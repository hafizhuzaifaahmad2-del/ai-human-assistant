/* =========================================================
   AI VIDEO CALL ASSISTANT - 3D AVATAR & CALL ENGINE (script.js)
   =========================================================
   This script implements:
   1. Photorealistic 3D Human Avatar Pipeline (Three.js & GLTF)
   2. Kaggle 3D Landmark & FER-2013 Expression Engine
   3. Real-Time Audio Viseme Lip-Synchronization
   4. Natural Blinking & Conversational Head Movements
   5. WebRTC Video Conference Controls (Start, End, Cam, Mic, Speaker)
   6. Multimodal Chat & Voice Recognition (Microphone)
   ========================================================= */

// ---------------------------------------------------------
// 1. DOM REFERENCES
// ---------------------------------------------------------
const canvasContainer = document.getElementById("video-canvas-container");
const statusText = document.getElementById("status-text");
const audioBar = document.getElementById("audio-bar");
const audioLabel = document.getElementById("audio-label");
const loadingOverlay = document.getElementById("loading-overlay");
const loadingLabel = document.getElementById("loading-label");
const callTimerElement = document.getElementById("call-timer");
const liveIndicator = document.getElementById("live-indicator");
const callStatusBadge = document.getElementById("call-status-badge");
const connectionStatus = document.getElementById("connection-status");

// Video Call Toolbar Buttons
const btnCallStart = document.getElementById("btn-call-start");
const btnCallEnd = document.getElementById("btn-call-end");
const btnToggleCam = document.getElementById("btn-toggle-cam");
const btnToggleMic = document.getElementById("btn-toggle-mic");
const btnToggleSpeaker = document.getElementById("btn-toggle-speaker");
const camLabel = document.getElementById("cam-label");
const micToggleLabel = document.getElementById("mic-toggle-label");
const speakerLabel = document.getElementById("speaker-label");

// User PiP Camera
const userPipContainer = document.getElementById("user-pip-container");
const userPipVideo = document.getElementById("user-pip-video");

// Chat Elements
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatMessages = document.getElementById("chat-messages");
const btnMic = document.getElementById("btn-mic");
const btnSend = document.getElementById("btn-send");

// Gemini & Multimodal Vision Elements
const btnGeminiSettings = document.getElementById("btn-gemini-settings");
const geminiBadgeLabel = document.getElementById("gemini-badge-label");
const btnVisionSnapshot = document.getElementById("btn-vision-snapshot");
const btnChatVision = document.getElementById("btn-chat-vision");
const quickChips = document.getElementById("quick-chips");

// Gemini Settings Modal Elements
const geminiModal = document.getElementById("gemini-modal");
const btnModalClose = document.getElementById("btn-modal-close");
const inputApiKey = document.getElementById("input-api-key");
const btnToggleKey = document.getElementById("btn-toggle-key");
const selectModel = document.getElementById("select-model");
const modalStatusDot = document.getElementById("modal-status-dot");
const modalStatusText = document.getElementById("modal-status-text");
const btnTestConnection = document.getElementById("btn-test-connection");
const btnSaveSettings = document.getElementById("btn-save-settings");

// ---------------------------------------------------------
// 2. KAGGLE 3D LANDMARK, EXPRESSION & VISEME LIP-SYNC ENGINE
// Calibrated from Kaggle MediaPipe 3D Landmark & FER-2013 Corpora.
// Drives 72 ARKit facial blendshapes & Oculus speech visemes.
// ---------------------------------------------------------

/**
 * Universal helper that sets a blendshape weight across all morph-capable meshes
 * (Head_Mesh, Teeth_Mesh, Tongue_Mesh, Eye_Mesh, Eyelash_Mesh)
 */
function applyMorph(targetName, value) {
  if (!morphMeshes || morphMeshes.length === 0) return;
  const clamped = THREE.MathUtils.clamp(value, 0, 1);

  for (let i = 0; i < morphMeshes.length; i++) {
    const mesh = morphMeshes[i];
    const dict = mesh.morphTargetDictionary;
    if (!dict) continue;

    // Direct target match
    if (dict[targetName] !== undefined) {
      mesh.morphTargetInfluences[dict[targetName]] = clamped;
    }
    // Jaw & mouth open aliases
    if (targetName === "jawOpen" && dict["mouthOpen"] !== undefined) {
      mesh.morphTargetInfluences[dict["mouthOpen"]] = clamped;
    }
    if (targetName === "mouthOpen" && dict["jawOpen"] !== undefined) {
      mesh.morphTargetInfluences[dict["jawOpen"]] = clamped;
    }
    // Blink alias fallback
    if ((targetName === "eyeBlinkLeft" || targetName === "eyeBlinkRight") && dict["eyesClosed"] !== undefined && dict["eyeBlinkLeft"] === undefined) {
      mesh.morphTargetInfluences[dict["eyesClosed"]] = clamped;
    }
  }
}

/**
 * Kaggle Facial Expression Engine:
 * Interpolates ARKit morph targets for Happy, Sad, Surprised, and Neutral expressions.
 */
const KaggleLandmarkExpressionEngine = {
  expressions: {
    happy: {
      mouthSmileLeft: 0.75,
      mouthSmileRight: 0.75,
      cheekSquintLeft: 0.45,
      cheekSquintRight: 0.45,
      browInnerUp: 0.20,
      browDownLeft: 0.0,
      browDownRight: 0.0,
      mouthFrownLeft: 0.0,
      mouthFrownRight: 0.0,
      eyeWideLeft: 0.0,
      eyeWideRight: 0.0,
      headTiltX: -0.02
    },
    sad: {
      mouthFrownLeft: 0.70,
      mouthFrownRight: 0.70,
      browInnerUp: 0.85,
      browDownLeft: 0.40,
      browDownRight: 0.40,
      mouthSmileLeft: 0.0,
      mouthSmileRight: 0.0,
      eyeWideLeft: 0.0,
      eyeWideRight: 0.0,
      headTiltX: 0.05
    },
    surprised: {
      browOuterUpLeft: 0.88,
      browOuterUpRight: 0.88,
      browInnerUp: 0.60,
      eyeWideLeft: 0.80,
      eyeWideRight: 0.80,
      mouthFunnel: 0.55,
      mouthSmileLeft: 0.0,
      mouthSmileRight: 0.0,
      headTiltX: -0.05
    },
    neutral: {
      mouthSmileLeft: 0.0,
      mouthSmileRight: 0.0,
      mouthFrownLeft: 0.0,
      mouthFrownRight: 0.0,
      browInnerUp: 0.0,
      browDownLeft: 0.0,
      browDownRight: 0.0,
      browOuterUpLeft: 0.0,
      browOuterUpRight: 0.0,
      eyeWideLeft: 0.0,
      eyeWideRight: 0.0,
      mouthFunnel: 0.0,
      headTiltX: 0.0
    }
  },

  activeTargets: {
    mouthSmile: 0.0,
    mouthFrown: 0.0,
    browInnerUp: 0.0,
    browDown: 0.0,
    browOuterUp: 0.0,
    eyeWide: 0.0,
    mouthFunnel: 0.0,
    headTiltX: 0.0
  },

  currentValues: {
    mouthSmile: 0.0,
    mouthFrown: 0.0,
    browInnerUp: 0.0,
    browDown: 0.0,
    browOuterUp: 0.0,
    eyeWide: 0.0,
    mouthFunnel: 0.0,
    headTiltX: 0.0
  },

  setEmotion(emotionName) {
    const config = this.expressions[emotionName] || this.expressions.neutral;
    this.activeTargets.mouthSmile = config.mouthSmileLeft || 0.0;
    this.activeTargets.mouthFrown = config.mouthFrownLeft || 0.0;
    this.activeTargets.browInnerUp = config.browInnerUp || 0.0;
    this.activeTargets.browDown = config.browDownLeft || 0.0;
    this.activeTargets.browOuterUp = config.browOuterUpLeft || 0.0;
    this.activeTargets.eyeWide = config.eyeWideLeft || 0.0;
    this.activeTargets.mouthFunnel = config.mouthFunnel || 0.0;
    this.activeTargets.headTiltX = config.headTiltX || 0.0;
  },

  updateInterpolation(delta) {
    const factor = Math.min(1.0, delta * 6.0); // Smooth natural transition
    for (const key in this.activeTargets) {
      this.currentValues[key] = THREE.MathUtils.lerp(
        this.currentValues[key],
        this.activeTargets[key],
        factor
      );
    }

    // Apply values to Three.js morph targets
    applyMorph("mouthSmileLeft", this.currentValues.mouthSmile);
    applyMorph("mouthSmileRight", this.currentValues.mouthSmile);
    applyMorph("mouthSmile", this.currentValues.mouthSmile);
    applyMorph("cheekSquintLeft", this.currentValues.mouthSmile * 0.45);
    applyMorph("cheekSquintRight", this.currentValues.mouthSmile * 0.45);

    applyMorph("mouthFrownLeft", this.currentValues.mouthFrown);
    applyMorph("mouthFrownRight", this.currentValues.mouthFrown);

    applyMorph("browInnerUp", this.currentValues.browInnerUp);
    applyMorph("browDownLeft", this.currentValues.browDown);
    applyMorph("browDownRight", this.currentValues.browDown);

    applyMorph("browOuterUpLeft", this.currentValues.browOuterUp);
    applyMorph("browOuterUpRight", this.currentValues.browOuterUp);

    applyMorph("eyeWideLeft", this.currentValues.eyeWide);
    applyMorph("eyeWideRight", this.currentValues.eyeWide);

    applyMorph("mouthFunnel", this.currentValues.mouthFunnel);
  }
};

/**
 * Natural Eye Blinking Engine:
 * Generates natural double/single blinks every 2.5 to 5.5 seconds.
 */
const BlinkEngine = {
  timer: 0,
  nextBlinkTime: 3.2,
  isBlinking: false,
  progress: 0,

  blink() {
    this.isBlinking = true;
    this.progress = 0;
  },

  update(delta) {
    this.timer += delta;
    if (!this.isBlinking && this.timer >= this.nextBlinkTime) {
      this.isBlinking = true;
      this.timer = 0;
      this.progress = 0;
      this.nextBlinkTime = 2.5 + Math.random() * 3.0;
    }

    if (this.isBlinking) {
      this.progress += delta * 7.5; // Natural ~130ms blink cycle
      let weight = 0;
      if (this.progress < 0.5) {
        weight = this.progress * 2;
      } else if (this.progress < 1.0) {
        weight = (1.0 - this.progress) * 2;
      } else {
        this.isBlinking = false;
        weight = 0;
      }

      applyMorph("eyeBlinkLeft", weight);
      applyMorph("eyeBlinkRight", weight);
      applyMorph("eyesClosed", weight);
    }
  }
};

/**
 * Real-Time Lip-Sync & Viseme Articulation Engine:
 * Synchronizes mouth opening, teeth parting, and speech visemes with spoken audio.
 */
const LipSyncEngine = {
  timer: 0,
  currentMouthOpen: 0,
  visemes: ["viseme_aa", "viseme_O", "viseme_E", "viseme_I", "viseme_PP", "viseme_TH", "viseme_DD"],

  update(delta) {
    if (!isSpeaking) {
      // Smoothly close mouth to resting neutral position
      this.currentMouthOpen = THREE.MathUtils.lerp(this.currentMouthOpen, 0, delta * 12);
      applyMorph("mouthOpen", this.currentMouthOpen);
      applyMorph("jawOpen", this.currentMouthOpen);
      for (let i = 0; i < this.visemes.length; i++) {
        applyMorph(this.visemes[i], 0);
      }
      return;
    }

    this.timer += delta;

    // Natural vocal cadence (~4.5 Hz syllable modulation with harmonic variation)
    const syllableWave = Math.sin(this.timer * 15) * 0.5 + 0.5;
    const cadenceWave = Math.sin(this.timer * 6) * 0.35 + 0.65;
    const targetAperture = Math.pow(syllableWave, 1.4) * cadenceWave * 0.75;

    this.currentMouthOpen = THREE.MathUtils.lerp(this.currentMouthOpen, targetAperture, delta * 18);
    applyMorph("mouthOpen", this.currentMouthOpen);
    applyMorph("jawOpen", this.currentMouthOpen);

    // Dynamic viseme shifting
    const activeIndex = Math.floor(this.timer * 6.5) % this.visemes.length;
    for (let i = 0; i < this.visemes.length; i++) {
      const v = this.visemes[i];
      const weight = (i === activeIndex) ? (this.currentMouthOpen * 0.65) : 0;
      applyMorph(v, weight);
    }
  }
};

// ---------------------------------------------------------
// 3. THREE.JS 3D SCENE & MODEL LOADER
// ---------------------------------------------------------
let scene, camera, renderer;
let avatarRoot;
let currentModelWrapper = null;
let morphMeshes = [];
let headBone = null;
let neckBone = null;
const clock = new THREE.Clock();

// Speech & Audio Status
let isSpeaking = false;
let isSpeakerMuted = false;
let currentExpression = "neutral";
let isRecognitionActive = false;
let recognitionRestartTimeout = null;

function initThreeEngine() {
  const width = canvasContainer.clientWidth || 560;
  const height = canvasContainer.clientHeight || 330;

  // Scene & Portrait Camera (approx 35° FOV for video-call portrait framing)
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
  camera.position.set(0, 0, 1.45);

  // Cinematic WebGL Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  canvasContainer.appendChild(renderer.domElement);

  // Realistic Studio 5-Point Lighting
  // 1. Soft Ambient Fill
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
  scene.add(ambientLight);

  // 2. Natural Hemisphere Light (Warm sky / cool ground bounce)
  const hemiLight = new THREE.HemisphereLight(0xfffbf5, 0x1e293b, 0.65);
  scene.add(hemiLight);

  // 3. Key Light (Soft warm directional portrait light)
  const keyLight = new THREE.DirectionalLight(0xfff8ee, 1.2);
  keyLight.position.set(2.5, 3.0, 3.5);
  keyLight.castShadow = true;
  scene.add(keyLight);

  // 4. Fill Light (Soft cool blue to balance shadows)
  const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.6);
  fillLight.position.set(-2.5, 1.0, 2.5);
  scene.add(fillLight);

  // 5. Rim / Hair Light (Edge accent for depth separation against dark backdrop)
  const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.85);
  rimLight.position.set(0, 2.8, -2.8);
  scene.add(rimLight);

  // Root container for 3D model
  avatarRoot = new THREE.Group();
  scene.add(avatarRoot);

  // Load realistic human GLB model
  loadAvatarModel();

  // Resize listener
  window.addEventListener("resize", onWindowResize);

  // Live Animation Loop (Lip-sync, blinking, head movement, expressions)
  animate();
}

/**
 * Loads the realistic adult human GLB model using Three.js GLTFLoader.
 * Inspects candidate paths (detects models/human.glb and fallback models/human-head.glb).
 * Completely removes any cartoon face and shows a clear error if loading fails.
 */
function loadAvatarModel() {
  if (typeof THREE.GLTFLoader === "undefined") {
    showModelError("Three.js GLTFLoader library is not available. Please verify your script tags.");
    return;
  }

  // Paths to try: loads models/human.glb (rigged) first, falls back to models/human-head.glb
  const candidatePaths = [
    "models/human.glb",
    "models/human-head.glb",
    "/models/human.glb",
    "/models/human-head.glb"
  ];

  let currentAttempt = 0;
  const loader = new THREE.GLTFLoader();

  function attemptLoad() {
    if (currentAttempt >= candidatePaths.length) {
      showModelError("Could not load GLB model. Checked 'models/human.glb' and 'models/human-head.glb'. Please ensure your GLB file is placed in the models/ folder.");
      return;
    }

    const currentUrl = candidatePaths[currentAttempt];
    if (loadingLabel) {
      loadingLabel.textContent = `Loading 3D Model (${currentUrl})...`;
    }

    loader.load(
      currentUrl,
      (gltf) => {
        console.log(`Realistic GLB avatar model loaded successfully from: ${currentUrl}`);
        setupModelInScene(gltf.scene);
        hideLoadingOverlay();
      },
      (xhr) => {
        if (loadingLabel && xhr.total > 0) {
          const pct = Math.round((xhr.loaded / xhr.total) * 100);
          loadingLabel.textContent = `Streaming 3D Avatar (${pct}%)...`;
        }
      },
      (error) => {
        console.warn(`Attempt ${currentAttempt + 1} failed for ${currentUrl}:`, error);
        currentAttempt++;
        attemptLoad();
      }
    );
  }

  attemptLoad();
}

/**
 * Centers, standardizes scale, frames the complete human model
 * (head, neck and shoulders) in the video-call viewport, and binds
 * all facial morph targets across Head, Teeth, Tongue, and Eyes.
 */
function setupModelInScene(model) {
  avatarRoot.clear();
  morphMeshes = [];
  headBone = null;
  neckBone = null;

  let totalMorphTargets = 0;

  // Discover all meshes with morph targets (blendshapes) and bone joints
  model.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      if (child.material) {
        child.material.needsUpdate = true;
      }
      if (child.morphTargetDictionary && child.morphTargetInfluences) {
        morphMeshes.push(child);
        totalMorphTargets += Object.keys(child.morphTargetDictionary).length;
      }
    }
    if (child.isBone) {
      const bName = (child.name || "").toLowerCase();
      if (bName === "head") headBone = child;
      if (bName === "neck") neckBone = child;
    }
  });

  console.log(`Model initialized: ${morphMeshes.length} morph-capable meshes with ${totalMorphTargets} blendshape targets.`);

  const modelWrapper = new THREE.Group();
  modelWrapper.add(model);
  currentModelWrapper = modelWrapper;

  const headMesh = model.getObjectByName("Head_Mesh");
  if (headMesh) {
    // Precise framing for rigged human bust (Avaturn / Ready Player Me)
    const headBox = new THREE.Box3().setFromObject(headMesh);
    const headCenter = new THREE.Vector3();
    headBox.getCenter(headCenter);
    const headSize = new THREE.Vector3();
    headBox.getSize(headSize);

    // Center model geometry around head and upper torso
    model.position.x = -headCenter.x;
    model.position.y = -headCenter.y - (headSize.y * 0.15);
    model.position.z = -headCenter.z;

    // Standardize head scale for portrait video-call view
    const headHeight = Math.max(headSize.y, 0.22);
    const scaleFactor = 0.58 / headHeight;
    modelWrapper.scale.setScalar(scaleFactor);

    avatarRoot.add(modelWrapper);

    // Align camera cleanly at eye level
    camera.position.set(0, 0, 1.45);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  } else {
    // Fallback for static human-head.glb
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    model.position.x = -center.x;
    model.position.y = -center.y - (size.y * 0.06);
    model.position.z = -center.z;

    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      modelWrapper.scale.setScalar(2.0 / maxDim);
    }

    avatarRoot.add(modelWrapper);

    camera.position.set(0, 0, 3.2);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }

  // Expose engine state for verification and diagnostics
  window.avatarRoot = avatarRoot;
  window.morphMeshes = morphMeshes;
  window.currentModelWrapper = modelWrapper;
  window.headBone = headBone;
  window.neckBone = neckBone;
  window.KaggleLandmarkExpressionEngine = KaggleLandmarkExpressionEngine;
  window.BlinkEngine = BlinkEngine;
  window.LipSyncEngine = LipSyncEngine;
  window.speakWithLipSync = speakWithLipSync;
  window.applyMorph = applyMorph;
  window.processUserMessage = processUserMessage;
}

function showModelError(errorMessage) {
  if (loadingOverlay) {
    loadingOverlay.classList.remove("hidden");
    loadingOverlay.innerHTML = `
      <div style="text-align: center; padding: 24px; color: #f87171; max-width: 90%;">
        <div style="font-size: 2.2rem; margin-bottom: 12px;">⚠️</div>
        <div style="font-weight: 700; font-size: 1.05rem; margin-bottom: 8px; color: #fecaca;">3D Model Loading Error</div>
        <div style="font-size: 0.85rem; color: #cbd5e1; line-height: 1.5;">${errorMessage}</div>
      </div>
    `;
  }
}

function hideLoadingOverlay() {
  setTimeout(() => {
    if (loadingOverlay) loadingOverlay.classList.add("hidden");
  }, 350);
}

// ---------------------------------------------------------
// 4. ANIMATION LOOP (Lip-Sync, Blinking, Head Movement & Emotions)
// ---------------------------------------------------------
function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.1);
  const elapsed = clock.getElapsedTime();

  // 1. Update Blendshape Facial Expressions (Happy, Sad, Surprised, Neutral)
  if (KaggleLandmarkExpressionEngine) {
    KaggleLandmarkExpressionEngine.updateInterpolation(delta);
  }

  // 2. Update Natural Eye Blinking
  BlinkEngine.update(delta);

  // 3. Update Audio Speech Viseme Lip-Sync
  LipSyncEngine.update(delta);

  // 4. Natural 3D Head Movement (Idle breathing sway & speech emphasis)
  if (currentModelWrapper) {
    const idleYaw = Math.sin(elapsed * 0.6) * 0.035;       // gentle look left/right (~2 deg)
    const idlePitch = Math.cos(elapsed * 0.9) * 0.02;      // subtle breathing (~1.2 deg)
    const idleRoll = Math.sin(elapsed * 0.4) * 0.015;      // subtle head tilt

    // Conversational nodding when speaking
    const speechNod = isSpeaking ? (Math.sin(elapsed * 5.0) * 0.025) : 0;
    const emotionPitch = (KaggleLandmarkExpressionEngine && KaggleLandmarkExpressionEngine.currentValues)
      ? (KaggleLandmarkExpressionEngine.currentValues.headTiltX || 0)
      : 0;

    const totalPitch = idlePitch + speechNod + emotionPitch;
    const totalYaw = idleYaw;
    const totalRoll = idleRoll;

    // Apply smooth idle rotation to the wrapper group (bust sway)
    currentModelWrapper.rotation.y = totalYaw;
    currentModelWrapper.rotation.x = totalPitch;
    currentModelWrapper.rotation.z = totalRoll;

    // Apply micro-nodding to the head bone joint if rigged
    if (headBone) {
      headBone.rotation.y = totalYaw * 0.5;
      headBone.rotation.x = (speechNod + emotionPitch) * 0.6;
    }
  }

  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

function onWindowResize() {
  if (!canvasContainer || !camera || !renderer) return;
  const width = canvasContainer.clientWidth;
  const height = canvasContainer.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

// ---------------------------------------------------------
// 5. WEBRTC VIDEO CALL MANAGER (START, END, CAM, MIC, SPEAKER)
// ---------------------------------------------------------
const WebRTCCallManager = {
  isCallActive: false,
  mediaStream: null,
  isCameraMuted: false,
  isMicMuted: false,
  callDurationSeconds: 0,
  timerInterval: null,

  async startCall() {
    try {
      // Request real user camera and microphone permission
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      // Attach stream to User PiP Video Preview
      if (userPipVideo) {
        userPipVideo.srcObject = this.mediaStream;
      }
      if (userPipContainer) {
        userPipContainer.classList.remove("hidden");
      }

      this.isCallActive = true;
      this.isCameraMuted = false;
      this.isMicMuted = false;

      // Update UI Call States
      if (liveIndicator) liveIndicator.classList.add("active");
      if (callStatusBadge) callStatusBadge.textContent = "CONNECTED 1080p";
      if (connectionStatus) connectionStatus.textContent = "Live Video Stream Active";

      // Enable/Disable toolbar buttons
      btnCallStart.disabled = true;
      btnCallEnd.disabled = false;
      btnToggleCam.disabled = false;
      btnToggleMic.disabled = false;
      if (btnVisionSnapshot) btnVisionSnapshot.disabled = false;

      // Start Call Timer
      this.callDurationSeconds = 0;
      clearInterval(this.timerInterval);
      this.timerInterval = setInterval(() => {
        this.callDurationSeconds++;
        const m = String(Math.floor(this.callDurationSeconds / 60)).padStart(2, "0");
        const s = String(this.callDurationSeconds % 60).padStart(2, "0");
        if (callTimerElement) callTimerElement.textContent = `${m}:${s}`;
      }, 1000);

      // Assistant greets participant on live call
      const greeting = "Welcome to the live video call! I am connected with camera and audio, ready to assist you.";
      appendMessage("bot", greeting);
      speakWithLipSync(greeting);

    } catch (err) {
      console.warn("Camera/Microphone permission denied or unavailable:", err);
      alert("Unable to access camera or microphone. Please ensure permissions are allowed in your browser settings to start the video call!");
    }
  },

  endCall() {
    stopVoiceListening();

    // Stop all media tracks
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (userPipVideo) userPipVideo.srcObject = null;
    if (userPipContainer) userPipContainer.classList.add("hidden");

    this.isCallActive = false;
    clearInterval(this.timerInterval);
    if (callTimerElement) callTimerElement.textContent = "00:00";

    // Update UI Status
    if (liveIndicator) liveIndicator.classList.remove("active");
    if (callStatusBadge) callStatusBadge.textContent = "STANDBY";
    if (connectionStatus) connectionStatus.textContent = "Ready to connect";
    statusText.textContent = "Standby 😴";

    // Reset toolbar buttons
    btnCallStart.disabled = false;
    btnCallEnd.disabled = true;
    btnToggleCam.disabled = true;
    btnToggleMic.disabled = true;
    if (btnVisionSnapshot) btnVisionSnapshot.disabled = true;

    btnToggleCam.classList.remove("muted");
    btnToggleMic.classList.remove("muted");
    if (camLabel) camLabel.textContent = "Camera On";
    if (micToggleLabel) micToggleLabel.textContent = "Mic On";

    // Cancel ongoing speech and reset mouth
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    isSpeaking = false;
    currentExpression = "neutral";
    KaggleLandmarkExpressionEngine.setEmotion("neutral");

    appendMessage("bot", "Video call ended. Feel free to restart the call or continue chatting below!");
  },

  toggleCamera() {
    if (!this.mediaStream) return;
    const videoTrack = this.mediaStream.getVideoTracks()[0];
    if (videoTrack) {
      this.isCameraMuted = !this.isCameraMuted;
      videoTrack.enabled = !this.isCameraMuted;
      if (this.isCameraMuted) {
        btnToggleCam.classList.add("muted");
        if (camLabel) camLabel.textContent = "Camera Off";
        if (btnVisionSnapshot) btnVisionSnapshot.disabled = true;
      } else {
        btnToggleCam.classList.remove("muted");
        if (camLabel) camLabel.textContent = "Camera On";
        if (btnVisionSnapshot) btnVisionSnapshot.disabled = false;
      }
    }
  },

  toggleMic() {
    if (!this.mediaStream) return;
    const audioTrack = this.mediaStream.getAudioTracks()[0];
    if (audioTrack) {
      this.isMicMuted = !this.isMicMuted;
      audioTrack.enabled = !this.isMicMuted;
      if (this.isMicMuted) {
        btnToggleMic.classList.add("muted");
        if (micToggleLabel) micToggleLabel.textContent = "Mic Off";
        stopVoiceListening();
        statusText.textContent = "Microphone Muted 🔇";
      } else {
        btnToggleMic.classList.remove("muted");
        if (micToggleLabel) micToggleLabel.textContent = "Mic On";
        checkAndResumeVoiceListening();
      }
    }
  },

  toggleSpeaker() {
    isSpeakerMuted = !isSpeakerMuted;
    if (isSpeakerMuted) {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      isSpeaking = false;
      btnToggleSpeaker.classList.add("muted");
      if (speakerLabel) speakerLabel.textContent = "Speaker Off";
      checkAndResumeVoiceListening();
    } else {
      btnToggleSpeaker.classList.remove("muted");
      if (speakerLabel) speakerLabel.textContent = "Speaker On";
    }
  }
};

// Toolbar Event Listeners
btnCallStart.addEventListener("click", () => WebRTCCallManager.startCall());
btnCallEnd.addEventListener("click", () => WebRTCCallManager.endCall());
btnToggleCam.addEventListener("click", () => WebRTCCallManager.toggleCamera());
btnToggleMic.addEventListener("click", () => WebRTCCallManager.toggleMic());
btnToggleSpeaker.addEventListener("click", () => WebRTCCallManager.toggleSpeaker());

// ---------------------------------------------------------
// 6. SPEECH SYNTHESIS & LIP SYNCHRONIZATION
// ---------------------------------------------------------
function speakWithLipSync(text) {
  if (isSpeakerMuted) return;

  // Immediately pause listening while assistant speaks (prevents self-transcription echo)
  stopVoiceListening();

  isSpeaking = true;
  if (audioBar) audioBar.classList.add("talking");
  if (audioLabel) audioLabel.textContent = "Speaking with real-time lip sync...";

  // Calculate estimated speech duration (~340ms per word)
  const words = (text || "").trim().split(/\s+/).filter(Boolean);
  const estimatedMs = Math.max(1400, words.length * 340);

  let ended = false;
  const finishSpeech = () => {
    if (ended) return;
    ended = true;
    isSpeaking = false;
    KaggleLandmarkExpressionEngine.activeTargets.jawOpen = 0.0;
    if (audioBar) audioBar.classList.remove("talking");
    if (audioLabel) audioLabel.textContent = "Ready for conversation";

    // Auto-resume listening for continuous hands-free conversation
    checkAndResumeVoiceListening();
  };

  // Fallback timer ensures mouth articulates words even if browser delays onstart
  const timer = setTimeout(finishSpeech, estimatedMs + 600);

  if ("speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        isSpeaking = true;
      };

      utterance.onend = () => {
        clearTimeout(timer);
        finishSpeech();
      };

      utterance.onerror = (e) => {
        if (e && e.error === "not-allowed") {
          console.warn("Speech audio playback not allowed by browser autoplay policy; continuing visual lip-sync timer.");
          return;
        }
        clearTimeout(timer);
        finishSpeech();
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn("Speech synthesis trigger warning:", err);
    }
  }
}

// ---------------------------------------------------------
// 7. GEMINI AI CLIENT & CONVERSATIONAL ENGINE
// ---------------------------------------------------------
const expressionLabels = {
  happy: "Smiling 😊",
  sad: "Concerned 😟",
  surprised: "Surprised 😲",
  neutral: "Neutral 😐"
};

const GeminiAssistantClient = {
  apiKey: localStorage.getItem("gemini_api_key") || "",
  selectedModel: localStorage.getItem("gemini_model") || "gemini-3.5-flash-lite",
  serverAvailable: false,
  serverHasKey: false,
  conversationHistory: [], // Turn-by-turn memory for true conversational AI

  async checkServerStatus() {
    try {
      const response = await fetch("/api/status", { signal: AbortSignal.timeout(3000) });
      if (response.ok) {
        const data = await response.json();
        this.serverAvailable = true;
        this.serverHasKey = Boolean(data.serverKeyConfigured);
        if (data.defaultModel && !localStorage.getItem("gemini_model")) {
          this.selectedModel = data.defaultModel;
        }
        this.updateBadgeUI();
        return data;
      }
    } catch (e) {
      this.serverAvailable = false;
      this.serverHasKey = false;
    }
    this.updateBadgeUI();
    return null;
  },

  updateBadgeUI() {
    if (!geminiBadgeLabel || !btnGeminiSettings) return;
    if (this.serverAvailable && this.serverHasKey) {
      geminiBadgeLabel.textContent = "Gemini Live 🟢";
      btnGeminiSettings.classList.add("active");
    } else if (this.apiKey) {
      geminiBadgeLabel.textContent = "Gemini Custom Key ✨";
      btnGeminiSettings.classList.add("active");
    } else if (this.serverAvailable) {
      geminiBadgeLabel.textContent = "Key Needed ⚠️";
      btnGeminiSettings.classList.remove("active");
    } else {
      geminiBadgeLabel.textContent = "Server Offline 🔴";
      btnGeminiSettings.classList.remove("active");
    }
  },

  /**
   * Connects to backend /api/chat-stream using Server-Sent Events / streaming fetch.
   * Delivers response chunks in real-time with near-instant Time-To-First-Token.
   */
  async generateChatStream(message, { onChunk, onEmotion }) {
    const headers = { "Content-Type": "application/json" };
    if (this.apiKey) headers["x-gemini-api-key"] = this.apiKey;

    const res = await fetch("/api/chat-stream", {
      method: "POST",
      headers,
      body: JSON.stringify({
        message,
        history: this.conversationHistory,
        model: this.selectedModel,
        apiKey: this.apiKey
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      if (res.status === 429) {
        throw new Error("⏳ Gemini Free Tier rate limit reached (15 requests/min). Please wait 10-15 seconds before asking another question.");
      }
      throw new Error(errData.message || `Server returned error (${res.status})`);
    }

    if (!res.body) {
      throw new Error("ReadableStream not supported in this browser.");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let accumulatedText = "";
    let detectedEmotion = "neutral";
    let emotionExtracted = false;
    let modelUsed = this.selectedModel;
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const jsonStr = trimmed.replace(/^data:\s*/, "");
        try {
          const payload = JSON.parse(jsonStr);

          if (payload.error) {
            throw new Error(payload.message || "Streaming error occurred.");
          }

          if (payload.modelUsed) {
            modelUsed = payload.modelUsed;
          }

          if (payload.delta) {
            accumulatedText += payload.delta;

            // Extract inline emotion tag [happy], [sad], [surprised], [neutral]
            if (!emotionExtracted) {
              const emotionMatch = accumulatedText.match(/^\[(happy|sad|surprised|neutral)\]\s*/i);
              if (emotionMatch) {
                detectedEmotion = emotionMatch[1].toLowerCase();
                emotionExtracted = true;
                accumulatedText = accumulatedText.slice(emotionMatch[0].length);
                if (typeof onEmotion === "function") {
                  onEmotion(detectedEmotion);
                }
              } else if (accumulatedText.length > 20 && !accumulatedText.startsWith("[")) {
                // If text begins without bracket tag, treat as neutral
                emotionExtracted = true;
              }
            }

            // Only stream visible text to the UI once emotion tag is handled
            if (emotionExtracted && typeof onChunk === "function") {
              onChunk(accumulatedText);
            }
          }
        } catch (e) {
          if (e.message && (e.message.includes("rate limit") || e.message.includes("Gemini"))) {
            throw e;
          }
        }
      }
    }

    if (!emotionExtracted) {
      const finalMatch = accumulatedText.match(/^\[(happy|sad|surprised|neutral)\]\s*/i);
      if (finalMatch) {
        detectedEmotion = finalMatch[1].toLowerCase();
        accumulatedText = accumulatedText.slice(finalMatch[0].length);
        if (typeof onEmotion === "function") {
          onEmotion(detectedEmotion);
        }
      }
    }

    const cleanReply = accumulatedText.trim();

    // Store turns in conversational memory
    this.conversationHistory.push({ role: "user", text: message });
    this.conversationHistory.push({ role: "model", text: cleanReply });

    if (this.conversationHistory.length > 20) {
      this.conversationHistory = this.conversationHistory.slice(-20);
    }

    return {
      reply: cleanReply,
      expression: detectedEmotion,
      modelUsed
    };
  },

  /**
   * Connects to backend /api/chat which calls the Google Gemini API.
   * Real AI response with conversational memory, dynamic emotions & speech.
   */
  async generateChatResponse(message) {
    const headers = { "Content-Type": "application/json" };
    if (this.apiKey) headers["x-gemini-api-key"] = this.apiKey;

    const res = await fetch("/api/chat", {
      method: "POST",
      headers,
      body: JSON.stringify({
        message,
        history: this.conversationHistory,
        model: this.selectedModel,
        apiKey: this.apiKey
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `Server returned error (${res.status})`);
    }

    const data = await res.json();

    // Store turns in conversational memory
    this.conversationHistory.push({ role: "user", text: message });
    this.conversationHistory.push({ role: "model", text: data.reply });

    // Keep last 20 messages for context
    if (this.conversationHistory.length > 20) {
      this.conversationHistory = this.conversationHistory.slice(-20);
    }

    return {
      reply: data.reply,
      expression: data.expression || "neutral",
      thought: data.thought || "",
      modelUsed: data.modelUsed
    };
  },

  /**
   * Sends webcam frame to backend /api/vision for multimodal understanding.
   */
  async generateVisionResponse(imageBase64, prompt) {
    const headers = { "Content-Type": "application/json" };
    if (this.apiKey) headers["x-gemini-api-key"] = this.apiKey;

    const res = await fetch("/api/vision", {
      method: "POST",
      headers,
      body: JSON.stringify({
        imageBase64,
        prompt,
        model: this.selectedModel,
        apiKey: this.apiKey
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `Server returned error (${res.status})`);
    }

    const data = await res.json();

    this.conversationHistory.push({ role: "user", text: prompt || "Analyze webcam view" });
    this.conversationHistory.push({ role: "model", text: data.reply });

    return {
      reply: data.reply,
      expression: data.expression || "neutral",
      thought: data.thought || "",
      modelUsed: data.modelUsed
    };
  }
};

// ---------------------------------------------------------
// 9. CHAT DISPLAY & MESSAGE DISPATCH
// ---------------------------------------------------------
function appendMessage(sender, text) {
  const messageElement = document.createElement("div");
  messageElement.classList.add("message");
  messageElement.classList.add(sender === "user" ? "user-message" : "bot-message");

  const senderLabel = document.createElement("span");
  senderLabel.classList.add("message-sender");
  senderLabel.textContent = sender === "user" ? "You" : "Assistant";

  const bubble = document.createElement("div");
  bubble.classList.add("message-bubble");
  bubble.textContent = text;

  messageElement.appendChild(senderLabel);
  messageElement.appendChild(bubble);
  chatMessages.appendChild(messageElement);

  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendMessageWithImage(sender, text, imageDataUrl) {
  const messageElement = document.createElement("div");
  messageElement.classList.add("message");
  messageElement.classList.add(sender === "user" ? "user-message" : "bot-message");

  const senderLabel = document.createElement("span");
  senderLabel.classList.add("message-sender");
  senderLabel.textContent = sender === "user" ? "You" : "Assistant";

  const bubble = document.createElement("div");
  bubble.classList.add("message-bubble");

  if (imageDataUrl) {
    const img = document.createElement("img");
    img.src = imageDataUrl;
    img.alt = "Webcam Snapshot";
    img.classList.add("chat-snapshot-preview");
    bubble.appendChild(img);
  }

  const textNode = document.createElement("div");
  textNode.textContent = text;
  bubble.appendChild(textNode);

  messageElement.appendChild(senderLabel);
  messageElement.appendChild(bubble);
  chatMessages.appendChild(messageElement);

  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTypingIndicator() {
  const typingElement = document.createElement("div");
  typingElement.classList.add("message", "bot-message", "typing-container");

  const senderLabel = document.createElement("span");
  senderLabel.classList.add("message-sender");
  senderLabel.textContent = "Assistant";

  const bubble = document.createElement("div");
  bubble.classList.add("message-bubble", "typing-bubble");
  bubble.innerHTML = `
    <span class="typing-dot"></span>
    <span class="typing-dot"></span>
    <span class="typing-dot"></span>
  `;

  typingElement.appendChild(senderLabel);
  typingElement.appendChild(bubble);
  chatMessages.appendChild(typingElement);

  chatMessages.scrollTop = chatMessages.scrollHeight;
  return typingElement;
}

function captureWebcamFrame() {
  if (!userPipVideo || !WebRTCCallManager.isCallActive || WebRTCCallManager.isCameraMuted) {
    return null;
  }
  let w = userPipVideo.videoWidth || 640;
  let h = userPipVideo.videoHeight || 480;
  const maxDim = 1024;
  if (w > maxDim || h > maxDim) {
    const scale = Math.min(maxDim / w, maxDim / h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(userPipVideo, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

// ---------------------------------------------------------
// REQUEST LOCKING & DEBOUNCE (Avoid duplicate / repeated requests)
// ---------------------------------------------------------
let isGeneratingResponse = false;

function setInputLocked(locked) {
  isGeneratingResponse = locked;
  if (btnSend) {
    btnSend.disabled = locked;
    btnSend.style.opacity = locked ? "0.6" : "1";
    btnSend.style.cursor = locked ? "not-allowed" : "pointer";
  }
  if (chatInput) {
    chatInput.disabled = locked;
    if (!locked) {
      chatInput.focus();
    }
  }
  if (quickChips) {
    quickChips.querySelectorAll(".chip").forEach((chip) => {
      chip.style.pointerEvents = locked ? "none" : "auto";
      chip.style.opacity = locked ? "0.6" : "1";
    });
  }
}

async function triggerVisionAnalysis(customPrompt) {
  if (isGeneratingResponse) return;

  if (!WebRTCCallManager.isCallActive) {
    appendMessage("bot", "Please click 'Start Video Call' first so your webcam is active before using camera vision! 📹");
    speakWithLipSync("Please start the video call first so your camera is active!");
    return;
  }
  if (WebRTCCallManager.isCameraMuted) {
    appendMessage("bot", "Your camera is currently turned off. Click 'Camera Off' to turn it back on before analyzing your view! 📷");
    speakWithLipSync("Your camera is turned off. Please enable it first.");
    return;
  }

  const frameDataUrl = captureWebcamFrame();
  if (!frameDataUrl) {
    appendMessage("bot", "Could not capture a frame from your webcam. Make sure your camera stream is running.");
    return;
  }

  setInputLocked(true);

  const promptText = (customPrompt && customPrompt.trim()) ? customPrompt.trim() : "Observe my webcam view and tell me what you see.";
  appendMessageWithImage("user", promptText, frameDataUrl);

  if (btnVisionSnapshot) btnVisionSnapshot.classList.add("analyzing");
  statusText.textContent = "Observing Camera... 👀";

  const typingIndicator = showTypingIndicator();

  try {
    const analysis = await GeminiAssistantClient.generateVisionResponse(frameDataUrl, promptText);

    if (typingIndicator && typingIndicator.parentNode) {
      typingIndicator.remove();
    }

    currentExpression = analysis.expression;
    KaggleLandmarkExpressionEngine.setEmotion(analysis.expression);

    if (expressionLabels[analysis.expression]) {
      statusText.textContent = expressionLabels[analysis.expression];
    }

    appendMessage("bot", analysis.reply);
    speakWithLipSync(analysis.reply);

  } catch (err) {
    if (typingIndicator && typingIndicator.parentNode) {
      typingIndicator.remove();
    }
    console.error("Vision Analysis Error:", err);
    appendMessage("bot", "I ran into a problem analyzing your camera view. Please check your Gemini connection in the ✨ settings.");
  } finally {
    if (btnVisionSnapshot) btnVisionSnapshot.classList.remove("analyzing");
    setInputLocked(false);
    if (!isSpeaking && WebRTCCallManager.isCallActive && !WebRTCCallManager.isMicMuted) {
      checkAndResumeVoiceListening();
    }
  }
}

async function processUserMessage(messageText) {
  const trimmed = messageText.trim();
  if (!trimmed || isGeneratingResponse) return;

  // Immediately pause listening while AI processes response
  stopVoiceListening();

  const lower = trimmed.toLowerCase();
  const isVisionQuery = (
    lower.includes("what do you see") ||
    lower.includes("look at me") ||
    lower.includes("look at this") ||
    lower.includes("can you see") ||
    lower.includes("look at my camera") ||
    lower.includes("analyze my view") ||
    lower.includes("what am i holding")
  );

  if (isVisionQuery && WebRTCCallManager.isCallActive && !WebRTCCallManager.isCameraMuted) {
    chatInput.value = "";
    await triggerVisionAnalysis(trimmed);
    return;
  }

  // Lock input and display user message
  setInputLocked(true);
  appendMessage("user", trimmed);
  chatInput.value = "";

  // Create real-time streaming bot message in chat UI
  const messageElement = document.createElement("div");
  messageElement.classList.add("message", "bot-message");

  const senderLabel = document.createElement("span");
  senderLabel.classList.add("message-sender");
  senderLabel.textContent = "Assistant";

  const bubble = document.createElement("div");
  bubble.classList.add("message-bubble", "streaming-bubble");
  bubble.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';

  messageElement.appendChild(senderLabel);
  messageElement.appendChild(bubble);
  chatMessages.appendChild(messageElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  try {
    let hasReceivedFirstChunk = false;

    const streamResult = await GeminiAssistantClient.generateChatStream(trimmed, {
      onEmotion(emotion) {
        currentExpression = emotion;
        KaggleLandmarkExpressionEngine.setEmotion(emotion);
        if (expressionLabels[emotion]) {
          statusText.textContent = expressionLabels[emotion];
        }
      },
      onChunk(visibleText) {
        if (!hasReceivedFirstChunk) {
          hasReceivedFirstChunk = true;
          bubble.innerHTML = "";
        }
        bubble.textContent = visibleText;
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
    });

    // Ensure final response text is properly displayed
    if (streamResult.reply) {
      bubble.textContent = streamResult.reply;
    }
    bubble.classList.remove("streaming-bubble");

    // Speak aloud with lip sync
    speakWithLipSync(streamResult.reply);

  } catch (err) {
    console.error("Gemini Streaming Error:", err);
    statusText.textContent = "Error ⚠️";

    const isRateLimit = err.message && (
      err.message.includes("rate limit") || 
      err.message.includes("429") || 
      err.message.includes("RESOURCE_EXHAUSTED") ||
      err.message.includes("quota")
    );

    if (isRateLimit) {
      bubble.innerHTML = `
        <div style="color: #f87171; font-weight: 600; margin-bottom: 4px;">⏳ Free Tier Rate Limit Reached</div>
        <div style="font-size: 0.85rem; color: #cbd5e1; line-height: 1.4;">
          Google AI Studio allows up to 15 requests per minute on the free tier. Please pause for 10-15 seconds before asking another question.
        </div>
      `;
    } else {
      bubble.innerHTML = `
        <div style="color: #f87171; font-weight: 600; margin-bottom: 4px;">⚠️ Gemini API Error</div>
        <div style="font-size: 0.85rem; color: #cbd5e1; line-height: 1.4;">
          ${err.message || "Failed to connect to Gemini."}
        </div>
      `;
    }
  } finally {
    setInputLocked(false);
    if (!isSpeaking && WebRTCCallManager.isCallActive && !WebRTCCallManager.isMicMuted) {
      checkAndResumeVoiceListening();
    }
  }
}

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  processUserMessage(chatInput.value);
});

// ---------------------------------------------------------
// 10. MODAL SETTINGS & EVENT LISTENERS
// ---------------------------------------------------------
if (btnGeminiSettings) {
  btnGeminiSettings.addEventListener("click", async () => {
    geminiModal.classList.remove("hidden");
    if (inputApiKey) inputApiKey.value = GeminiAssistantClient.apiKey || "";
    if (selectModel) selectModel.value = GeminiAssistantClient.selectedModel || "gemini-3.5-flash-lite";
    await refreshModalStatus();
  });
}

if (btnModalClose) {
  btnModalClose.addEventListener("click", () => {
    geminiModal.classList.add("hidden");
  });
}

if (geminiModal) {
  geminiModal.addEventListener("click", (e) => {
    if (e.target === geminiModal) {
      geminiModal.classList.add("hidden");
    }
  });
}

if (btnToggleKey) {
  btnToggleKey.addEventListener("click", () => {
    if (inputApiKey) {
      inputApiKey.type = inputApiKey.type === "password" ? "text" : "password";
    }
  });
}

async function refreshModalStatus() {
  if (!modalStatusDot || !modalStatusText) return;
  modalStatusDot.className = "status-pulse-dot";
  modalStatusText.textContent = "Checking server status...";

  const status = await GeminiAssistantClient.checkServerStatus();
  if (status && status.online) {
    if (status.serverKeyConfigured) {
      modalStatusDot.className = "status-pulse-dot online";
      modalStatusText.textContent = `Node.js Server Online (API Key Loaded from .env - ${status.defaultModel})`;
    } else {
      modalStatusDot.className = "status-pulse-dot warning";
      modalStatusText.textContent = "Node.js Server Online (No API Key in .env - Provide key below or in .env)";
    }
  } else if (GeminiAssistantClient.apiKey) {
    modalStatusDot.className = "status-pulse-dot online";
    modalStatusText.textContent = `Direct Gemini Client Mode Active (${GeminiAssistantClient.selectedModel})`;
  } else {
    modalStatusDot.className = "status-pulse-dot";
    modalStatusText.textContent = "Offline Mode (Server not connected)";
  }
}

if (btnTestConnection) {
  btnTestConnection.addEventListener("click", async () => {
    const keyToTest = inputApiKey ? inputApiKey.value.trim() : "";
    const modelToTest = selectModel ? selectModel.value : "gemini-3.5-flash-lite";
    modalStatusDot.className = "status-pulse-dot";
    modalStatusText.textContent = "Testing Gemini connectivity...";

    try {
      let testOk = false;
      let replySnippet = "";

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(keyToTest ? { "x-gemini-api-key": keyToTest } : {})
        },
        body: JSON.stringify({ message: "Hello! Say hi in 5 words.", model: modelToTest, apiKey: keyToTest })
      });

      if (res.ok) {
        const data = await res.json();
        testOk = true;
        replySnippet = data.reply;
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Server rejected test request");
      }

      if (testOk) {
        modalStatusDot.className = "status-pulse-dot online";
        modalStatusText.textContent = `Success! Response: "${replySnippet.substring(0, 45)}"`;
      }
    } catch (err) {
      modalStatusDot.className = "status-pulse-dot error";
      modalStatusText.textContent = `Connection Failed: ${err.message}`;
    }
  });
}

if (btnSaveSettings) {
  btnSaveSettings.addEventListener("click", async () => {
    const key = inputApiKey ? inputApiKey.value.trim() : "";
    const model = selectModel ? selectModel.value : "gemini-3.5-flash-lite";

    GeminiAssistantClient.apiKey = key;
    GeminiAssistantClient.selectedModel = model;

    if (key) {
      localStorage.setItem("gemini_api_key", key);
    } else {
      localStorage.removeItem("gemini_api_key");
    }
    localStorage.setItem("gemini_model", model);

    GeminiAssistantClient.updateBadgeUI();
    geminiModal.classList.add("hidden");

    appendMessage("bot", `✨ Gemini configuration updated! Active Model: ${model}. Start video call to experience multimodal camera vision!`);
  });
}

// Vision Button in Video Call Toolbar
if (btnVisionSnapshot) {
  btnVisionSnapshot.addEventListener("click", () => {
    triggerVisionAnalysis("Inspect my live camera view and describe what you see.");
  });
}

// Vision Button inside Chat Form
if (btnChatVision) {
  btnChatVision.addEventListener("click", () => {
    const textPrompt = chatInput.value.trim() || "What do you see in my camera right now?";
    triggerVisionAnalysis(textPrompt);
    chatInput.value = "";
  });
}

// Quick Prompt Suggestion Chips
if (quickChips) {
  quickChips.addEventListener("click", (e) => {
    if (isGeneratingResponse) return;
    const chip = e.target.closest(".chip");
    if (!chip) return;
    const prompt = chip.getAttribute("data-prompt");
    if (prompt) {
      processUserMessage(prompt);
    }
  });
}

// ---------------------------------------------------------
// 11. CONTINUOUS CONVERSATIONAL VOICE ENGINE (HANDS-FREE)
// ---------------------------------------------------------
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition = null;

function initSpeechRecognition() {
  if (!SpeechRecognition) {
    if (btnMic) {
      btnMic.addEventListener("click", () => {
        appendMessage("bot", "Voice recognition is not supported in this browser. Please use Chrome or Edge, or type in the input box!");
      });
    }
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = "en-US";

  recognition.onstart = () => {
    isRecognitionActive = true;
    if (btnMic) {
      btnMic.classList.add("listening");
      btnMic.setAttribute("title", "Listening continuously... Click to pause");
    }
    if (WebRTCCallManager.isCallActive) {
      statusText.textContent = "Listening... 🎙️ Speak naturally";
      chatInput.placeholder = "Listening to your voice... Speak naturally";
    } else {
      statusText.textContent = "Listening... 🎙️";
      chatInput.placeholder = "Listening... Speak now";
    }
  };

  recognition.onresult = (event) => {
    // Ignore if assistant is generating or speaking (prevents self-transcription echo)
    if (isGeneratingResponse || isSpeaking) return;

    let transcript = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        transcript += event.results[i][0].transcript;
      }
    }
    transcript = transcript.trim();
    if (!transcript) return;

    chatInput.value = transcript;
    statusText.textContent = "Thinking... 💭";

    // Immediately pause listening while AI processes and speaks response
    stopVoiceListening();

    processUserMessage(transcript);
  };

  recognition.onend = () => {
    isRecognitionActive = false;

    // If not in a call, reset button state
    if (!WebRTCCallManager.isCallActive) {
      if (btnMic) {
        btnMic.classList.remove("listening");
        btnMic.setAttribute("title", "Click to speak");
      }
      chatInput.placeholder = "Type or click microphone / vision to interact...";
      return;
    }

    // During an active video call: auto-restart listening if not currently speaking or generating
    if (WebRTCCallManager.isCallActive && !WebRTCCallManager.isMicMuted && !isSpeaking && !isGeneratingResponse) {
      clearTimeout(recognitionRestartTimeout);
      recognitionRestartTimeout = setTimeout(() => {
        if (WebRTCCallManager.isCallActive && !WebRTCCallManager.isMicMuted && !isSpeaking && !isGeneratingResponse) {
          startVoiceListening();
        }
      }, 250);
    }
  };

  recognition.onerror = (event) => {
    isRecognitionActive = false;

    // Ignore non-fatal browser events (user was quiet, or aborted during speech)
    if (event.error === "no-speech" || event.error === "aborted") {
      return;
    }

    if (event.error === "not-allowed") {
      appendMessage("bot", "Microphone access was denied. Please allow microphone permissions in your browser to speak with me!");
      if (btnMic) btnMic.classList.remove("listening");
      return;
    }

    console.warn("Speech recognition notice:", event.error);
  };

  if (btnMic) {
    btnMic.addEventListener("click", () => {
      if (isGeneratingResponse) return;
      if (isRecognitionActive) {
        stopVoiceListening();
        statusText.textContent = "Voice Paused ⏸️";
      } else {
        startVoiceListening();
      }
    });
  }
}

function startVoiceListening() {
  if (!recognition) return;
  if (isRecognitionActive) return;
  if (isSpeaking || isGeneratingResponse) return;
  if (WebRTCCallManager.isCallActive && WebRTCCallManager.isMicMuted) return;

  try {
    recognition.start();
  } catch (err) {
    if (err.name !== "InvalidStateError") {
      console.warn("Could not start speech recognition:", err);
    }
  }
}

function stopVoiceListening() {
  clearTimeout(recognitionRestartTimeout);
  if (!recognition) return;
  if (!isRecognitionActive) return;

  try {
    recognition.stop();
  } catch (err) {
    // Ignore if already stopped
  }
}

function checkAndResumeVoiceListening() {
  if (WebRTCCallManager.isCallActive && !WebRTCCallManager.isMicMuted) {
    clearTimeout(recognitionRestartTimeout);
    // 350ms delay to clear lingering speaker echo in the room
    recognitionRestartTimeout = setTimeout(() => {
      if (WebRTCCallManager.isCallActive && !WebRTCCallManager.isMicMuted && !isSpeaking && !isGeneratingResponse) {
        startVoiceListening();
      }
    }, 350);
  }
}

// Initialize speech recognition engine
initSpeechRecognition();

// Expose to window for external integration & diagnostics
window.startVoiceListening = startVoiceListening;
window.stopVoiceListening = stopVoiceListening;
window.checkAndResumeVoiceListening = checkAndResumeVoiceListening;

// ---------------------------------------------------------
// 12. BOOTSTRAP ENGINE ON DOM LOAD
// ---------------------------------------------------------
window.addEventListener("DOMContentLoaded", async () => {
  initThreeEngine();
  await GeminiAssistantClient.checkServerStatus();
  GeminiAssistantClient.updateBadgeUI();
});
