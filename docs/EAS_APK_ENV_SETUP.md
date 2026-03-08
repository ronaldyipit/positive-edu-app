# 讓 EAS 建出來的 APK 能正常運作

## 為什麼匯出的 APK 不能跑？

EAS Build 是在**雲端**建置，不會讀到你電腦的 `.env`（且 `.env` 已被 .gitignore，不會上傳）。  
所以建置時 `process.env.EXPO_PUBLIC_*` 都是**空的**，打進 APK 的 Firebase / Google 設定就是空的 → 一開就當或無法登入。

## 解法：在 EAS 專案裡設定環境變數

建置時必須讓 EAS 知道這些值，有兩種方式。

### 方式一：在 EAS 網頁設定（建議）

1. 打開 [expo.dev](https://expo.dev) → 登入 → 選你的專案 **positive-edu-app**。
2. 左側 **Project settings** → **Secrets and environment variables**（或 **Environment variables**）。
3. 選你要用的 build profile（例如 **production** 或 **preview**）。
4. 新增以下變數（名稱與本機 `.env` 一致，值從本機 `.env` 複製貼上）：

| 變數名稱 | 說明 |
|----------|------|
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Firebase API Key |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth Domain |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | Firebase Project ID |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase Storage Bucket |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase Messaging Sender ID |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | Firebase App ID |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google OAuth Web 用戶端 ID |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | Google OAuth Android 用戶端 ID（可選，與 Web 相同也可） |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Google OAuth iOS 用戶端 ID（可選） |

若有使用**後端教練 API**，再加：

| 變數名稱 | 說明 |
|----------|------|
| `EXPO_PUBLIC_COACH_API_URL` | 後端網址，例如 `https://你的後端網域.com`（不要用 localhost） |

5. 儲存後，**重新跑一次 EAS build**（同一個 profile），下載新的 APK 安裝測試。

### 方式二：用 EAS Secrets（進階）

若不想在網頁一個一個填，可以用指令把本機 `.env` 的值寫進 EAS：

```bash
# 在專案目錄執行，一次設一個（值從你本機 .env 複製）
eas secret:create --name EXPO_PUBLIC_FIREBASE_API_KEY --value "你的API_KEY" --scope project
eas secret:create --name EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN --value "你的AUTH_DOMAIN" --scope project
# ... 其他變數同理
```

然後在 **Project settings → Environment variables** 裡，把對應的 variable 設成從 secret 讀取（依 EAS 介面操作）。

---

## 建好後請確認

- 安裝新 APK 後能**開啟 App**（不閃退）。
- **登入／註冊**能成功（代表 Firebase 已帶入）。
- 若有呼叫後端，**EXPO_PUBLIC_COACH_API_URL** 要設成**正式環境網址**，不能是 `localhost`。
