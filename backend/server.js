require("dotenv").config();
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const admin = require("firebase-admin");
const OpenAI = require("openai");

// ── Firebase Admin（用於伺服器端重設密碼） ──
if (!admin.apps.length && process.env.FIREBASE_PROJECT_ID) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n")
    })
  });
}

const app = express();
app.use(cors());
app.use(express.json());

// ── OTP helpers (stateless HMAC — no DB needed, works on Vercel serverless) ──
const OTP_SECRET = process.env.OTP_SECRET || "change-me-to-a-random-string";
const OTP_EXPIRY_MS = 5 * 60 * 1000;

const smtpTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587", 10),
  secure: process.env.SMTP_SECURE === "true",
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

function generateOtp() {
  return crypto.randomInt(100000, 999999).toString();
}

function hmacOtp(email, otp, expiresAt) {
  return crypto.createHmac("sha256", OTP_SECRET).update(`${email}:${otp}:${expiresAt}`).digest("hex");
}

const poeApiKey = process.env.POE_API_KEY;

const client = new OpenAI({
  apiKey: poeApiKey,
  baseURL: "https://api.poe.com/v1"
});

// 根路徑：方便確認 API 已部署（瀏覽器開根網址唔會再顯示 Cannot GET /）
app.get("/", (req, res) => {
  res.json({ ok: true, message: "Positive Edu API is running. Use /api/coach, /api/gratitude-text, etc." });
});

// ── OTP：發送驗證碼 ──
app.post("/api/send-otp", async (req, res) => {
  const { email } = req.body || {};
  if (!email?.trim()) return res.status(400).json({ error: "email is required." });

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return res.status(503).json({ error: "SMTP not configured on server." });
  }

  const normalised = email.trim().toLowerCase();
  const otp = generateOtp();
  const expiresAt = Date.now() + OTP_EXPIRY_MS;
  const token = hmacOtp(normalised, otp, expiresAt);

  try {
    await smtpTransporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: normalised,
      subject: "正發光 — 電郵驗證碼",
      html:
        `<div style="font-family:sans-serif;max-width:420px;margin:auto;padding:24px">` +
        `<h2 style="color:#d56c2f">正發光 驗證碼</h2>` +
        `<p>你的驗證碼是：</p>` +
        `<p style="font-size:32px;letter-spacing:6px;font-weight:bold;color:#1c1917">${otp}</p>` +
        `<p style="color:#78716c;font-size:13px">此驗證碼將於 5 分鐘後失效。如非本人操作，請忽略此郵件。</p>` +
        `</div>`
    });
  } catch (err) {
    console.error("send-otp mail error:", err);
    return res.status(500).json({ error: "發送驗證碼失敗，請稍後再試。" });
  }

  res.json({ token, expiresAt });
});

// ── OTP：驗證碼驗證 ──
app.post("/api/verify-otp", (req, res) => {
  const { email, otp, token, expiresAt } = req.body || {};
  if (!email || !otp || !token || !expiresAt) {
    return res.status(400).json({ valid: false, error: "Missing parameters." });
  }
  if (Date.now() > expiresAt) {
    return res.json({ valid: false, error: "驗證碼已過期，請重新發送。" });
  }
  const normalised = email.trim().toLowerCase();
  const expected = hmacOtp(normalised, otp.trim(), expiresAt);
  const valid = expected === token;
  res.json({ valid, ...(valid ? {} : { error: "驗證碼不正確。" }) });
});

// ── 重設密碼（OTP 驗證 + Firebase Admin 改密碼） ──
app.post("/api/reset-password", async (req, res) => {
  const { email, otp, token, expiresAt, newPassword } = req.body || {};
  if (!email || !otp || !token || !expiresAt || !newPassword) {
    return res.status(400).json({ error: "缺少必要參數。" });
  }
  if (Date.now() > expiresAt) {
    return res.status(400).json({ error: "驗證碼已過期，請重新發送。" });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: "密碼至少需要 8 個字元。" });
  }
  if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) ||
      !/[0-9]/.test(newPassword) || !/[!@#$%^&*()_+\-=\[\]{}|;:'",.<>?/\\]/.test(newPassword)) {
    return res.status(400).json({ error: "密碼須包含大寫字母、小寫字母、數字及特殊字符。" });
  }

  const normalised = email.trim().toLowerCase();
  const expected = hmacOtp(normalised, otp.trim(), expiresAt);
  if (expected !== token) {
    return res.status(400).json({ error: "驗證碼不正確。" });
  }

  if (!admin.apps.length) {
    return res.status(503).json({ error: "Firebase Admin 未設定，無法重設密碼。" });
  }

  try {
    const userRecord = await admin.auth().getUserByEmail(normalised);
    await admin.auth().updateUser(userRecord.uid, { password: newPassword });
    res.json({ success: true });
  } catch (err) {
    console.error("reset-password error:", err);
    const code = err?.code || "";
    if (code.includes("user-not-found")) {
      return res.status(400).json({ error: "此電子郵件尚未註冊。" });
    }
    res.status(500).json({ error: "重設密碼失敗，請稍後再試。" });
  }
});

