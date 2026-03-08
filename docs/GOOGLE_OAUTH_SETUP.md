# Google 登入錯誤：flowName=GeneralOAuthFlow

出現 **flowName=GeneralOAuthFlow** 或 **401 invalid_client** 時，多半是 Google Cloud 的 OAuth 設定與 App 使用的 Client ID / Redirect URI 不一致。請依你目前執行方式對照下方設定。

---

## 一、用 **Expo Go** 跑（開發時）

Expo Go 會用 **auth.expo.io** 做轉址，所以要用「Web 應用程式」的 Client ID，並把 Expo 的 redirect URI 加進去。

### 1. Google Cloud Console

1. 打開 [Google Cloud Console](https://console.cloud.google.com/) → 選你的專案（與 Firebase 同一個）。
2. **APIs & Services** → **Credentials** → 找到類型為 **「Web 應用程式」** 的 OAuth 2.0 用戶端（通常是 Firebase 自動建立的那個）。
3. 編輯該 Web 用戶端，**務必加在「已授權的重新導向 URI」**（Authorized redirect URIs），**不是**「授權的 JavaScript 來源」：
   - **授權的 JavaScript 來源**（Authorized JavaScript origins）：只接受「來源」，**不能有路徑**，例如只填 `https://auth.expo.io`。若你填的網址含 `/@ronald_yip/positive-edu-app` 而出現 "URIs must not contain a path"，表示你填錯欄位了。
   - **已授權的重新導向 URI**（Authorized redirect URIs）：要填**完整網址含路徑**，在這裡新增一筆（把 `YOUR_EXPO_USERNAME` 換成你的 Expo 帳號）：

   ```
   https://auth.expo.io/@YOUR_EXPO_USERNAME/positive-edu-app
   ```

   例如帳號是 `ronald_yip` 就填：

   ```
   https://auth.expo.io/@ronald_yip/positive-edu-app
   ```

4. 儲存。

### 2. 環境變數（.env）

- **EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID** 必須是**這個 Web 用戶端**的「用戶端 ID」（一串結尾是 `.apps.googleusercontent.com`）。
- 用 Expo Go 時，**EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID** 可以不用設，或設成跟 Web 一樣也可以（Expo Go 會用 Web 流程）。

### 3. 重新啟動

改完 Console 與 .env 後，重開 `npx expo start` 再試一次 Google 登入。

---

## 二、用 **開發版 / 正式版 App**（EAS Build 或本機 build）

這時會用 **自訂 scheme** 做轉址（例如 `com.positiveedu.companion:/oauthredirect`），所以要用 **Android / iOS** 的 OAuth 用戶端。

### 1. Android

1. Google Cloud Console → **Credentials** → **Create Credentials** → **OAuth client ID**。
2. 應用程式類型選 **Android**。
3. 名稱自訂（例如「正發光 Android」）。
4. **套件名稱**填：`com.positiveedu.companion`（須與 `app.json` / `app.config.js` 的 `android.package` 一致）。
5. **SHA-1**：
   - Debug：在本機執行  
     `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android`  
     或 EAS 建置時在 Expo 的憑證頁可看到 SHA-1。
   - Release：用你簽署 APK 的 keystore 產生的 SHA-1。
6. 建立後，把產生的 **用戶端 ID** 設到 **EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID**（.env 與 EAS 的 secrets）。

### 2. Firebase

- Firebase Console → **Project settings** → **Your apps** → 選 Android app。
- 確認 **Package name** 是 `com.positiveedu.companion`。
- 若有「SHA certificate fingerprints」，請把上面同一個 SHA-1 加進去。

### 3. app.json / app.config.js

- 已設定 `scheme`: `com.positiveedu.companion`，redirect 會是 `com.positiveedu.companion:/oauthredirect`，無須再改。

### 4. iOS

1. Google Cloud Console → **Credentials** → **Create Credentials** → **OAuth client ID**。
2. 應用程式類型選 **iOS**。
3. 名稱自訂（例如「正發光 iOS」）。
4. **Bundle ID** 填：`com.positiveedu.companion`（須與 `app.config.js` 的 `expo.ios.bundleIdentifier` 一致；若未設則多數為 `expo.slug` 或從 app.json 讀取，請以 `npx expo config` 查詢實際值）。
5. 建立後，把產生的 **用戶端 ID** 設到 **EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID**（.env 與 EAS 的 secrets）。

---

## 三、檢查清單

| 項目 | Expo Go | 開發/正式 App (Android) |
|------|---------|---------------------------|
| 使用的 Client ID | Web 用戶端 | Android 用戶端 |
| 環境變數 | EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID | EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID（及 Web 給 Firebase 用） |
| Google Console 設定 | Web 用戶端加 redirect：`https://auth.expo.io/@USERNAME/positive-edu-app` | Android 用戶端：package `com.positiveedu.companion` + SHA-1 |
| Firebase | 同專案即可 | Android app 的 package + SHA-1 要正確 |

---

## 四、若仍出現 401 / invalid_client

1. **確認 .env 有被讀到**：改完 .env 一定要重開 `expo start`，必要時重開 Metro。
2. **確認沒有混用 Client ID**：Expo Go 用 Web；本機/正式 build 的 Android 用 Android Client ID。
3. **OAuth 同意畫面**：Google Cloud 的「OAuth consent screen」要填好並發佈（測試階段可先只加自己的 Gmail）。
4. **錯誤詳情**：若畫面上有「Request details」或更多錯誤碼，記下來對照 [Google OAuth 2.0 錯誤說明](https://developers.google.com/identity/oauth2/web/guides/error)。

完成上述設定後，再試一次 Google 登入；若錯誤訊息有變化，可把完整錯誤貼出來繼續排查。
