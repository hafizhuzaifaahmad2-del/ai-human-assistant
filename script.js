/* =========================================================
   AI HUMAN ASSISTANT - JAVASCRIPT LOGIC (script.js) [2D BACKUP]
   ========================================================= */

const avatar = document.getElementById("avatar");
const statusText = document.getElementById("status-text");

const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatMessages = document.getElementById("chat-messages");
const btnMic = document.getElementById("btn-mic");

const expressionLabels = {
  happy: "Face: Smiling 😊",
  concerned: "Face: Concerned 😟",
  neutral: "Face: Neutral 😐"
};

function setExpression(targetExpression) {
  const validExpressions = ["happy", "concerned", "neutral"];
  const expressionToSet = validExpressions.includes(targetExpression) ? targetExpression : "neutral";
  avatar.setAttribute("data-expression", expressionToSet);
  if (expressionLabels[expressionToSet]) {
    statusText.textContent = expressionLabels[expressionToSet];
  }
}

const jokesPool = [
  "Why do programmers prefer dark mode? Because light attracts bugs! 🐛😄",
  "Why do Java developers wear glasses? Because they don't C#! 👓",
  "There are 10 types of people in the world: those who understand binary, and those who don't! 💻",
  "Why was the JavaScript developer sad? Because they didn't know how to 'null' their feelings! 😅",
  "A SQL query walks into a bar, approaches two tables and asks: 'May I join you?' 🍺",
  "Why did the web developer leave the restaurant? Because of the terrible table layout! 🍽️"
];
let lastJokeIndex = -1;

function getNextJoke() {
  let newIndex;
  do {
    newIndex = Math.floor(Math.random() * jokesPool.length);
  } while (newIndex === lastJokeIndex && jokesPool.length > 1);
  lastJokeIndex = newIndex;
  return jokesPool[newIndex];
}

let fallbackCounter = 0;
function getReflectiveFallback(userText) {
  const snippet = userText.length > 40 ? userText.substring(0, 37) + "..." : userText;
  fallbackCounter = (fallbackCounter + 1) % 3;

  if (fallbackCounter === 0) {
    return `You mentioned: "${snippet}". Since I am running on rule-based patterns (before a real Gemini AI is connected), I don't have open-ended understanding for that topic yet. But I am attentively listening!`;
  } else if (fallbackCounter === 1) {
    return `I received your thought on "${snippet}". Because real AI intelligence isn't hooked up yet, try asking me about the time, coding, or share happy or concerning news to see my face adapt!`;
  } else {
    return `Interesting point regarding "${snippet}"! I am processing this neutrally. Feel free to ask me for a joke, ask who I am, or discuss your day!`;
  }
}

