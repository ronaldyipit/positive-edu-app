// 載入 .env，使 process.env.EXPO_PUBLIC_* 在 build 時可用
require("dotenv").config();

module.exports = {
  expo: {
    name: "正發光",
    slug: "positive-edu-app",
    version: "1.0.0",
    /** EAS Update（bare workflow）：需手動設定固定 runtimeVersion 字串 */
    runtimeVersion: "1.0.0",
    updates: {
      url: "https://u.expo.dev/2d7873c8-7bb2-48dd-9c7a-6e75d55f2c98"
    },
    orientation: "portrait",
    scheme: "com.positiveedu.companion",
    userInterfaceStyle: "light",
    /** 建置 APK／IPA 時嘅啟動圖示（建議 1024×1024 PNG） */
    icon: "./assets/img/AppLogo.png",
    assetBundlePatterns: ["**/*"],
    ios: { supportsTablet: true },
    android: {
      package: "com.positiveedu.companion",
      // 強制使用 Hermes，避免向 JitPack 拉 jsc-android（Read timed out）
      jsEngine: "hermes",
      adaptiveIcon: {
        foregroundImage: "./assets/img/AppLogo.png",
        backgroundColor: "#fefce8"
      }
    },
    plugins: [
      "expo-updates",
      [
        "expo-media-library",
        {
          photosPermission: "「正發光」需要存取你的相簿，以便儲存感恩卡圖片。",
          savePhotosPermission: "「正發光」需要將感恩卡圖片儲存至你的相簿。",
          granularPermissions: ["photo"]
        }
      ]
    ],
    web: { bundler: "metro", output: "single" },
    extra: {
      eas: {
        projectId: "2d7873c8-7bb2-48dd-9c7a-6e75d55f2c98"
      },
      firebase: {
        apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
        webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
      },
      googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      // Expo Go：若 getRedirectUrl() 失敗時用此 URI（須與 Google Console 已授權的重新導向 URI 一致）
      expoAuthRedirectUri: process.env.EXPO_PUBLIC_EXPO_AUTH_REDIRECT_URI
    }
  }
};
