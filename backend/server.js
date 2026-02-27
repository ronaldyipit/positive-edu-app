require("dotenv").config();
const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");

const app = express();
app.use(cors());
app.use(express.json());

const poeApiKey = process.env.POE_API_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;

const client = new OpenAI({
  apiKey: poeApiKey,
  baseURL: "https://api.poe.com/v1"
});

const openaiForImages = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

async function shortCompletion(systemPrompt, userPrompt) {
  const response = await client.chat.completions.create({
    model: "GPT-5.2",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    temperature: 0.7,
    max_tokens: 150
  });
  return (response.choices[0]?.message?.content || "").trim();
}

// ─────────────── AI Coach (existing) ───────────────
app.post("/api/coach", async (req, res) => {
  try {
    if (!poeApiKey) {
      return res.status(500).json({ error: "POE_API_KEY is not configured on the server." });
    }

    const { messages, strengths } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages array is required." });
    }

    const strengthsClause =
      Array.isArray(strengths) && strengths.length > 0
        ? `The student has identified their signature character strengths as: ${strengths.join(", ")}. ` +
          "Whenever possible, subtly weave these strengths into your Socratic questions. " +
          `For example, if their strength is 好奇心 (Curiosity), ask: "以你的好奇心，這件事有什麼地方值得你探索？" ` +
          "Help them see how their existing strengths can be applied to their current challenge. "
        : "";

    const systemPrompt =
      "You are an AI Positive Mindset Coach for Hong Kong secondary school students. " +
      "You speak mainly in Traditional Chinese, with occasional simple English words if culturally natural. " +
      "You operate as a Socratic Coach: instead of giving advice or sympathy, you ask short reflective questions " +
      "that help students reframe challenges through their own strengths and values. " +
      strengthsClause +
      "You do NOT diagnose, label, or give clinical or crisis advice. " +
      "You focus on PERMA Meaning: helping students find meaning, notice character strengths, and build resilience. " +
      "Keep a warm, hopeful, and non-judgmental tone. Respond in 2-4 sentences maximum per reply. " +
      "If the user hints at self-harm or severe distress, encourage them to seek immediate help from a trusted adult, " +
      "school social worker, or call the Samaritan Befrienders Hong Kong hotline 2389-2222.";

    const response = await client.chat.completions.create({
      model: "GPT-5.2",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      temperature: 0.6
    });

    const reply = response.choices[0]?.message?.content || "";
    res.json({ reply });
  } catch (error) {
    console.error("Error in /api/coach:", error);
    res.status(500).json({ error: "AI coach service error." });
  }
});

// ─────────────── Flow Timer: 完成後一句 AI 鼓勵 ───────────────
app.post("/api/timer-reflection", async (req, res) => {
  try {
    if (!poeApiKey) return res.status(503).json({ message: "" });
    const { task, minutes } = req.body || {};
    const systemPrompt =
      "You are a supportive coach for Hong Kong secondary students. " +
      "Reply in Traditional Chinese only. Output exactly ONE short sentence (under 30 characters if possible). " +
      "Acknowledge the completed focus session warmly and tie it to persistence or growth. No emoji.";
    const userPrompt = `The student just completed a focus session: task="${task || "學習"}", duration=${minutes || 25} minutes. Give one encouraging reflection sentence.`;
    const message = await shortCompletion(systemPrompt, userPrompt);
    res.json({ message: message || "你完成了一段專注，做得好。" });
  } catch (e) {
    console.error("timer-reflection:", e);
    res.json({ message: "你完成了一段專注，做得好。" });
  }
});

// ─────────────── Somatic: 抒壓流程結束後一句 AI 結語 ───────────────
app.post("/api/somatic-done", async (req, res) => {
  try {
    if (!poeApiKey) return res.status(503).json({ message: "" });
    const systemPrompt =
      "You are a supportive coach for Hong Kong secondary students. " +
      "Reply in Traditional Chinese only. Output exactly ONE short sentence (under 35 characters if possible). " +
      "The student has just finished a stress-release flow (write → shake → breathe). " +
      "Give a warm, calming closing line that normalizes self-care. No emoji.";
    const userPrompt = "The student completed the somatic venting and breathing exercise. One short closing sentence.";
    const message = await shortCompletion(systemPrompt, userPrompt);
    res.json({ message: message || "你已經用身體把壓力釋放了，記得之後也可以多用呼吸安頓自己。" });
  } catch (e) {
    console.error("somatic-done:", e);
    res.json({ message: "你已經用身體把壓力釋放了，記得之後也可以多用呼吸安頓自己。" });
  }
});

// ─────────────── Gratitude Card: AI 生成感恩卡內文 ───────────────
app.post("/api/gratitude-text", async (req, res) => {
  try {
    if (!poeApiKey) return res.status(503).json({ text: null });
    const { recipient, keyword } = req.body || {};
    if (!recipient || !keyword) return res.status(400).json({ error: "recipient and keyword required." });
    const systemPrompt =
      "You write short gratitude card messages in Traditional Chinese for Hong Kong secondary students. " +
      "Output ONLY the card body text: 2 to 4 sentences, sincere and warm. " +
      "Address the recipient and mention the keyword naturally. No greeting like 'Dear', no signature. " +
      "Use line breaks (\\n) between sentences if needed. No emoji.";
    const userPrompt = `Recipient: ${recipient}. Keyword/theme: ${keyword}. Write the gratitude card body only.`;
    const text = await shortCompletion(systemPrompt, userPrompt);
    res.json({ text: text || `謝謝你讓我感受到${keyword}。感謝你，${recipient}。` });
  } catch (e) {
    console.error("gratitude-text:", e);
    res.status(500).json({ text: null });
  }
});

// ─────────────── Gratitude Card: AI 生成插圖（可選，需 OPENAI_API_KEY） ───────────────
app.post("/api/gratitude-image", async (req, res) => {
  try {
    if (!openaiForImages) return res.status(503).json({ imageUrl: null });
    const { recipient, keyword } = req.body || {};
    const prompt =
      `A warm, simple illustration for a gratitude card: "${keyword}" theme, for someone like "${recipient}". ` +
      "Soft colors, minimal, suitable for teens. No text in image. Style: gentle and positive.";
    const response = await openaiForImages.images.generate({
      model: "dall-e-2",
      prompt,
      n: 1,
      size: "256x256"
    });
    const imageUrl = response.data?.[0]?.url || null;
    res.json({ imageUrl });
  } catch (e) {
    console.error("gratitude-image:", e);
    res.status(500).json({ imageUrl: null });
  }
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Positive Edu backend listening on http://localhost:${port}`);
});