/** 供 AI 教練回答「App 點用」—須與實際 Tab／功能一致 */
const ZHENG_FA_GUANG_APP_GUIDE = `
【正發光 App 功能速覽 — 只作事實說明用】
底部有六個分頁（名稱以畫面為準）：
1) 主頁：進入各模組的入口、簡短介紹；可看到等級與 EXP 總覽（每 100 EXP 升一級，共 10 個級名）。
2) 正向教練（你而家呢頁）：先選 3 個「性格優勢」，再同 AI 教練傾偈；可用情緒快捷句開場。若從「離線深潛」帶過嚟，輸入框可預填深潛心得。
3) 離線深潛：專注計時、可選時長；開始前可發「報平安」WhatsApp／SMS；有「什麼是心流」說明；計時中可長按約 5 秒提早結束。完整跑完一次（無提早結束）可獲 +20 EXP；結束後有時間感回顧，亦可一鍵帶內容返嚟正向教練傾。
4) 抒壓（畫面標題：抒壓碎紙機）：寫低煩惱／壓力 → 搖機碎紙動畫 → 跟住做呼吸練習，幫身體同心情暫時鬆一鬆。
5) 感恩（分頁標籤顯示：火炬傳暖）：三種方式—寫感謝訊息（成功傳送 +20 EXP）、默默報答同一個人（標記完成 +15）、把善意傳揚開去（標記完成 +30）；有「火炬行動簿」記錄任務，未完成可編輯／分頁瀏覽。
6) 設定：帳戶與等級詳情、登出等。
說明：EXP 獎勵以裝置內記錄為準；唔好承諾 App 冇寫明嘅功能。若使用者問到指南冇寫嘅細節，請話「我唔肯定呢項設定」並建議佢喺相關分頁試下或睇畫面說明。
`.trim();

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
      "APP HELP EXCEPTION: If the user is clearly asking how the app works, where to find a feature, what a tab does, or how to get EXP, " +
      "answer factually using ONLY the guide below (do not invent features). Use up to 5 short sentences; a closing Socratic question is optional. " +
      "If the guide does not cover their question, say honestly that you are unsure and suggest they open that tab or check on-screen hints. " +
      "\n\n" +
      ZHENG_FA_GUANG_APP_GUIDE +
      "\n\n" +
      "If the user hints at self-harm or severe distress, encourage them to seek immediate help from a trusted adult, " +
      "school social worker, or call the Samaritan Befrienders Hong Kong hotline 2389-2222. " +
      "WORRY + SHREDDER LINK: When the user clearly carries worry, rumination, stress, or a problem that cannot be fixed immediately, you may respond in Traditional Chinese (Cantonese-friendly when natural). " +
      "In the same reply: (1) Affirm that they can keep talking with you here—傾訴、整理思緒都好有用；it is not either/or. " +
      "(2) Also mention that they *may additionally* open the in-app 「抒壓碎紙機」—把煩惱寫出來、配合搖動與呼吸—作為另一條抒發途徑，唔係叫人逃避問題，而係先讓身心情緒有出口。 " +
      "(3) **Before** the token, you MUST include 1–2 sentences that clearly state **why** you are suggesting the shredder *right now* " +
      "(e.g. 心入面太脹、未講得清；寫低同身體一齊「放」一陣，有時會易啲再諗同再傾). This reason must appear in normal text; do not hide it after [[SHREDDER]]. " +
      "(4) End the entire reply with a new line and the exact token [[SHREDDER]] alone (no punctuation after it). " +
      "When using this pattern, you may use up to 6 short sentences total (slightly longer than usual). " +
      "Do not add [[SHREDDER]] on every reply; skip it for light or neutral topics.";

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

// 深潛收尾：心流時差一句 + AI 深潛小結（2–4 句），單次呼叫
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
      "你是「正發光」App 的深潛收尾助手，讀者為香港中學生。用戶完成離線深潛：自覺過了 felt 分鐘，實際 actual 分鐘，任務為 task。 " +
      "只輸出一個 JSON 物件（不要 markdown、不要程式碼框），鍵名固定： " +
      '{"brief":"繁體中文一句話約 25–45 字，呼應 felt 與 actual 的心流時差，溫暖、唔說教。若 actual>felt 可暗示專注到唔覺時間快；actual<felt 可暗示時間感好充實；相近就話節奏啱啱好。",' +
      '"summary":"繁體中文一段，必須 2 至 4 個完整句子。先肯定佢完成深潛；中間一句輕觸心流／專注（可提挑戰與技能要平衡、或訂清晰小目標）；最後一句係明日可以試嘅具體小建議。口語自然，唔好用英文術語堆砌。"}';

    const userMessage = JSON.stringify({ felt, actual, task: taskStr });

    const response = await client.chat.completions.create({
      model: "GPT-5.2",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      temperature: 0.55
    });
    let raw = response.choices[0]?.message?.content?.trim() || "";
    if (raw.startsWith("```")) {
      raw = raw.replace(/^```\w*\r?\n?/, "").replace(/\r?\n?```\s*$/, "");
    }
    let brief = "";
    let summary = "";
    try {
      const j = JSON.parse(raw);
      brief = String(j.brief || j.message || "").trim();
      summary = String(j.summary || "").trim();
    } catch {
      brief = raw.slice(0, 120).replace(/\n/g, " ");
    }
    if (!brief) {
      brief =
        actual > felt
          ? "剛才你專注到時間好似過得好快，呢種感覺好難得。"
          : actual < felt
            ? "你覺得過咗好耐，代表你有投入喺件事上面。"
            : "你同時間節奏好夾，呢段深潛好穩陣。";
    }
    if (!summary) {
      summary =
        "你願意俾自己一段離線專注嘅時間，已經好難得。心流好多時出現喺「有挑戰但做得到」同目標清晰嘅時候。下次可以試住開場先用一句寫低「今次要做到邊一步」，再開始計時，會更易進入狀態。";
    }
    res.json({ message: brief, summary });
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

