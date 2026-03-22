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
  Image,
  Alert,
  ScrollView
} from "react-native";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import { AppBackground } from "../components/AppBackground";

const API_BASE =
  process.env.EXPO_PUBLIC_COACH_API_URL ||
  (Constants.expoConfig as { extra?: { coachApiUrl?: string } })?.extra?.coachApiUrl ||
  "https://positive-edu-app.vercel.app";

type Step = "email" | "otp" | "newPassword";

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return "密碼至少需要 8 個字元。";
  if (!/[A-Z]/.test(pw)) return "密碼須包含至少一個大寫英文字母 (A-Z)。";
  if (!/[a-z]/.test(pw)) return "密碼須包含至少一個小寫英文字母 (a-z)。";
  if (!/[0-9]/.test(pw)) return "密碼須包含至少一個數字 (0-9)。";
  if (!/[!@#$%^&*()_+\-=\[\]{}|;:'",.<>?/\\]/.test(pw)) return "密碼須包含至少一個特殊字符（如 !@#$%^&*_+-）。";
  return null;
}

export default function ForgotPasswordScreen({
  navigation
}: {
  navigation: { goBack: () => void };
}) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpToken, setOtpToken] = useState<string | null>(null);
  const [otpExpiresAt, setOtpExpiresAt] = useState<number>(0);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  const startCountdown = () => {
    setCountdown(60);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { if (countdownRef.current) clearInterval(countdownRef.current); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  // Step 1: Send OTP
  const handleSendOtp = async () => {
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) { setError("請輸入電子郵件地址。"); return; }
    if (!/\S+@\S+\.\S+/.test(trimmed)) { setError("請輸入有效的電子郵件地址。"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "發送驗證碼失敗");
      setOtpToken(data.token);
      setOtpExpiresAt(data.expiresAt);
      startCountdown();
      setStep("otp");
    } catch (e: any) {
      setError(e?.message || "發送驗證碼失敗");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (code?: string) => {
    const codeToVerify = (code || otpCode).trim();
    if (!codeToVerify) { setError("請輸入驗證碼。"); return; }
    if (!otpToken) { setError("請先發送驗證碼。"); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp: codeToVerify,
          token: otpToken,
          expiresAt: otpExpiresAt
        })
      });
      const data = await res.json();
      if (data.valid) {
        setStep("newPassword");
      } else {
        setError(data.error || "驗證碼不正確。");
      }
    } catch (e: any) {
      setError(e?.message || "驗證失敗");
    } finally {
      setLoading(false);
    }
  };

  // Auto-verify when 6 digits entered
  useEffect(() => {
    if (otpCode.length === 6 && step === "otp" && otpToken && !loading) {
      handleVerifyOtp(otpCode);
    }
  }, [otpCode]);

  // Step 3: Reset password
  const handleResetPassword = async () => {
    setError(null);
    if (!newPassword) { setError("請輸入新密碼。"); return; }
    const pwErr = validatePassword(newPassword);
    if (pwErr) { setError(pwErr); return; }
    if (newPassword !== confirmPassword) { setError("兩次輸入的密碼不一致。"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp: otpCode.trim(),
          token: otpToken,
          expiresAt: otpExpiresAt,
          newPassword
        })
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert("密碼重設成功", "請使用新密碼登入。", [
          { text: "返回登入", onPress: () => navigation.goBack() }
        ]);
      } else {
        setError(data.error || "重設密碼失敗。");
      }
    } catch (e: any) {
      setError(e?.message || "重設密碼失敗");
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => {
    const steps = ["輸入電郵", "驗證碼", "新密碼"];
    const current = step === "email" ? 0 : step === "otp" ? 1 : 2;
    return (
      <View style={styles.stepRow}>
        {steps.map((label, i) => (
          <View key={label} style={styles.stepItem}>
            <View style={[styles.stepDot, i <= current && styles.stepDotActive]}>
              {i < current ? (
                <Ionicons name="checkmark" size={12} color="#fff" />
              ) : (
                <Text style={[styles.stepDotText, i <= current && styles.stepDotTextActive]}>
                  {i + 1}
                </Text>
              )}
            </View>
            <Text style={[styles.stepLabel, i <= current && styles.stepLabelActive]}>{label}</Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
    >
      <AppBackground variant="auth">
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
          <Image
            source={require("../../assets/img/AppLogo.png")}
            style={styles.appLogo}
            resizeMode="contain"
          />
          <Text style={styles.title}>重設密碼</Text>
          {renderStepIndicator()}

          {/* Step 1: Email */}
          {step === "email" && (
            <>
              <Text style={styles.hint}>輸入你的註冊電郵地址，我們會發送驗證碼。</Text>
              <TextInput
                style={styles.input}
                placeholder="電子郵件"
                placeholderTextColor="#9ca3af"
                value={email}
                onChangeText={(t) => { setEmail(t); setError(null); }}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                editable={!loading}
                autoFocus
              />
              {error ? (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle" size={16} color="#dc2626" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}
              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                onPress={handleSendOtp}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : (
                  <Text style={styles.primaryButtonText}>發送驗證碼</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {/* Step 2: OTP */}
          {step === "otp" && (
            <>
              <Text style={styles.hint}>驗證碼已發送至 {email.trim()}</Text>
              <TextInput
                style={styles.otpInput}
                placeholder="驗證碼 (OTP)"
                placeholderTextColor="#9ca3af"
                value={otpCode}
                onChangeText={(t) => {
                  setOtpCode(t.replace(/[^0-9]/g, "").slice(0, 6));
                  setError(null);
                }}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />
              {error ? (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle" size={16} color="#dc2626" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}
              <TouchableOpacity
                style={[styles.secondaryButton, (countdown > 0 || loading) && styles.buttonDisabled]}
                onPress={handleSendOtp}
                disabled={countdown > 0 || loading}
              >
                <Text style={styles.secondaryButtonText}>
                  {countdown > 0 ? `重新發送（${countdown}s）` : "重新發送驗證碼"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.textLink}
                onPress={() => { setStep("email"); setOtpCode(""); setError(null); }}
              >
                <Text style={styles.textLinkText}>更換電郵地址</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Step 3: New password */}
          {step === "newPassword" && (
            <>
              <View style={styles.verifiedBanner}>
                <Ionicons name="checkmark-circle" size={16} color="#166534" />
                <Text style={styles.verifiedText}>電郵已驗證：{email.trim()}</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="新密碼"
                placeholderTextColor="#9ca3af"
                value={newPassword}
                onChangeText={(t) => { setNewPassword(t); setError(null); }}
                secureTextEntry
                autoFocus
              />
              <Text style={styles.passwordHint}>
                須至少 8 個字元，包含大寫字母 (A-Z)、小寫字母 (a-z)、數字 (0-9) 及特殊字符 (!@#$%^&*_+-)
              </Text>
              <TextInput
                style={styles.input}
                placeholder="再次輸入新密碼"
                placeholderTextColor="#9ca3af"
                value={confirmPassword}
                onChangeText={(t) => { setConfirmPassword(t); setError(null); }}
                secureTextEntry
              />
              {error ? (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle" size={16} color="#dc2626" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}
              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                onPress={handleResetPassword}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : (
                  <Text style={styles.primaryButtonText}>確認重設密碼</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            style={styles.backLink}
            onPress={() => navigation.goBack()}
            disabled={loading}
          >
            <Text style={styles.backLinkText}>返回登入</Text>
          </TouchableOpacity>
          </View>
        </ScrollView>
      </AppBackground>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: "center", padding: 24 },
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
  appLogo: { width: 140, height: 140, alignSelf: "center", marginBottom: 16 },
  title: { fontSize: 22, fontWeight: "700", color: "#1c1917", marginBottom: 12, textAlign: "center" },
  // step indicator
  stepRow: { flexDirection: "row", justifyContent: "center", gap: 24, marginBottom: 18 },
  stepItem: { alignItems: "center", gap: 4 },
  stepDot: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: "#e5e7eb", justifyContent: "center", alignItems: "center"
  },
  stepDotActive: { backgroundColor: "#d56c2f" },
  stepDotText: { fontSize: 12, fontWeight: "600", color: "#9ca3af" },
  stepDotTextActive: { color: "#fff" },
  stepLabel: { fontSize: 11, color: "#9ca3af" },
  stepLabelActive: { color: "#d56c2f", fontWeight: "600" },
  hint: { fontSize: 13, color: "#78716c", marginBottom: 14, textAlign: "center", lineHeight: 18 },
  input: {
    borderWidth: 1, borderColor: "#fde68a", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16,
    marginBottom: 12, backgroundColor: "#fffbeb"
  },
  otpInput: {
    borderWidth: 2, borderColor: "#d56c2f", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 14, fontSize: 24,
    letterSpacing: 8, textAlign: "center", marginBottom: 14, backgroundColor: "#fffbeb"
  },
  errorBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#fef2f2", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12,
    borderWidth: 1, borderColor: "#fca5a5"
  },
  errorText: { color: "#dc2626", fontSize: 14, fontWeight: "500", flex: 1 },
  passwordHint: { fontSize: 11, color: "#9ca3af", marginTop: -8, marginBottom: 12, paddingHorizontal: 4, lineHeight: 16 },
  verifiedBanner: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#dcfce7", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 14,
    borderWidth: 1, borderColor: "#22c55e"
  },
  verifiedText: { color: "#166534", fontSize: 13, fontWeight: "600" },
  primaryButton: {
    backgroundColor: "#d56c2f",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4
  },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "600", textAlign: "center" },
  secondaryButton: {
    borderWidth: 1.5,
    borderColor: "#fde68a",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4
  },
  secondaryButtonText: { color: "#d56c2f", fontSize: 14, fontWeight: "600", textAlign: "center" },
  buttonDisabled: { opacity: 0.6 },
  textLink: { marginTop: 10, alignItems: "center" },
  textLinkText: { color: "#d56c2f", fontSize: 13, textAlign: "center" },
  backLink: { marginTop: 18, alignItems: "center" },
  backLinkText: { color: "#d56c2f", fontSize: 14, textAlign: "center" }
});
