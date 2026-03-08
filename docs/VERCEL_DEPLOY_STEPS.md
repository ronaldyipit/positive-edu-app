# 用 Vercel 部署 Backend（Step-by-Step）

Backend 已加上 Vercel 所需設定，照下面步驟即可把 API 放上 Vercel，APK 再指去呢個網址就用到 AI 功能。

---

## Step 1：準備 POE API Key

1. 去 [poe.com/api](https://poe.com/api) 或 [poe.com/api/keys](https://poe.com/api/keys) 登入並建立 **API key**。
2. 複製呢個 key，之後 Step 4 會用。

---

## Step 2：安裝 Vercel CLI（可選，用網頁 deploy 可略過）

```bash
npm i -g vercel
```

（若你打算用網頁「Import Git」部署，可以唔裝。）

---

## Step 3：把 Backend 部署上 Vercel

### 方法 A：用 Vercel 網頁 + Git（建議）

1. 打開 [vercel.com](https://vercel.com)，登入（可用 GitHub）。
2. 按 **Add New… → Project**。
3. **Import** 你放 `positive-edu-app` 嘅 Git repository（GitHub / GitLab 等）。
4. **Root Directory** 要改做：`backend`  
   （唔係成個 repo，只係 `backend` 呢個 folder）。
5. **Framework Preset** 揀 **Other**（或 None）。
6. 唔好咁快 Deploy，先去 **Step 4** 加環境變數。

### 方法 B：用 CLI 從本機 deploy

1. 開 terminal，入 backend 目錄：
   ```bash
   cd c:\Users\Ronald\Desktop\positive-edu-app\backend
   ```
2. 執行：
   ```bash
   vercel
   ```
3. 第一次會問你 login、link 去 Vercel 專案，照指示做。
4. 問 **Set up and deploy?** 揀 **Y**，等 build 同 deploy 完成。
5. 完成後 terminal 會顯示一個 URL，例如：  
   `https://positive-edu-backend-xxx.vercel.app`  
   呢個就係你嘅 **後端網址**。

---

## Step 4：在 Vercel 設定環境變數（一定要做）

1. 去 [vercel.com](https://vercel.com) → 揀你個 **Project**（即係 backend 嗰個）。
2. 上方 **Settings** → 左邊 **Environment Variables**。
3. 新增一項：
   - **Name:** `POE_API_KEY`
   - **Value:** 你喺 Step 1 複製嘅 POE API key
   - **Environment:** 三個都勾（Production、Preview、Development）。
4. 儲存後，**重新 Deploy 一次**（Deployments → 右上 ⋮ → Redeploy），環境變數先會生效。

---

## Step 5：記低 Backend URL

- Deploy 完成後，Vercel 會俾一個 URL，例如：  
  `https://positive-edu-backend-xxxx.vercel.app`
- 唔好加尾嘅 `/`，例如：  
  ✅ `https://positive-edu-backend-xxxx.vercel.app`  
  ❌ `https://positive-edu-backend-xxxx.vercel.app/`

---

## Step 6：在 EAS 設 APK 用嘅後端網址

1. 打開 [expo.dev](https://expo.dev) → 你個專案 **positive-edu-app**。
2. **Project settings** → **Secrets and environment variables**。
3. 揀你 build APK 用嘅 profile（例如 **production**）。
4. 新增：
   - **Name:** `EXPO_PUBLIC_COACH_API_URL`
   - **Value:** 你喺 Step 5 記低嘅 Vercel URL（例如 `https://positive-edu-backend-xxxx.vercel.app`）
5. 儲存。

---

## Step 7：重新 Build APK

```bash
eas build --platform android --profile production --clear-cache
```

（若你用 preview profile，就改做 `--profile preview`。）

Build 完裝新 APK，AI 功能就會 call Vercel 上嘅 backend。

---

## 本機開發（可選）

- 本機跑 backend：喺 `backend` 目錄執行 `npm run dev`，app 用 `http://localhost:4000` 或你 .env 嘅 `EXPO_PUBLIC_COACH_API_URL`。
- 本機試 Vercel 環境：喺 `backend` 執行 `vercel dev`，會用 Vercel 嘅環境變數同路由。

---

## 常見問題

- **404 / 500：** 確認 Vercel 專案 **Root Directory** 係 `backend`，同埋已 **Redeploy** 過一次。
- **POE 錯誤：** 確認 Vercel 已 set `POE_API_KEY`，並且 Redeploy。
- **APK 仍然 call 唔到：** 確認 EAS 有 set `EXPO_PUBLIC_COACH_API_URL` 做 Vercel URL，再重新 build APK。
