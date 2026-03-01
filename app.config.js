// 載入 .env，使 process.env.EXPO_PUBLIC_* 在 build 時可用
require("dotenv").config();

module.exports = {
  expo: {
    name: "Positive Education Companion",
    slug: "positive-edu-app",
    version: "1.0.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    assetBundlePatterns: ["**/*"],
    ios: { supportsTablet: true },
    android: {
      package: "com.positiveedu.companion"
    },
    web: { bundler: "metro", output: "single" },
    extra: {
      eas: {
        projectId: "2d7873c8-7bb2-48dd-9c7a-6e75d55f2c98"
      }
    }
  },
  extra: {
    firebase: {
      apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
    }
  }
};
