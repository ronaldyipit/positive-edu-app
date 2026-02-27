# 全部 AI 功能實作 — 你需要提供的項目

以下為實現「心流計時、抒壓碎紙機、感恩卡」三模組全部 AI（NLP + 圖像 + 感測 + 推薦）時，你需要提供的東西。**沒有打勾的項目 = 不必提供，我會用現有設定或本機邏輯完成。**

---

## 一、後端 API 金鑰（backend/.env）

| 變數 | 用途 | 必須？ | 說明 |
|------|------|--------|------|
| `POE_API_KEY` | AI Coach、心流一句話、抒壓結語、感恩卡內文（NLP） | ✅ 已有 | 你現在教練用的同一個即可，不必改。 |
| `OPENAI_API_KEY` | 感恩卡 **AI 生成插圖**（DALL·E） | ⬜ 選填 | 若不提供：感恩卡仍會用 AI 生成**文字**，只是不會生成背景圖。若要插圖：到 [OpenAI API](https://platform.openai.com/api-keys) 申請 key。 |

**你只需要做：** 若要用「感恩卡 AI 插圖」，在 `backend/.env` 新增一行 `OPENAI_API_KEY=sk-...`。其餘不必提供任何新 key。

---

## 二、後端網址

前端已用 `EXPO_PUBLIC_COACH_API_URL`（預設 localhost:4000），新 API 在同一 backend，**不需提供**。

---

## 三、小結

1. **POE_API_KEY**：已有，不必改。
2. **OPENAI_API_KEY**（選填）：僅在要「感恩卡 AI 插圖」時在 `backend/.env` 加上。
3. 其餘**全部不必提供**。
