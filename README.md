# Positive Education Companion (PERMA+H)

This React Native (Expo) mobile app is based on the project proposal **"Developing an AI-Assisted Positive Education Mobile Application for Secondary School Students in Hong Kong"**. It acts as a strengths-based, preventive well-being companion aligned with the **PERMA+H** model.

## Modules and PERMA+H Mapping

- **AI Positive Mindset Coach (Meaning – M)**  
  - Tab: `AI Coach`  
  - A Socratic-style chat interface that asks reflective, growth-mindset questions rather than giving clinical advice or diagnosis.

- **Flow Focus Timer (Engagement & Accomplishment – E, A)**  
  - Tab: `Flow Timer`  
  - A 25-minute focus timer that converts completed sessions into **XP**, levels, and badges to make persistence visible.

- **Somatic Venting Shredder (Positive Emotions & Health – P, H)**  
  - Tab: `Shredder`  
  - Users write out a stressor, symbolically “shred” it, then follow a simple animated breathing cycle for somatic down-regulation.

- **Gratitude Card Maker (Relationships – R)**  
  - Tab: `Gratitude`  
  - Generates a short gratitude message/card for a chosen recipient and keyword, to reduce social anxiety around expressing thanks.

## 登入與認證（Firebase Authentication）

App 使用 **Firebase Authentication**（Email／密碼）實作登入、註冊與登出。

### 設定步驟

1. 在 [Firebase Console](https://console.firebase.google.com/) 建立專案（或使用既有專案）。
2. 在專案中啟用 **Authentication** → **Sign-in method** → 開啟 **電子郵件/密碼**。
3. 在專案設定 → **一般** → **您的應用程式** 中新增 **Web** 應用程式，取得 `firebaseConfig`。
4. 在專案根目錄複製環境變數範例並填入 Firebase 設定：

   ```bash
   cp .env.example .env
   ```

   編輯 `.env`，填入：

   ```env
   EXPO_PUBLIC_FIREBASE_API_KEY=你的_api_key
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=你的專案.firebaseapp.com
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=你的專案_id
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=你的專案.appspot.com
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=數字
   EXPO_PUBLIC_FIREBASE_APP_ID=你的_app_id
   ```

5. 重新啟動 Expo（`npx expo start`）。未設定時會顯示登入頁，但登入／註冊會提示「Firebase Auth 未設定」。

### 功能說明

- **登入頁**：電子郵件 + 密碼，可導向註冊。
- **註冊頁**：電子郵件 + 密碼 + 確認密碼，密碼至少 6 字元。
- **設定頁**（底部 Tab「設定」）：顯示目前帳號、**登出**。
- 登入狀態會持久化，重新開啟 App 無需再次登入。

---

## Getting Started

1. **Install dependencies**

   ```bash
   cd positive-edu-app
   npm install
   ```

2. **Run the mobile app (Expo)**

   ```bash
   npx expo start
   ```

3. **Open on device or emulator**

   - Use the Expo Go app on your phone or run on an emulator from the Expo Dev Tools.

## AI Coach Backend (Node.js + Poe GPT-5.2)

The `AI Coach` tab can connect to a separate Node.js/Express backend that calls **GPT-5.2 via the Poe API**.  
The backend lives in the `backend` folder and exposes a single endpoint: `POST /api/coach`.

### Backend setup

```bash
cd backend
npm install
cp .env.example .env   # 在 .env 裡填入你的 POE_API_KEY
npm start              # 或 npm run dev 使用 nodemon
```

`.env` 檔案內容（範例）：

```env
POE_API_KEY=your_poe_api_key_here
PORT=4000
```

### Frontend connection

- `AICoachScreen.tsx` 會向 `COACH_API_BASE + /api/coach` 發送請求。  
- 預設寫法是 `http://localhost:4000`，如要在真機測試，請改成電腦在區域網路中的 IP，例如：

```ts
// AICoachScreen.tsx 片段
const COACH_API_BASE = "http://192.168.0.10:4000"; // 替換成你自己的 IP
```

**安全提醒**：`POE_API_KEY` 只應該放在後端 `.env` 中，絕對不要放進 React Native 前端程式碼或公開儲存庫。

## AI Coach API Integration (Optional)

The current `AI Coach` tab uses a built-in, strengths-based reflective reply template so the app runs without API keys.  
You can later connect it to an LLM provider (e.g. OpenAI) by:

- Adding a small API client that sends the full conversation plus a **strict “Socratic Coach” system prompt**.
- Storing API keys securely in environment variables (never hard-coded in the repo).

## Ethical Notes

This app is designed as an **educational, preventive, non-clinical tool** and should **not** be used as a substitute for professional mental health services. It is intended for expert proxy evaluation first (e.g., educators, social workers, parents) following the original proposal.

