import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image
} from "react-native";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import { AppBackground } from "../components/AppBackground";

const API_BASE =
  process.env.EXPO_PUBLIC_COACH_API_URL ||
  (Constants.expoConfig as { extra?: { coachApiUrl?: string } })?.extra?.coachApiUrl ||
  "https://positive-edu-app.vercel.app";

export default function LoginScreen({
  navigation
}: {
  navigation: { navigate: (name: string) => void };
}) {
  const {
    signIn, authError, clearAuthError, isFirebaseConfigured,
    user, pendingOtp, confirmOtp, cancelOtp
  } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // OTP state
  const [otpCode, setOtpCode] = useState("");
  const [otpToken, setOtpToken] = useState<string | null>(null);
  const [otpExpiresAt, setOtpExpiresAt] = useState<number>(0);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      clearAuthError();
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [clearAuthError]);

  // Auto-send OTP once login succeeds (pendingOtp becomes true)
  const hasSentOtp = useRef(false);
  useEffect(() => {
    if (pendingOtp && user && !hasSentOtp.current) {
      hasSentOtp.current = true;
      sendOtp(user.email || email.trim());
    }
  }, [pendingOtp, user]);

  const startCountdown = () => {
    setCountdown(60);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const sendOtp = async (toEmail: string) => {
    setOtpSending(true);
    setOtpError(null);
    try {
      const res = await fetch(`${API_BASE}/api/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: toEmail })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "發送驗證碼失敗");
      setOtpToken(data.token);
      setOtpExpiresAt(data.expiresAt);
      startCountdown();
    } catch (e: unknown) {
      setOtpError(e instanceof Error ? e.message : "發送驗證碼失敗");
    } finally {
      setOtpSending(false);
    }
  };

  const handleLogin = async () => {
    setLocalError(null);
    clearAuthError();
    if (!email.trim()) { setLocalError("請輸入電子郵件。"); return; }
    if (!password) { setLocalError("請輸入密碼。"); return; }
    if (loading) return;
    setLoading(true);
    hasSentOtp.current = false;
    try {
      await signIn(email.trim(), password);
    } catch (e: any) {
      const code = e?.code || "";
      const msg = e?.message || "";
      const errorMsg = translateFirebaseError(code || msg);
      setLocalError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  function translateFirebaseError(s: string): string {
    if (s.includes("user-not-found")) return "此電子郵件尚未註冊，請先建立帳號。";
    if (s.includes("wrong-password")) return "密碼不正確，請重新輸入。";
    if (s.includes("invalid-credential")) return "電子郵件不存在或密碼不正確。";
    if (s.includes("invalid-email")) return "請輸入有效的電子郵件地址。";
    if (s.includes("user-disabled")) return "此帳號已被停用。";
    if (s.includes("too-many-requests")) return "嘗試次數過多，請稍後再試。";
    if (s.includes("network-request-failed")) return "網路錯誤，請檢查連線。";
    return "登入失敗，請檢查電子郵件及密碼。";
  }

  const handleVerifyOtp = async () => {
    if (!otpCode.trim()) { setOtpError("請輸入驗證碼。"); return; }
    if (!otpToken) { setOtpError("請先發送驗證碼。"); return; }
    setOtpVerifying(true);
    setOtpError(null);
    try {
      const res = await fetch(`${API_BASE}/api/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: (user?.email || email.trim()).toLowerCase(),
          otp: otpCode.trim(),
          token: otpToken,
          expiresAt: otpExpiresAt
        })
      });
      const data = await res.json();
      if (data.valid) {
        confirmOtp();
      } else {
        setOtpError(data.error || "驗證碼不正確。");
      }
    } catch (e: unknown) {
      setOtpError(e instanceof Error ? e.message : "驗證失敗，請稍後再試。");
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleCancelOtp = async () => {
    hasSentOtp.current = false;
    setOtpCode("");
    setOtpToken(null);
    setOtpError(null);
    setCountdown(0);
    if (countdownRef.current) clearInterval(countdownRef.current);
    await cancelOtp();
  };

  const displayError = localError || authError;
  const showOtpStep = pendingOtp && user;

  // ── OTP verification step ──
  if (showOtpStep) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <AppBackground variant="auth">
          <View style={styles.card}>
            <Image
              source={require("../../assets/img/AppLogo.png")}
              style={styles.appLogo}
              resizeMode="contain"
            />
            <Text style={styles.title}>電郵驗證</Text>
            <Text style={styles.subtitle}>
              驗證碼已發送至 {user.email || email}
            </Text>

            <TextInput
              style={styles.otpInput}
              placeholder="一次性驗證碼 (OTP)"
              placeholderTextColor="#9ca3af"
              value={otpCode}
              onChangeText={(t) => {
                setOtpCode(t.replace(/[^0-9]/g, "").slice(0, 6));
                setOtpError(null);
              }}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />

            {otpError ? <Text style={styles.error}>{otpError}</Text> : null}

            <TouchableOpacity
              style={[styles.primaryButton, otpVerifying && styles.buttonDisabled]}
              onPress={handleVerifyOtp}
              disabled={otpVerifying}
            >
              {otpVerifying ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>驗證</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.resendButton, (countdown > 0 || otpSending) && styles.buttonDisabled]}
              onPress={() => sendOtp(user.email || email.trim())}
              disabled={countdown > 0 || otpSending}
            >
              {otpSending ? (
                <ActivityIndicator color="#d56c2f" />
              ) : (
                <Text style={styles.resendText}>
                  {countdown > 0 ? `重新發送（${countdown}s）` : "重新發送驗證碼"}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.link} onPress={handleCancelOtp}>
              <Text style={styles.linkText}>返回登入</Text>
            </TouchableOpacity>
          </View>
        </AppBackground>
      </KeyboardAvoidingView>
    );
  }

  // ── Login form ──
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <AppBackground variant="auth">
        <View style={styles.card}>
          <Image
            source={require("../../assets/img/AppLogo.png")}
            style={styles.appLogo}
            resizeMode="contain"
          />
          <Text style={styles.title}>正發光</Text>
          <Text style={styles.subtitle}>建立你的正向成長習慣</Text>

          {!isFirebaseConfigured ? (
            <View style={styles.configWarning}>
              <Text style={styles.configWarningTitle}>無法登入</Text>
              <Text style={styles.configWarningText}>
                請從電腦專案目錄執行「npx expo start」，並確認專案根目錄有 .env 且已填寫 EXPO_PUBLIC_FIREBASE_* 與 Google 用戶端 ID。Expo Go 必須連到該開發伺服器才能載入 Firebase 設定。
              </Text>
            </View>
          ) : (
            <>
              <TextInput
                style={styles.input}
                placeholder="電子郵件"
                placeholderTextColor="#9ca3af"
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  setLocalError(null);
                  clearAuthError();
                }}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                editable={!loading}
              />
              <TextInput
                style={styles.input}
                placeholder="密碼"
                placeholderTextColor="#9ca3af"
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  setLocalError(null);
                  clearAuthError();
                }}
                secureTextEntry
                autoComplete="password"
                editable={!loading}
              />

              {displayError ? (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle" size={16} color="#dc2626" />
                  <Text style={styles.errorBannerText}>{displayError}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={styles.forgotLink}
                onPress={() => navigation.navigate("ForgotPassword")}
                disabled={loading}
              >
                <Text style={styles.forgotText}>忘記密碼？</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>登入</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.link}
                onPress={() => navigation.navigate("Register")}
                disabled={loading}
              >
                <Text style={styles.linkText}>還沒有帳號？按此註冊</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </AppBackground>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24 },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#d56c2f",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 3
  },
  appLogo: { width: 88, height: 88, alignSelf: "center", marginBottom: 12 },
  title: { fontSize: 24, fontWeight: "700", color: "#1c1917", marginBottom: 4, textAlign: "center" },
  subtitle: { fontSize: 14, color: "#78716c", marginBottom: 20, textAlign: "center" },
  input: {
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: "#fffbeb"
  },
  otpInput: {
    borderWidth: 2,
    borderColor: "#d56c2f",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 24,
    letterSpacing: 8,
    textAlign: "center",
    marginBottom: 16,
    backgroundColor: "#fffbeb"
  },
  error: { color: "#dc2626", fontSize: 13, marginBottom: 8 },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fef2f2",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#fca5a5"
  },
  errorBannerText: { color: "#dc2626", fontSize: 14, fontWeight: "500", flex: 1 },
  primaryButton: {
    backgroundColor: "#d56c2f",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4
  },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  buttonDisabled: { opacity: 0.6 },
  resendButton: {
    borderWidth: 1.5,
    borderColor: "#fde68a",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 12
  },
  resendText: { color: "#d56c2f", fontSize: 14, fontWeight: "600" },
  forgotLink: { alignSelf: "flex-end", marginBottom: 12, paddingVertical: 2 },
  forgotText: { color: "#d56c2f", fontSize: 13 },
  link: { marginTop: 16, alignItems: "center" },
  linkText: { color: "#d56c2f", fontSize: 14 },
  configWarning: {
    backgroundColor: "#fef3c7",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#f59e0b"
  },
  configWarningTitle: { fontSize: 16, fontWeight: "600", color: "#92400e", marginBottom: 8 },
  configWarningText: { fontSize: 13, color: "#78350f", lineHeight: 20 }
});
