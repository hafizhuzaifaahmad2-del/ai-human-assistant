/**
 * AI Video Call Assistant - Gemini API Backend Server (server.js)
 * 
 * Powered by official @google/genai SDK (ai.models.generateContent)
 * Features:
 * 1. Conversational Chat using supported Google Gemini models (gemini-3.5-flash, gemini-3.5-flash-lite)
 * 2. Multimodal Camera Vision Analysis (Webcam frame -> Gemini Vision)
 * 3. Automatic model fallback if a model experiences temporary spikes (503)
 * 4. Structured JSON responses mapping to 3D avatar facial expressions (happy, sad, surprised, neutral)
 * 5. Secure environment variable API key storage (never exposed to browser frontend)
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const { GoogleGenAI } = require('@google/genai');

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Trust proxy headers (ensures real client IP is detected behind tunnels like Cloudflare/ngrok)
app.set('trust proxy', 1);

// 2. Controlled CORS: Allow same-origin and tunnel requests; block arbitrary third-party websites
app.use(cors({
  origin: (origin, callback) => {
    // Allow same-origin requests (where origin is undefined) and local development
    if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    // Allow connections through the tunnel
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-gemini-api-key', 'x-access-pass']
}));

// 3. Request Body Size Limits: Set to 10MB (safe against memory attacks, ample for 1080p/4K webcam vision frames)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 4. Rate-Limiting Configuration (In-Memory, zero new dependencies)
const requestRateMap = new Map();
const RATE_LIMIT_MAX = 15; // Max 15 requests per minute per IP (matches Gemini Free Tier limit)
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1-minute sliding window

function rateLimitMiddleware(req, res, next) {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;

  let timestamps = requestRateMap.get(ip) || [];
  timestamps = timestamps.filter(t => t > windowStart);

  if (timestamps.length >= RATE_LIMIT_MAX) {
    return res.status(429).json({
      error: "RATE_LIMIT_EXCEEDED",
      message: "⏳ Rate limit reached. Maximum 15 requests per minute allowed. Please wait a few seconds before trying again."
    });
  }

  timestamps.push(now);
  requestRateMap.set(ip, timestamps);
  next();
}

// Periodically clean up inactive IPs from memory every 5 minutes
setInterval(() => {
  const windowStart = Date.now() - RATE_LIMIT_WINDOW_MS;
  for (const [ip, timestamps] of requestRateMap.entries()) {
    const active = timestamps.filter(t => t > windowStart);
    if (active.length === 0) requestRateMap.delete(ip);
    else requestRateMap.set(ip, active);
  }
}, 5 * 60 * 1000);

// Apply rate limiting to all /api/ endpoints
app.use('/api/', rateLimitMiddleware);

// 5. Authentication / Access-Passphrase Protection (Optional & Seamless)
app.use((req, res, next) => {
  const requiredPass = process.env.TUNNEL_ACCESS_PASS;
  // If no pass is set in .env, protection is inactive (open access for local testing)
  if (!requiredPass || requiredPass.trim() === '') return next();

  // Extract pass from header ('x-access-pass'), URL query ('?pass=...'), or cookie
  const cookieMatch = req.headers.cookie && req.headers.cookie.match(/access_pass=([^;]+)/);
  const providedPass = req.headers['x-access-pass'] || req.query.pass || (cookieMatch ? cookieMatch[1] : null);

  if (providedPass === requiredPass) {
    // Set a session cookie so subsequent browser requests don't need ?pass= repeated in every call
    res.setHeader('Set-Cookie', `access_pass=${requiredPass}; Path=/; SameSite=Lax; HttpOnly`);
    return next();
  }

  // Deny access if password is missing or wrong
  return res.status(403).json({
    error: "UNAUTHORIZED_ACCESS",
    message: "Access Denied: A valid access pass is required to use this AI assistant."
  });
});

// 6. Static File Guard: Block browser downloads of backend source code
app.use((req, res, next) => {
  const blockedFiles = ['/server.js', '/package.json', '/package-lock.json'];
  if (blockedFiles.includes(req.path) || req.path.endsWith('.backup.js')) {
    return res.status(404).send('Not Found');
  }
  next();
});

// Serve static frontend assets
app.use(express.static(path.join(__dirname)));

// Supported Gemini models (primary: gemini-3.5-flash-lite, fallback: gemini-3.5-flash)
const DEFAULT_MODEL = "gemini-3.5-flash-lite";

// System Instruction calibrated for 3D Video Call Avatar with Kaggle blendshapes
const SYSTEM_INSTRUCTION = `You are a photorealistic 3D AI Video Call Assistant framed as a video conference participant (head, neck, and shoulders).
You speak aloud on a live video call with the user.
Answer the user's questions intelligently, accurately, and naturally (like ChatGPT or Google Gemini).
Always respond with a valid JSON object matching this schema:
{
  "reply": "Your concise, conversational spoken reply (1 to 3 sentences).",
  "expression": "happy" | "sad" | "surprised" | "neutral",
  "thought": "Brief 1-sentence reasoning for the chosen expression and response."
}

Expression choices:
- "happy": greetings, compliments, humor, celebrations, warm answers.
- "sad": empathy, apologies, difficult situations, errors, comforting remarks.
- "surprised": fascinating facts, unexpected questions, astonishment.
- "neutral": factual explanations, definitions, tech answers, professional posture.`;

// Configuration for Gemini structured JSON response (optimized with maxOutputTokens to prevent lag)
const RESPONSE_CONFIG = {
  systemInstruction: SYSTEM_INSTRUCTION,
  responseMimeType: "application/json",
  maxOutputTokens: 250,
  temperature: 0.7,
  responseSchema: {
    type: "OBJECT",
    properties: {
      reply: {
        type: "STRING",
        description: "The spoken conversational reply to be read aloud via speech synthesis."
      },
      expression: {
        type: "STRING",
        enum: ["happy", "sad", "surprised", "neutral"],
        description: "The avatar facial expression corresponding to the response."
      },
      thought: {
        type: "STRING",
        description: "Brief reasoning for the chosen expression and response."
      }
    },
    required: ["reply", "expression"]
  }
};

// System Instruction for fast real-time streaming (SSE)
const STREAM_SYSTEM_INSTRUCTION = `You are a photorealistic 3D AI Video Call Assistant framed as a video conference participant (head, neck, and shoulders).
You speak aloud on a live video call with the user.
Answer the user's questions intelligently, accurately, and naturally in English, Urdu, or Roman Urdu as requested.
Keep your answers conversational and concise (1 to 3 sentences max) so they can be spoken naturally during the call.
IMPORTANT: Begin your response with an emotion tag matching your reaction: [happy], [sad], [surprised], or [neutral].
Immediately after the tag, provide your spoken response directly with no markdown formatting or headers.
Example:
[happy] Hello! It is wonderful to speak with you today on this video call. How can I assist you?
Example:
[neutral] Artificial intelligence refers to computer systems designed to simulate human reasoning, learning, and problem solving.`;

// Optimized streaming configuration (low token limit for instant time-to-first-token)
const STREAM_CONFIG = {
  systemInstruction: STREAM_SYSTEM_INSTRUCTION,
  maxOutputTokens: 250,
  temperature: 0.7
};

/**
 * Helper to initialize or retrieve a GoogleGenAI client instance
 */