function analyzeMessageMeaning(text) {
  const clean = text.toLowerCase().trim();

  const nameMatch = clean.match(/(?:my name is|i am|i'm|call me)\s+([a-zA-Z]+)/i);
  if (nameMatch && !["feeling", "sad", "happy", "worried", "tired", "busy", "sick", "coding", "testing"].includes(nameMatch[1].toLowerCase())) {
    const userName = nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1);
    return {
      expression: "happy",
      reply: `Pleased to meet you, ${userName}! I am your AI Human Assistant. Right now I run on rule-based logic until a real AI API like Gemini is integrated.`
    };
  }

  if (/^(hello|hi|hey|greetings|howdy|good\s*(morning|afternoon|evening)|what's\s*up)/.test(clean) || clean === "hi" || clean === "hello") {
    const currentHour = new Date().getHours();
    let timeGreeting = "Hello!";
    if (currentHour < 12) timeGreeting = "Good morning!";
    else if (currentHour < 18) timeGreeting = "Good afternoon!";
    else timeGreeting = "Good evening!";

    return {
      expression: "happy",
      reply: `${timeGreeting} Great to connect with you. What would you like to talk about today?`
    };
  }

  if (clean.includes("how are you") || clean.includes("how do you feel") || clean.includes("how's it going") || clean.includes("how are things")) {
    return {
      expression: "happy",
      reply: "I am functioning smoothly! My face animations and rule-based chat engine are ready. How are you doing today?"
    };
  }

  if (
    clean.includes("passed") || clean.includes("finished") || clean.includes("completed") ||
    clean.includes("built") || clean.includes("learned") || clean.includes("won") ||
    clean.includes("promoted") || clean.includes("birthday") || clean.includes("celebrating") ||
    clean.includes("succeeded") || clean.includes("graduated") || clean.includes("good news") ||
    clean.includes("my favorite") || clean.includes("excited")
  ) {
    return {
      expression: "happy",
      reply: "Congratulations! That is fantastic news and a great milestone to celebrate. Keep up that wonderful momentum! 🎉"
    };
  }

  if (
    clean.includes("good job") || clean.includes("you look nice") || clean.includes("you are cool") ||
    clean.includes("awesome avatar") || clean.includes("love this") || clean.includes("nice project") ||
    clean.includes("you are great") || clean.includes("pretty") || clean.includes("well done")
  ) {
    return {
      expression: "happy",
      reply: "Thank you so much! That is very kind of you to say. I'm glad you appreciate my design and animations! 😊"
    };
  }

  const happyKeywords = ["happy", "great day", "wonderful", "awesome", "joy", "glad", "delighted", "love my", "super happy", "yay", "cheers", "best day"];
  if (happyKeywords.some(w => clean.includes(w))) {
    return {
      expression: "happy",
      reply: "I love hearing that! Knowing you're having a joyful experience brings a big smile to my face. 😄"
    };
  }

  if (clean.includes("joke") || clean.includes("funny") || clean.includes("laugh") || clean.includes("humor")) {
    return {
      expression: "happy",
      reply: getNextJoke()
    };
  }

  if (clean.includes("thank you") || clean.includes("thanks") || clean.includes("appreciate it") || clean.includes("thx")) {
    return {
      expression: "happy",
      reply: "You're very welcome! I am always here to assist and chat with you. ✨"
    };
  }

  const sadKeywords = ["sad", "crying", "depressed", "heartbroken", "gloomy", "miserable", "lonely", "lost my", "miss someone", "feeling down", "unhappy", "hopeless", "grief", "bad day", "awful day", "terrible day"];
  if (sadKeywords.some(w => clean.includes(w))) {
    return {
      expression: "concerned",
      reply: "I am truly concerned to hear that you are going through a difficult time. Please take things one step at a time, be gentle with yourself, and remember that tough moments do pass. 😟"
    };
  }

  if (
    clean.includes("error") || clean.includes("bug") || clean.includes("not working") ||
    clean.includes("failed") || clean.includes("broken") || clean.includes("crash") ||
    clean.includes("syntax error") || clean.includes("undefined") || clean.includes("null pointer") ||
    clean.includes("cannot run") || clean.includes("won't start")
  ) {
    return {
      expression: "concerned",
      reply: "Technical errors and software bugs can be very concerning and frustrating. I suggest checking your browser console (F12) for line numbers, and reviewing your most recent code changes. You will get it solved! 😟"
    };
  }

  const worryKeywords = ["worried", "worry", "anxious", "nervous", "scared", "problem", "trouble", "issue", "difficult", "stress", "stressed", "danger", "warning", "afraid", "panic", "urgent", "help me"];
  if (worryKeywords.some(w => clean.includes(w))) {
    return {
      expression: "concerned",
      reply: "I hear the concern and stress in your words. When problems feel overwhelming, taking a deep breath and breaking the issue into smaller, solvable pieces can really help. 😟"
    };
  }

  if (clean.includes("sick") || clean.includes("headache") || clean.includes("hurt") || clean.includes("ill") || clean.includes("fever") || clean.includes("not feeling well") || clean.includes("in pain")) {
    return {
      expression: "concerned",
      reply: "I'm concerned to hear that your health isn't at its best. Please drink plenty of fluids, rest up, and take good care of yourself today. 😟"
    };
  }

  if (
    clean.includes("are you ai") || clean.includes("are you smart") || clean.includes("are you real") ||
    clean.includes("gemini") || clean.includes("chatgpt") || clean.includes("gpt") ||
    clean.includes("how do you work") || clean.includes("are you intelligent") || clean.includes("is this ai")
  ) {
    return {
      expression: "neutral",
      reply: "To be completely transparent: I do not have real generative AI intelligence connected yet! Right now, I run on a rule-based sample pattern matcher. A real AI experience can be enabled once a Gemini API is properly integrated."
    };
  }

  if (clean.includes("who are you") || clean.includes("what is your name") || clean.includes("who made you") || clean.includes("who created you")) {
    return {
      expression: "neutral",
      reply: "I am the AI Human Assistant, a beginner-friendly frontend project built with HTML, CSS, and JavaScript. I feature an animated face with blinking, breathing, and automatic expression shifts based on conversation topics."
    };
  }

  if (clean.includes("what can you do") || clean.includes("help") || clean.includes("features") || clean.includes("capabilities")) {
    return {
      expression: "neutral",
      reply: "Here is what I can do: (1) Receive messages via typing or voice microphone; (2) Automatically adapt my facial expression—Smiling for happy topics, Concerned for sad/stressful topics, and Neutral for everyday questions; (3) Report real local time and dates; and (4) Tell programming jokes!"
    };
  }

  if (clean.includes("what time") || clean.includes("current time") || clean.includes("time is it")) {
    const timeNow = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    return {
      expression: "neutral",
      reply: `The current local time is ${timeNow}.`
    };
  }

  if (clean.includes("what day") || clean.includes("what date") || clean.includes("today's date")) {
    const dateNow = new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    return {
      expression: "neutral",
      reply: `Today is ${dateNow}.`
    };
  }

  if (clean.includes("what is html")) {
    return {
      expression: "neutral",
      reply: "HTML (HyperText Markup Language) is the structural skeleton of web pages, defining elements like headings, paragraphs, images, and containers."
    };
  }
  if (clean.includes("what is css")) {
    return {
      expression: "neutral",
      reply: "CSS (Cascading Style Sheets) controls styling, colors, layout, and smooth animations like my avatar's blinking and facial morphing."
    };
  }
  if (clean.includes("what is javascript") || clean.includes("what is js")) {
    return {
      expression: "neutral",
      reply: "JavaScript is the programming language of the web that adds interactivity, handling user clicks, chat input, voice transcription, and rule-based responses."
    };
  }

  if (clean.includes("bye") || clean.includes("goodbye") || clean.includes("see you") || clean.includes("good night") || clean.includes("cya")) {
    return {
      expression: "neutral",
      reply: "Goodbye for now! Have a safe and pleasant day ahead. Feel free to return and chat anytime."
    };
  }

  return {
    expression: "neutral",
    reply: getReflectiveFallback(text)
  };
}

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

function processUserMessage(messageText) {
  const trimmed = messageText.trim();
  if (!trimmed) return;

  const analysis = analyzeMessageMeaning(trimmed);
  setExpression(analysis.expression);

  appendMessage("user", trimmed);

  chatInput.value = "";
  chatInput.focus();

  const typingIndicator = showTypingIndicator();

  setTimeout(() => {
    if (typingIndicator && typingIndicator.parentNode) {
      typingIndicator.remove();
    }
    appendMessage("bot", analysis.reply);
  }, 600);
}

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  processUserMessage(chatInput.value);
});

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = "en-US";

  let isListening = false;

  btnMic.addEventListener("click", () => {
    if (isListening) {
      recognition.stop();
    } else {
      try {
        recognition.start();
      } catch (err) {
        console.error("Speech recognition error:", err);
      }
    }
  });

  recognition.onstart = () => {
    isListening = true;
    btnMic.classList.add("listening");
    btnMic.setAttribute("title", "Listening... Click to stop");
    statusText.textContent = "Listening to Voice... 🎙️";
    chatInput.placeholder = "Listening... Speak now";
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    chatInput.value = transcript;
    processUserMessage(transcript);
  };

  recognition.onend = () => {
    isListening = false;
    btnMic.classList.remove("listening");
    btnMic.setAttribute("title", "Click to speak");
    chatInput.placeholder = "Type or click the mic to speak...";
  };

  recognition.onerror = (event) => {
    isListening = false;
    btnMic.classList.remove("listening");
    btnMic.setAttribute("title", "Click to speak");
    chatInput.placeholder = "Type or click the mic to speak...";

    if (event.error === "not-allowed") {
      appendMessage("bot", "Microphone access was denied. You can allow microphone access in your browser settings or type your message below!");
    }
  };

} else {
  btnMic.addEventListener("click", () => {
    appendMessage(
      "bot",
      "Voice recognition is not supported in this browser. Please use Chrome or Edge for voice input, or type below!"
    );
  });
}
