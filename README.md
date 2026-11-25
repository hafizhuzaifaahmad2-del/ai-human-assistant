# AI Video Call Assistant - Photorealistic 3D Human Avatar 📹🤖✨

A web-based AI Video Call Assistant featuring a **photorealistic 3D human talking head avatar framed as a video conference participant** (Head, Neck, and Shoulders). Built with **Three.js**, **WebGL**, **WebRTC**, and native browser speech APIs.

> 📁 **2D Project Backup:**  
> A complete backup of the previous 2D CSS-animated version is preserved in [`backup-2d/`](file:///c:/Users/Rc/Desktop/assignments/ai-human-assistant/backup-2d/index.html).

---

## 🌟 Key Features

### 1. Gemini Multimodal Camera Vision & Emotion Intelligence ✨📹
- **"See What I See" Vision Analysis:** The assistant can visually inspect your live webcam feed during the call. Click the **Analyze View** button or ask *"What do you see?"* / *"Look at my camera"*.
- **Live Frame Capture & Chat Snapshot:** Grabs a high-resolution frame directly from the WebRTC video track, renders a visual snapshot thumbnail in the chat, and sends the image to Gemini.
- **Emotion-Aware Structured Output:** Powered by **Gemini 4 Hydrogen** (`gemini-4-hydrogen`) or **Gemini 3.5 Flash-Lite** (`gemini-3.5-flash-lite`). Returns structured JSON with spoken dialogue and calibrated emotion classification (`happy`, `sad`, `surprised`, `neutral`).
- **Real-Time Lip Sync & 3D Expression Reaction:** Dynamically drives the Kaggle facial landmark blendshapes and viseme oscillators while speaking aloud with speech synthesis.
- **Dual-Mode Architecture:**
  - **Node.js Backend Server (`server.js`):** Powered by the official `@google/genai` SDK (Interactions API), keeping your `GEMINI_API_KEY` secure in `.env` with stateful turn memory (`previous_interaction_id`).
  - **Standalone Browser Client:** Enter your key in the ✨ in-app Settings modal (stored locally in `localStorage`).
  - **Graceful Offline Fallback:** If offline or without an API key, automatically falls back to the local Kaggle landmark engine.

### 1. Photorealistic 3D Video Call Framing
- **Portrait Camera Framing (32° FOV):** Equivalent to a 50mm portrait lens, removing wide-angle fisheye distortion and presenting the avatar from the shoulders up, just like a Zoom, Teams, or Google Meet call.
- **Three-Point Studio Lighting:**
  - **Key Light (Warm White):** Accentuates facial contours.
  - **Fill Light (Sky Blue):** Softens harsh shadows.
  - **Rim / Hair Light (Cyan):** Highlights head and shoulder silhouettes for deep 3D separation.
- **Cinematic ACESFilmic Tone Mapping:** Provides realistic PBR skin highlights without color burnout.
- **High-Fidelity Anatomical Mesh & GLB Support:** Runs an immediate realistic anatomical bust with PBR materials, glossy corneas, pupils, teeth, and eyelids, while supporting drop-in ARKit GLB models via `avatar.glb`.

---

### 2. Video Conference Toolbar (5 Working WebRTC Controls)
Five video-call buttons:

1. 🟢 **Start Video Call:**
   - Requests real webcam and microphone permissions via `navigator.mediaDevices.getUserMedia()`.
   - Starts the live call timer (`00:00` incrementing).
   - Activates a Picture-in-Picture (PiP) preview of your webcam in the corner.
   - Switches the call badge to `CONNECTED 1080p`.
   - The assistant warmly welcomes you aloud.
2. 🔴 **End Call:**
   - Immediately stops your webcam and microphone hardware tracks.
   - Closes the PiP camera preview.
   - Resets the timer back to `00:00`.
   - Switches the status back to `STANDBY`.
3. 📹 **Camera On / Off:**
   - Toggles your webcam video track without disconnecting the call.
4. 🎙️ **Microphone On / Off:**
   - Mutes and unmutes your voice track during the call.
5. 🔊 **Speaker On / Off:**
   - Enables or silences the assistant's voice and audio speech synthesis.

---

### 3. Kaggle Landmark & Viseme Expression Engine
- **How Kaggle is Used:**
  - Kaggle provides landmark coordinate datasets (such as **MediaPipe 478 3D Facial Landmarks**, **FER-2013**, and **TCD-TIMIT Audio-Viseme Corpora**).
  - The dataset is **not** a 3D avatar file; instead, it provides the mathematical ratios and landmark distances used to calibrate realistic blendshape weights:
    - **😊 Happy (Smiling):** Cheek raise (`cheekSquint = 0.45`), mouth corner elevation (`mouthSmile = 0.75`).
    - **😟 Sad (Concerned):** Inner brow pull (`browInnerUp = 0.82`), mouth frown (`mouthFrown = 0.68`), head tilt downward.
    - **😲 Surprised:** High arched brows (`browOuterUp = 0.88`), jaw drop (`jawOpen = 0.42`), mouth funnel (`mouthFunnel = 0.65`).
    - **😐 Neutral:** Resting, relaxed human facial posture.
- **Smooth Interpolation:** Blendshape weights glide between states using frame delta linear interpolation (`lerp`) for natural transitions without snapping.

---

### 4. Real-Time Lip Synchronization & Speech
- Speaks responses aloud using native browser **SpeechSynthesis**.
- Syllable-driven viseme oscillators continuously drive jaw movement (`jawOpen`) and lip shapes while talking.
- An animated green/cyan **Audio Equalizer Bar** pulses dynamically in sync with the assistant's voice.

---

### 5. Natural Blinking & Head Tracking
- **Automated Eye Blinking:** Blinks naturally every 2.8 to 5.0 seconds.
- **Conversational Micro-Nods:** Subtle head nods synchronize with speaking cadence.
- **Mouse Parallax Head Tracking:** The head smoothly tracks your mouse cursor across the screen.
- **Micro-Breathing:** Gentle chest/shoulder breathing motion keeps the avatar lifelike.

---

### 6. Multimodal Chat (Text & Voice Input)
- **Speech-to-Text Microphone (🎙️):** Click the mic inside the chat box to speak directly.
- **Meaning & Tone Analysis:** Automatically analyzes conversational intent, responding with contextual answers, speech, and facial expressions.
- **No Manual Emotion Buttons:** Emotions adjust automatically based on conversational context.

---

## 🌐 3 Realistic 3D Model Options for Future GLB Replacement

If you wish to load an external GLB model file:

| Option | Model Source | Format & Rigging | Approximate Size | Link |
|---|---|---|---|---|
| **1. (Recommended)** | **Ready Player Me Realistic Bust** | GLB, 52 ARKit Blendshapes + Oculus Visemes | ~5 MB - 8 MB | [readyplayer.me](https://readyplayer.me) |
| **2.** | **Sketchfab Realistic Human Head / Bust** | GLTF / GLB, Rigged with Morph Targets | ~15 MB - 30 MB | [sketchfab.com/feed](https://sketchfab.com) |
| **3.** | **CGTrader Rigged Photorealistic Head** | GLB / FBX, High-Poly PBR Textures | ~25 MB - 50 MB | [cgtrader.com](https://cgtrader.com) |

> 💡 **To use a custom model:** Save your model as `avatar.glb` in the project root directory (`c:\Users\Rc\Desktop\assignments\ai-human-assistant\avatar.glb`). Three.js will automatically detect and load it.

---

## 📂 Project Directory Structure

```
c:\Users\Rc\Desktop\assignments\ai-human-assistant\
│
├── index.html          # Video conference UI, Three.js & GLTF scripts, WebRTC controls
├── style.css           # Video-call styling, PiP camera box, audio equalizer, responsive layout
├── script.js           # Three.js 3D pipeline, Kaggle landmark engine, WebRTC manager, Lip sync
├── README.md           # Project documentation and guide
│
└── backup-2d/          # Complete standalone backup of the previous 2D CSS-animated version
    ├── index.html
    ├── style.css
    └── script.js
```

---

## 🚀 How to Run and Test on Windows 10

### Method 1: Full-Stack with Gemini API Backend Server (Recommended)
1. **Open a terminal in the project directory:**
   ```powershell
   cd "c:\Users\Rc\Desktop\assignments\ai-human-assistant"
   ```
2. **Configure your Gemini API key:**
   Copy `.env.example` to `.env` and paste your Gemini API key:
   ```powershell
   Copy-Item .env.example .env
   # Open .env and set GEMINI_API_KEY=your_key_here
   ```
   *(Or set `$env:GEMINI_API_KEY = "your_key_here"`)*
3. **Start the server:**
   ```powershell
   npm start
   ```
4. **Open in browser:**
   Navigate to [http://localhost:3000](http://localhost:3000). The header pill will indicate `Gemini Server 🟢`.

---

### Method 2: Standalone Browser Mode (Zero-Server Setup)
1. Double-click [`index.html`](file:///c:/Users/Rc/Desktop/assignments/ai-human-assistant/index.html) or open it in Chrome / Edge.
2. Click the **✨ Gemini AI** button in the top right to open the **Gemini API Intelligence Settings** modal.
3. Paste your Gemini API key and click **Save & Connect**.
4. The assistant will switch to `Gemini Direct ✨` mode using client-side Gemini Interactions REST calls.
5. If no key is configured, it operates smoothly in `Kaggle Offline ⚡` mode!

---

## 📸 How to Test Gemini Multimodal Vision & Emotion Reaction
1. Click **Start Video Call** ➔ Grant camera and microphone permissions.
2. Your webcam will appear in the top-right Picture-in-Picture (PiP) window.
3. Hold an object up to your camera (e.g., a mug, notebook, phone, or gesture) or make an expression.
4. Click the **Analyze View** button on the video toolbar (or click the camera icon 📷 in the chat box, or type *"Look at my camera and tell me what you see"*).
5. Watch:
   - A webcam snapshot thumbnail appears directly in the chat stream!
   - Gemini analyzes the image in real time.
   - The 3D avatar's face transitions to the appropriate Kaggle emotion (smiling, concerned, or surprised).
   - The avatar speaks its visual analysis aloud while moving its 3D lips in real-time synchronization!