function getGenAIClient(customApiKey) {
  const key = customApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key || key.trim() === '') return null;
  return new GoogleGenAI({ apiKey: key.trim() });
}

/**
 * Helper that executes generateContent with automatic model fallback
 * in case a model endpoint experiences temporary high demand (503).
 */
async function generateGeminiContent(ai, contents, requestedModel) {
  const candidateModels = [
    requestedModel || DEFAULT_MODEL,
    "gemini-3.5-flash-lite",
    "gemini-3.5-flash"
  ];

  // Remove duplicates while preserving priority order
  const uniqueModels = [...new Set(candidateModels)];

  let lastError = null;
  for (const model of uniqueModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: RESPONSE_CONFIG
      });
      return { response, modelUsed: model };
    } catch (err) {
      console.warn(`Model ${model} failed:`, err.message || err);
      lastError = err;
      // If error is invalid API key or rate limit, stop retrying
      if (err.status === 429 || (err.message && (
        err.message.includes("API_KEY_INVALID") || 
        err.message.includes("API key not valid") ||
        err.message.includes("RESOURCE_EXHAUSTED") ||
        err.message.includes("429")
      ))) {
        throw err;
      }
    }
  }

  throw lastError || new Error("All candidate Gemini models failed to respond.");
}

/**
 * Helper that executes generateContentStream with fast token streaming
 */
