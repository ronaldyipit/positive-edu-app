require("dotenv").config();
const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");

const app = express();
app.use(cors());
app.use(express.json());

const poeApiKey = process.env.POE_API_KEY;

const client = new OpenAI({
  apiKey: poeApiKey,
  baseURL: "https://api.poe.com/v1"
});

app.post("/api/coach", async (req, res) => {
  try {
    if (!poeApiKey) {
      return res.status(500).json({ error: "POE_API_KEY is not configured on the server." });
    }

    const { messages, strengths } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages array is required." });
    }

    // 根據學生選擇的 Signature Strengths 動態調整 system prompt
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

// 感恩卡：用 POE API 生成內文（與 /api/coach 同一支 POE_API_KEY）
app.post("/api/gratitude-text", async (req, res) => {
  try {
    if (!poeApiKey) {
      return res.status(503).json({ error: "POE_API_KEY is not configured." });
    }
    const { recipient, keyword } = req.body || {};
    if (!recipient?.trim() || !keyword?.trim()) {
      return res.status(400).json({ error: "recipient and keyword are required." });
    }
    const systemPrompt =
      "你是「感恩卡」撰文助手，請用廣東話寫一段簡短、真摯的感恩卡內文。 " +
      "對象與關鍵字由用戶提供。文長約 3～5 句，語氣溫暖、具體，用口語化廣東話，不要書面語或說教。 " +
      "只輸出卡片內文，不要標題或額外說明。";
    const userMessage = `收件人：${recipient.trim()}\n感謝嘅主題／關鍵字：${keyword.trim()}\n請用廣東話寫一段感恩卡內文。`;
    const response = await client.chat.completions.create({
      model: "GPT-5.2",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      temperature: 0.7
    });
    const text = response.choices[0]?.message?.content?.trim() || "";
    if (!text) return res.status(500).json({ error: "No text generated." });
    res.json({ text });
  } catch (error) {
    console.error("Error in /api/gratitude-text:", error);
    res.status(500).json({ error: "Gratitude text generation failed." });
  }
});

// 深潛「心流時差」：根據用戶覺得的時間 vs 實際時間，生成一句 AI 回饋（繁體中文）
app.post("/api/flow-time-feedback", async (req, res) => {
  try {
    if (!poeApiKey) {
      return res.status(503).json({ error: "POE_API_KEY is not configured." });
    }
    const { feltMinutes, actualMinutes, task } = req.body || {};
    const felt = Math.max(0, parseInt(String(feltMinutes), 10) || 0);
    const actual = Math.max(0, parseInt(String(actualMinutes), 10) || 0);
    const taskStr = typeof task === "string" && task.trim() ? task.trim() : "剛才的活動";

    const systemPrompt =
      "你是「正發光」App 的心流回饋助手。用戶完成一段深潛後，會輸入「我覺得過了 X 分鐘」與「實際 Y 分鐘」。 " +
      "請根據 X 與 Y 的關係，用繁體中文寫「一句」溫暖、簡短的回饋（約 20–40 字），不要說教。 " +
      "若實際 > 覺得：時間過得比感覺快，可肯定他進入深層心流、專注。 " +
      "若實際 < 覺得：時間過得比感覺慢，可肯定他投入當下、時間感充實。 " +
      "若實際 ≈ 覺得：可說他與時間同步、心流剛剛好。 " +
      "只輸出那一句話，不要標題、不要引號、不要換行。";
    const userMessage = `用戶覺得過了 ${felt} 分鐘，實際是 ${actual} 分鐘。任務／情境：${taskStr}。請給一句回饋。`;

    const response = await client.chat.completions.create({
      model: "GPT-5.2",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      temperature: 0.6
    });
    const message = response.choices[0]?.message?.content?.trim() || "";
    if (!message) return res.status(500).json({ error: "No feedback generated." });
    res.json({ message });
  } catch (error) {
    console.error("Error in /api/flow-time-feedback:", error);
    res.status(500).json({ error: "Flow time feedback failed." });
  }
});

// 感恩卡插圖：用同一個 POE API KEY，透過 Poe 的圖片模型生成（OpenAI 相容介面）
// 若 images.generate 不支援，可改為 chat.completions + 圖片模型，依 Poe 回傳格式解析 URL
app.post("/api/gratitude-image", async (req, res) => {
  try {
    if (!poeApiKey) {
      return res.status(503).json({ error: "POE_API_KEY is not configured. Set it in backend/.env for AI illustration." });
    }
    const { recipient, keyword } = req.body || {};
    if (!recipient?.trim() || !keyword?.trim()) {
      return res.status(400).json({ error: "recipient and keyword are required." });
    }
    const prompt =
      `A warm, gentle illustration for a gratitude card. Recipient: ${recipient.trim()}. Theme: ${keyword.trim()}. ` +
      "Style: soft colors, simple and heartwarming, suitable for a thank-you card. No text in the image.";

    let imageUrl = null;

    // 先嘗試 OpenAI 標準 images API（Poe 若支援會回傳）
    try {
      const imageResp = await client.images.generate({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1024x1024",
        response_format: "url",
        quality: "standard"
      });
      imageUrl = imageResp.data?.[0]?.url ?? null;
    } catch (imgErr) {
      const err = imgErr || {};
      const msg = err?.error?.message || err?.message || String(imgErr);
      const code = err?.status;
      console.error("Poe images.generate failed:", code, msg);
      // 若 Poe 不支援 images 端點，改試 chat 型圖片模型（部分 Poe 模型用 chat 回傳圖片 URL）
      try {
        const chatResp = await client.chat.completions.create({
          model: "GPT-Image-1",
          messages: [{ role: "user", content: prompt }],
          stream: false
        });
        const content = chatResp.choices?.[0]?.message?.content ?? "";
        const urlMatch = content.match(/https?:\/\/[^\s\)\]"]+/);
        if (urlMatch) imageUrl = urlMatch[0];
      } catch (chatErr) {
        const c = chatErr || {};
        console.error("Poe chat image fallback failed:", c?.error?.message || c?.message);
        return res.status(500).json({
          error: "Gratitude image generation failed.",
          detail: msg || (c?.error?.message || c?.message) || "Check server logs."
        });
      }
    }

    if (!imageUrl) return res.status(500).json({ error: "No image URL returned from Poe." });
    res.json({ imageUrl });
  } catch (error) {
    const err = error || {};
    console.error("Error in /api/gratitude-image:", err);
    res.status(500).json({
      error: "Gratitude image generation failed.",
      detail: err?.error?.message || err?.message || "See server console."
    });
  }
});

// 流程計時反思（App 有 call，若未實作可回傳簡單訊息）
app.post("/api/timer-reflection", async (req, res) => {
  try {
    if (!poeApiKey) {
      return res.status(503).json({ error: "POE_API_KEY is not configured." });
    }
    const body = req.body || {};
    const systemPrompt =
      "你是「正發光」App 的反思助手。用戶完成流程計時後會分享感受。請用繁體中文回一句簡短、溫暖的反思（約 20–40 字）。只輸出那一句。";
    const userContent = typeof body.reflection === "string" ? body.reflection : JSON.stringify(body);
    const response = await client.chat.completions.create({
      model: "GPT-5.2",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent }
      ],
      temperature: 0.6
    });
    const message = response.choices[0]?.message?.content?.trim() || "做得很好，繼續保持。";
    res.json({ message });
  } catch (error) {
    console.error("Error in /api/timer-reflection:", error);
    res.status(500).json({ message: "反思生成失敗，下次再試。" });
  }
});

// 身體釋放完成（App 有 call，回傳一句收尾語）
app.post("/api/somatic-done", async (req, res) => {
  try {
    if (!poeApiKey) {
      return res.json({ message: "今日嘅釋放完成，好好休息。" });
    }
    const response = await client.chat.completions.create({
      model: "GPT-5.2",
      messages: [
        { role: "system", content: "你是「正發光」App 的身體釋放收尾助手。用廣東話寫一句簡短、溫暖的收尾語（約 15–30 字）。只輸出那一句。" },
        { role: "user", content: "用戶剛完成身體釋放練習，請給一句收尾語。" }
      ],
      temperature: 0.7
    });
    const message = response.choices[0]?.message?.content?.trim() || "今日嘅釋放完成，好好休息。";
    res.json({ message });
  } catch (error) {
    console.error("Error in /api/somatic-done:", error);
    res.json({ message: "今日嘅釋放完成，好好休息。" });
  }
});

const port = process.env.PORT || 4000;
if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Positive Edu backend listening on http://localhost:${port}`);
  });
}

module.exports = app;

