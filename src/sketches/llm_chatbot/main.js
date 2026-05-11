// ═══════════════════════════════════════════════════════════
//  IxD CHATBOT  ·  main.js
// ═══════════════════════════════════════════════════════════

const API_KEY = import.meta.env.VITE_OPENAI_KEY;
const API_URL = "https://api.openai.com/v1/chat/completions";

new p5((p) => {
  const MSG_PADDING = 20;

  let messages = [];
  let userInput;
  let sendBtn;

  p.setup = function() {
    let panel = p.select('#chat-panel').elt;
    p.createCanvas(panel.offsetWidth, panel.offsetHeight).parent('chat-panel');

    // ── Header ───────────────────────────────────────────────
    p.createElement('h1', '⬡ Computational Prototyping Chatbot').parent('header');

    let modelSelect = p.createSelect();
    modelSelect.id('model-select');
    modelSelect.option('gpt-4o · OpenAI  (best quality)', 'gpt-4o');
    modelSelect.option('gpt-4o-mini · OpenAI  (fastest)', 'gpt-4o-mini');
    modelSelect.option('o1-mini · OpenAI  (reasoning)', 'o1-mini');
    modelSelect.parent('header');

    // ── Left panel ───────────────────────────────────────────
    p.createElement('div', '① System Prompt')
      .class('panel-label')
      .parent('persona-panel');

    let systemPrompt = p.createElement('textarea');
    systemPrompt.id('system-prompt');
    systemPrompt.value(`You are a curious and friendly museum guide specialising in 20th century design history. You speak in an engaging, accessible way — never stuffy. You love asking visitors what they find most interesting. Keep responses concise (2–4 sentences) unless asked to elaborate.`);
    systemPrompt.parent('persona-panel');

    let btnRow = p.createDiv('');
    btnRow.class('btn-row');
    btnRow.parent('persona-panel');

    let applyBtn = p.createButton('↺ Apply & Reset');
    applyBtn.id('apply-btn');
    applyBtn.parent(btnRow);
    applyBtn.mousePressed(() => { conversationHistory = []; messages = []; });

    let clearBtn = p.createButton('Clear');
    clearBtn.id('clear-btn');
    clearBtn.parent(btnRow);
    clearBtn.mousePressed(() => { messages = []; });

    // ── Chat input (overlays canvas bottom) ──────────────────
    let inputArea = p.createDiv('');
    inputArea.id('input-area');
    inputArea.parent('chat-panel');

    userInput = p.createInput('');
    userInput.id('user-input');
    userInput.attribute('placeholder', 'Type a message…');
    userInput.parent(inputArea);
    userInput.elt.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    });

    sendBtn = p.createButton('Send →');
    sendBtn.id('send-btn');
    sendBtn.parent(inputArea);
    sendBtn.mousePressed(handleSend);
  };

  p.draw = function() {
    p.background(13, 13, 13);
    let xPos;
    let yPos = p.height - 100;
    let tW = p.min(p.width - 100, 300);

    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') xPos = p.width - (tW + 20);
      else xPos = 20;
      messages[i].show(xPos, yPos, tW);
      yPos -= messages[i].tHeight(tW) + MSG_PADDING;
    }
  };

  p.windowResized = function() {
    let panel = p.select('#chat-panel').elt;
    p.resizeCanvas(panel.offsetWidth, panel.offsetHeight);
  };


  // ─────────────────────────────────────────────────────────────
  //  CHAT
  // ─────────────────────────────────────────────────────────────

  let conversationHistory = [];
  let isWaiting = false;

  async function sendMessage(userText) {
    const systemPrompt = document.getElementById('system-prompt').value.trim();
    const model = document.getElementById('model-select').value;

    conversationHistory.push({ role: "user", content: userText });

    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Authorization": `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "system", content: systemPrompt }, ...conversationHistory],
        max_tokens: 512,
        temperature: 0.8
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.log("API error:", JSON.stringify(err, null, 2));
      throw new Error(err.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const replyText = data.choices[0].message.content.trim();
    conversationHistory.push({ role: "assistant", content: replyText });
    return replyText;
  }

  async function handleSend() {
    if (isWaiting) return;

    const userText = userInput.value().trim();
    if (!userText) return;

    userInput.value('');
    isWaiting = true;
    sendBtn.elt.disabled = true;

    messages.push(new Message(p, userText, 'user'));

    try {
      const replyText = await sendMessage(userText);
      messages.push(new Message(p, replyText, 'assistant'));
    } catch (err) {
      messages.push(new Message(p, 'Error: ' + err.message, 'assistant'));
      conversationHistory.pop();
      conversationHistory.pop();
    } finally {
      isWaiting = false;
      sendBtn.elt.disabled = false;
      userInput.elt.focus();
    }
  }
});