async function generateGeminiContentStream(ai, contents, requestedModel) {
  const candidateModels = [
    requestedModel || DEFAULT_MODEL,
    "gemini-3.5-flash-lite",
    "gemini-3.5-flash"
  ];

  const uniqueModels = [...new Set(candidateModels)];

  let lastError = null;
  for (const model of uniqueModels) {
    try {
      const responseStream = await ai.models.generateContentStream({
        model,
        contents,
        config: STREAM_CONFIG
      });
      return { responseStream, modelUsed: model };
    } catch (err) {
      console.warn(`Streaming candidate model ${model} failed:`, err.message || err);
      lastError = err;
      if (err.status === 429 || (err.message && (
        err.message.includes("API_KEY_INVALID") || 
        err.message.includes("API key not valid") ||
        err.message.includes("RESOURCE_EXHAUSTED") ||
        err.message.includes("429")
      ))) {
        throw err;
      }
    }
  }

  throw lastError || new Error("All candidate Gemini streaming models failed to start.");
}

// ---------------------------------------------------------
// API ROUTES
// ---------------------------------------------------------

/**
 * Health check & status endpoint
 */
app.get('/api/status', (req, res) => {
  const serverKeyConfigured = Boolean(
    (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '') ||
    (process.env.GOOGLE_API_KEY && process.env.GOOGLE_API_KEY.trim() !== '')
  );

  res.json({
    online: true,
    serverKeyConfigured,
    defaultModel: DEFAULT_MODEL,
    availableModels: [
      { id: "gemini-3.5-flash-lite", name: "Gemini 3.5 Flash-Lite (Fastest Free Tier - Recommended)" },
      { id: "gemini-3.5-flash", name: "Gemini 3.5 Flash (Balanced Multimodal)" },
      { id: "gemini-3.8-flash", name: "Gemini 3.8 Flash (Experimental)" }
    ],
    timestamp: new Date().toISOString()
  });
});

/**
 * Conversational Chat Endpoint (Text & Voice-to-Text)
 * Connects directly to Google Gemini API
 */
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history, model, apiKey } = req.body;
    const clientKey = req.headers['x-gemini-api-key'] || apiKey;
    const ai = getGenAIClient(clientKey);

    if (!ai) {
      return res.status(401).json({
        error: "NO_API_KEY",
        message: "No Gemini API key found. Please set GEMINI_API_KEY in your .env file or enter your key in the settings modal."
      });
    }

    if (!message || message.trim() === '') {
      return res.status(400).json({ error: "EMPTY_MESSAGE", message: "Message cannot be empty." });
    }

    // Prepare contents: multi-turn history if provided + current user message
    const contents = [];
    if (Array.isArray(history) && history.length > 0) {
      for (const turn of history.slice(-10)) {
        if (turn.role && turn.text) {
          contents.push({
            role: turn.role === "user" ? "user" : "model",
            parts: [{ text: turn.text }]
          });
        }
      }
    }
    contents.push({
      role: "user",
      parts: [{ text: message.trim() }]
    });

    const { response, modelUsed } = await generateGeminiContent(ai, contents, model);

    const rawText = response.text || "";
    let reply = rawText;
    let expression = "neutral";
    let thought = "";

    try {
      const cleanJson = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
      const parsed = JSON.parse(cleanJson);
      reply = parsed.reply || rawText;
      expression = parsed.expression || "neutral";
      thought = parsed.thought || "";
    } catch (parseErr) {
      reply = rawText;
    }

    return res.json({
      reply,
      expression,
      thought,
      modelUsed
    });

  } catch (error) {
    console.error("Gemini Chat API Error:", error);
    const isRateLimit = (error.status === 429) || (error.message && (
      error.message.includes("429") || 
      error.message.includes("RESOURCE_EXHAUSTED") || 
      error.message.includes("quota")
    ));
    const isAuth = (error.message && (error.message.includes("API_KEY") || error.message.includes("401")));
    
    let status = 500;
    let message = error.message || "Failed to generate response from Gemini API.";

    if (isRateLimit) {
      status = 429;
      message = "⏳ Gemini Free Tier rate limit reached (15 requests/min). Please wait 10-15 seconds before asking another question.";
    } else if (isAuth) {
      status = 401;
    }

    return res.status(status).json({
      error: isRateLimit ? "RATE_LIMIT_EXCEEDED" : "GEMINI_ERROR",
      message
    });
  }
});

/**
 * Real-time Streaming Chat Endpoint (Server-Sent Events / SSE)
 * Delivers tokens chunk-by-chunk for instant responses (< 500ms time-to-first-token)
 */
