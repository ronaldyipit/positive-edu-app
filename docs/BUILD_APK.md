# 如何產生 APK

本專案為 Expo 專案，可用以下方式產生 Android APK。

---

## 方法一：EAS Build（建議，雲端建置）

不需在本機安裝 Android Studio，由 Expo 雲端幫你建置。

### 1. 安裝 EAS CLI

```bash
npm install -g eas-cli
```

### 2. 登入 Expo 帳號

```bash
eas login
```

若沒有帳號，先到 [expo.dev](https://expo.dev) 註冊。

### 3. 建置 APK

在專案根目錄執行：

```bash
# 預覽版 APK（適合測試、內部發放）
eas build --platform android --profile preview

# 或正式版 APK
eas build --platform android --profile production
```

建置完成後會得到下載連結，下載 `.apk` 即可安裝。

---

## 方法二：本機建置（需 Android 環境）

若已安裝 Android Studio 與 JDK，可在本機直接產生 APK。

### 1. 產生 Android 原生專案

```bash
npx expo prebuild --platform android
```

### 2. 建置 Release APK

```bash
cd android
./gradlew assembleRelease
```

**Windows（PowerShell）：**

```powershell
cd android
.\gradlew.bat assembleRelease
```

APK 輸出位置：`android/app/build/outputs/apk/release/app-release.apk`

---

## 目前設定說明

- `eas.json` 已設定 `buildType: "apk"`，產出為 **APK**（非 AAB）。
- 若之後要上架 Google Play，可改為 `"buildType": "app-bundle"` 產生 AAB。

---

## 若出現「jsc-android」或 JitPack「Read timed out」

1. **已加入 config plugin**：`plugins/withAndroidJscResolve.js` 會在 prebuild 時把 Gradle 的 HTTP 連線／讀取逾時調高為 3 分鐘，減少向 JitPack 拉取 `maven-metadata.xml` 時逾時。
2. **先重試建置**：網路或 JitPack 不穩時常是暫時的，多跑幾次 `eas build --platform android --profile preview` 有時就會成功。
3. 若仍失敗，可檢查 EAS 建置日誌是否為其他錯誤，或暫時改用本機建置（方法二）。
