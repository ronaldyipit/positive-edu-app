// 載入 .env，使 process.env.EXPO_PUBLIC_* 在 build 時可用
require("dotenv").config();

module.exports = {
  expo: {
    name: "正發光",
    slug: "positive-edu-app",
    version: "1.0.0",
    orientation: "portrait",
    scheme: "com.positiveedu.companion",
    userInterfaceStyle: "light",
    assetBundlePatterns: ["**/*"],
    ios: { supportsTablet: true },
    android: {
      package: "com.positiveedu.companion",
      // Use JSC so EAS Build doesn't need hermesc (avoids "problem occurred starting process").
      // Hermes remains default on iOS. If JitPack times out, consider a custom image or retry.
      jsEngine: "jsc"
    },
    plugins: [],
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