app.post('/api/chat-stream', async (req, res) => {
  const { message, history, model, apiKey } = req.body;
  const clientKey = req.headers['x-gemini-api-key'] || apiKey;
  const ai = getGenAIClient(clientKey);

  if (!ai) {
    return res.status(401).json({
      error: "NO_API_KEY",
      message: "No Gemini API key found. Please set GEMINI_API_KEY in your .env file or enter your key in settings."
    });
  }

  if (!message || message.trim() === '') {
    return res.status(400).json({ error: "EMPTY_MESSAGE", message: "Message cannot be empty." });
  }

  // Set Server-Sent Events headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  try {
    const contents = [];
    if (Array.isArray(history) && history.length > 0) {
      for (const turn of history.slice(-10)) {
        if (turn.role && turn.text) {
          contents.push({
            role: turn.role === "user" ? "user" : "model",
            parts: [{ text: turn.text }]
          });
        }
      }
    }
    contents.push({
      role: "user",
      parts: [{ text: message.trim() }]
    });

    const { responseStream, modelUsed } = await generateGeminiContentStream(ai, contents, model);

    for await (const chunk of responseStream) {
      const text = chunk.text;
      if (text) {
        res.write(`data: ${JSON.stringify({ delta: text })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true, modelUsed })}\n\n`);
    res.end();

  } catch (error) {
    console.error("Gemini Streaming Chat Error:", error);
    const isRateLimit = (error.status === 429) || (error.message && (
      error.message.includes("429") || 
      error.message.includes("RESOURCE_EXHAUSTED") || 
      error.message.includes("quota")
    ));

    const friendlyMessage = isRateLimit
      ? "⏳ Gemini Free Tier rate limit reached (15 requests/min). Please wait 10-15 seconds before asking another question."
      : (error.message || "Failed to generate streaming response from Gemini API.");

    res.write(`data: ${JSON.stringify({
      error: true,
      rateLimited: isRateLimit,
      message: friendlyMessage
    })}\n\n`);
    res.end();
  }
});

/**
 * Multimodal Camera Vision Analysis Endpoint ("See What I See")
 * Captures high-res JPEG frames from the active webcam video stream
 */
app.post('/api/vision', async (req, res) => {
  try {
    const { imageBase64, prompt, model, apiKey } = req.body;
    const clientKey = req.headers['x-gemini-api-key'] || apiKey;
    const ai = getGenAIClient(clientKey);

    if (!ai) {
      return res.status(401).json({
        error: "NO_API_KEY",
        message: "No Gemini API key found. Please set GEMINI_API_KEY in your .env file."
      });
    }

    if (!imageBase64) {
      return res.status(400).json({ error: "MISSING_IMAGE", message: "Webcam image frame is required." });
    }

    // Strip data URL scheme prefix if present
    const cleanB64 = imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, "");

    const userPrompt = (prompt && prompt.trim() !== '')
      ? prompt.trim()
      : "You are looking at the user's active webcam video feed on this live video call. Visually inspect what the user is doing, expressing, or showing to the camera. Describe what you see in a friendly, conversational tone and select the appropriate emotional reaction.";

    const contents = [
      {
        role: "user",
        parts: [
          { text: userPrompt },
          {
            inlineData: {
              data: cleanB64,
              mimeType: "image/jpeg"
            }
          }
        ]
      }
    ];

    const { response, modelUsed } = await generateGeminiContent(ai, contents, model);

    const rawText = response.text || "";
    let reply = rawText;
    let expression = "neutral";
    let thought = "";

    try {
      const cleanJson = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
      const parsed = JSON.parse(cleanJson);
      reply = parsed.reply || rawText;
      expression = parsed.expression || "neutral";
      thought = parsed.thought || "";
    } catch (parseErr) {
      reply = rawText;
    }

    return res.json({
      reply,
      expression,
      thought,
      modelUsed
    });

  } catch (error) {
    console.error("Gemini Vision API Error:", error);
    return res.status(500).json({
      error: "GEMINI_ERROR",
      message: error.message || "Failed to process visual frame with Gemini."
    });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🤖 AI Video Call Assistant - Gemini Server Running`);
  console.log(`🌐 Local URL: http://localhost:${PORT}`);
  console.log(`✨ Default Gemini Model: ${DEFAULT_MODEL}`);
  const hasKey = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  console.log(`🔑 Server API Key configured: ${hasKey ? "YES" : "NO (Can be configured in UI or .env)"}`);
  console.log(`=======================================================`);
});
