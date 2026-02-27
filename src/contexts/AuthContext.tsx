import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup
} from "firebase/auth";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import Constants from "expo-constants";
import { auth } from "../config/firebase";

WebBrowser.maybeCompleteAuthSession();

type AuthContextType = {
  user: User | null;
  loading: boolean;
  googleLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  authError: string | null;
  clearAuthError: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const extra = (Constants.expoConfig as {
  extra?: { firebase?: { webClientId?: string } };
})?.extra?.firebase;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // expo-auth-session — 用於 iOS / Android（原生）
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: extra?.webClientId ?? process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
  });

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 處理原生 OAuth 回應（iOS / Android）
  useEffect(() => {
    if (Platform.OS === "web") return;
    if (response?.type === "success") {
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);
      if (!auth) return;
      setGoogleLoading(true);
      signInWithCredential(auth, credential)
        .catch((e: unknown) => {
          const msg = e instanceof Error ? e.message : "Google 登入失敗";
          setAuthError(firebaseErrorToZh(msg));
        })
        .finally(() => setGoogleLoading(false));
    } else if (response?.type === "error") {
      setAuthError("Google 登入失敗，請再試一次。");
      setGoogleLoading(false);
    }
  }, [response]);

  const signIn = async (email: string, password: string) => {
    if (!auth) throw new Error("Firebase Auth 未設定");
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "登入失敗";
      setAuthError(firebaseErrorToZh(msg));
      throw e;
    }
  };

  const signUp = async (email: string, password: string) => {
    if (!auth) throw new Error("Firebase Auth 未設定");
    setAuthError(null);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "註冊失敗";
      setAuthError(firebaseErrorToZh(msg));
      throw e;
    }
  };

  const signOut = async () => {
    if (!auth) return;
    setAuthError(null);
    await firebaseSignOut(auth);
  };

  const signInWithGoogle = async () => {
    if (!auth) {
      setAuthError("Firebase Auth 未設定");
      return;
    }
    setAuthError(null);
    setGoogleLoading(true);
    try {
      if (Platform.OS === "web") {
        // Web：使用 Firebase 原生 Popup，避免 COOP 問題
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
      } else {
        // iOS / Android：使用 expo-auth-session
        if (!request) {
          setAuthError("Google 登入尚未準備好，請稍後再試。");
          setGoogleLoading(false);
          return;
        }
        await promptAsync();
        // 結果由上面的 useEffect 處理，所以這裡不 setGoogleLoading(false)
        return;
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Google 登入失敗";
      setAuthError(firebaseErrorToZh(msg));
    } finally {
      setGoogleLoading(false);
    }
  };

  const clearAuthError = () => setAuthError(null);

  const value: AuthContextType = {
    user,
    loading,
    googleLoading,
    signIn,
    signUp,
    signOut,
    signInWithGoogle,
    authError,
    clearAuthError
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) throw new Error("useAuth 必須在 AuthProvider 內使用");
  return ctx;
}

function firebaseErrorToZh(message: string): string {
  if (message.includes("auth/invalid-email")) return "請輸入有效的電子郵件地址。";
  if (message.includes("auth/user-disabled")) return "此帳號已被停用。";
  if (message.includes("auth/user-not-found") || message.includes("auth/wrong-password"))
    return "電子郵件或密碼錯誤。";
  if (message.includes("auth/email-already-in-use")) return "此電子郵件已被註冊。";
  if (message.includes("auth/weak-password")) return "密碼至少需要 6 個字元。";
  if (message.includes("auth/too-many-requests")) return "嘗試次數過多，請稍後再試。";
  if (message.includes("auth/network-request-failed")) return "網路錯誤，請檢查連線。";
  if (message.includes("auth/popup-blocked")) return "請允許彈出視窗以使用 Google 登入。";
  if (message.includes("auth/popup-closed-by-user")) return "Google 登入視窗已關閉，請再試一次。";
  return message || "發生錯誤，請稍後再試。";
}
