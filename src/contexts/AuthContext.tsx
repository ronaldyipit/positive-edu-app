import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import {
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth } from "../config/firebase";
import { db } from "../config/firebase";
import { AUTH_EMAIL_OTP_ENABLED } from "../config/authOtp";

type AuthContextType = {
  user: User | null;
  loading: boolean;
  isFirebaseConfigured: boolean;
  /** true = Firebase 已登入但尚未通過 OTP 驗證 */
  pendingOtp: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName?: string, grade?: string, school?: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** OTP 驗證通過後呼叫，解除攔截讓 user 進入主畫面 */
  confirmOtp: () => void;
  /** 取消 OTP 流程，登出 Firebase */
  cancelOtp: () => Promise<void>;
  /** 發送重設密碼電郵 */
  resetPassword: (email: string) => Promise<void>;
  authError: string | null;
  clearAuthError: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [pendingOtp, setPendingOtp] = useState(false);
  const loginOtpFlagRef = useRef(false);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u && loginOtpFlagRef.current) {
        setPendingOtp(true);
        loginOtpFlagRef.current = false;
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!auth) throw new Error("Firebase Auth 未設定");
    setAuthError(null);
    try {
      loginOtpFlagRef.current = AUTH_EMAIL_OTP_ENABLED;
      await signInWithEmailAndPassword(auth, email, password);
      setPendingOtp(AUTH_EMAIL_OTP_ENABLED);
    } catch (e: any) {
      loginOtpFlagRef.current = false;
      const code = e?.code || "";
      const msg = e?.message || "登入失敗";
      setAuthError(firebaseErrorToZh(code || msg));
      throw e;
    }
  };

  const signUp = async (
    email: string,
    password: string,
    displayName?: string,
    grade?: string,
    school?: string
  ) => {
    if (!auth) throw new Error("Firebase Auth 未設定");
    setAuthError(null);
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName?.trim()) {
        await updateProfile(user, { displayName: displayName.trim() });
      }
      if (db && (displayName?.trim() || grade || school)) {
        await setDoc(doc(db, "users", user.uid), {
          displayName: displayName?.trim() || null,
          grade: grade || null,
          school: school?.trim() || null,
          updatedAt: new Date().toISOString()
        });
      }
    } catch (e: any) {
      const code = e?.code || "";
      const msg = e?.message || "註冊失敗";
      setAuthError(firebaseErrorToZh(code || msg));
      throw e;
    }
  };

  const signOut = async () => {
    if (!auth) return;
    setAuthError(null);
    setPendingOtp(false);
    await firebaseSignOut(auth);
  };

  const confirmOtp = () => setPendingOtp(false);

  const cancelOtp = async () => {
    setPendingOtp(false);
    if (auth) await firebaseSignOut(auth);
  };

  const resetPassword = async (email: string) => {
    if (!auth) throw new Error("Firebase Auth 未設定");
    setAuthError(null);
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (e: any) {
      const code = e?.code || "";
      const msg = e?.message || "發送重設密碼郵件失敗";
      setAuthError(firebaseErrorToZh(code || msg));
      throw e;
    }
  };

  const clearAuthError = () => setAuthError(null);

  const value: AuthContextType = {
    user,
    loading,
    isFirebaseConfigured: !!auth,
    pendingOtp,
    signIn,
    signUp,
    signOut,
    confirmOtp,
    cancelOtp,
    resetPassword,
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

function firebaseErrorToZh(codeOrMsg: string): string {
  const s = codeOrMsg || "";
  if (s.includes("invalid-email")) return "請輸入有效的電子郵件地址。";
  if (s.includes("user-disabled")) return "此帳號已被停用。";
  if (s.includes("user-not-found")) return "此電子郵件尚未註冊，請先建立帳號。";
  if (s.includes("wrong-password")) return "密碼不正確，請重新輸入。";
  if (s.includes("invalid-credential")) return "電子郵件不存在或密碼不正確。";
  if (s.includes("email-already-in-use")) return "此電子郵件已被註冊。";
  if (s.includes("weak-password")) return "密碼強度不足，須至少 8 個字元，包含大小寫字母、數字及特殊字符。";
  if (s.includes("too-many-requests")) return "嘗試次數過多，請稍後再試。";
  if (s.includes("network-request-failed")) return "網路錯誤，請檢查連線。";
  if (s.includes("missing-password")) return "請輸入密碼。";
  return "發生錯誤，請稍後再試。";
}
