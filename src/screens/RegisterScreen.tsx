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
  Modal,
  ScrollView
} from "react-native";
import Constants from "expo-constants";
import { useAuth } from "../contexts/AuthContext";
import { AppBackground } from "../components/AppBackground";
import { Ionicons } from "@expo/vector-icons";

const API_BASE =
  process.env.EXPO_PUBLIC_COACH_API_URL ||
  (Constants.expoConfig as { extra?: { coachApiUrl?: string } })?.extra?.coachApiUrl ||
  "https://positive-edu-app.vercel.app";

const GRADES = ["中一", "中二", "中三", "中四", "中五", "中六"];

export default function RegisterScreen({ navigation }: { navigation: { goBack: () => void } }) {
  const { signUp, authError, clearAuthError, isFirebaseConfigured } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [grade, setGrade] = useState<string | null>(null);
  const [gradeModalVisible, setGradeModalVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [registerSuccess, setRegisterSuccess] = useState(false);

  // OTP state
  const [otpCode, setOtpCode] = useState("");
  const [otpToken, setOtpToken] = useState<string | null>(null);
  const [otpExpiresAt, setOtpExpiresAt] = useState<number>(0);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const verifiedEmailRef = useRef("");

  useEffect(() => {
    return () => {
      clearAuthError();
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [clearAuthError]);

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

  const handleSendOtp = async () => {
    setOtpError(null);
    setLocalError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setLocalError("請先輸入電子郵件。");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(trimmed)) {
      setLocalError("請輸入有效的電子郵件地址。");
      return;
    }
    setOtpSending(true);
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
      setOtpVerified(false);
      verifiedEmailRef.current = "";
      startCountdown();
    } catch (e: unknown) {
      setOtpError(e instanceof Error ? e.message : "發送驗證碼失敗");
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode.trim()) { setOtpError("請輸入驗證碼。"); return; }
    if (!otpToken) { setOtpError("請先發送驗證碼。"); return; }
    setOtpError(null);
    try {
      const res = await fetch(`${API_BASE}/api/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp: otpCode.trim(),
          token: otpToken,
          expiresAt: otpExpiresAt
        })
      });
      const data = await res.json();
      if (data.valid) {
        setOtpVerified(true);
        verifiedEmailRef.current = email.trim().toLowerCase();
        setOtpError(null);
      } else {
        setOtpError(data.error || "驗證碼不正確。");
      }
    } catch (e: unknown) {
      setOtpError(e instanceof Error ? e.message : "驗證失敗");
    }
  };

  // If email changes after OTP was verified, invalidate it
  useEffect(() => {
    if (otpVerified && email.trim().toLowerCase() !== verifiedEmailRef.current) {
      setOtpVerified(false);
    }
  }, [email, otpVerified]);

  const handleRegister = async () => {
    setLocalError(null);
    clearAuthError();
    setRegisterSuccess(false);
    if (!displayName.trim()) { setLocalError("請輸入用戶名稱。"); return; }
    if (!grade) { setLocalError("請選擇年級。"); return; }
    if (!email.trim()) { setLocalError("請輸入電子郵件。"); return; }
    if (!otpVerified) { setLocalError("請先完成電郵驗證。"); return; }
    if (!password) { setLocalError("請輸入密碼。"); return; }
    if (password.length < 6) { setLocalError("密碼至少需要 6 個字元。"); return; }
    if (password !== confirmPassword) { setLocalError("兩次輸入的密碼不一致。"); return; }
    setLoading(true);
    try {
      await signUp(email.trim(), password, displayName.trim(), grade);
      setRegisterSuccess(true);
    } catch {
      // authError set by AuthContext
    } finally {
      setLoading(false);
    }
  };

  const displayError = localError || authError;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <AppBackground variant="auth">
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Image
              source={require("../../assets/img/AppLogo.png")}
              style={styles.appLogo}
              resizeMode="contain"
            />
            <Text style={styles.title}>建立帳號</Text>
            <Text style={styles.subtitle}>填寫簡單資料，註冊後即可使用所有功能</Text>

            {!isFirebaseConfigured ? (
              <View style={styles.configWarning}>
                <Text style={styles.configWarningTitle}>無法註冊</Text>
                <Text style={styles.configWarningText}>
                  請從電腦專案目錄執行「npx expo start」，並確認專案根目錄有 .env 且已填寫 EXPO_PUBLIC_FIREBASE_*。Expo Go 必須連到該開發伺服器才能載入 Firebase 設定。
                </Text>
              </View>
            ) : null}

            {/* 用戶名稱 */}
            <TextInput
              style={styles.input}
              placeholder="用戶名稱"
              placeholderTextColor="#9ca3af"
              value={displayName}
              onChangeText={(t) => { setDisplayName(t); setLocalError(null); clearAuthError(); }}
              autoCapitalize="words"
            />

            {/* 年級選擇 */}
            <TouchableOpacity
              style={styles.dropdown}
              onPress={() => setGradeModalVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={[styles.dropdownText, !grade && styles.dropdownPlaceholder]}>
                {grade || "請選擇年級"}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#78716c" />
            </TouchableOpacity>

            <Modal
              visible={gradeModalVisible}
              transparent
              animationType="fade"
              onRequestClose={() => setGradeModalVisible(false)}
            >
              <TouchableOpacity
                style={styles.modalOverlay}
                activeOpacity={1}
                onPress={() => setGradeModalVisible(false)}
              >
                <TouchableOpacity style={styles.modalContent} activeOpacity={1} onPress={() => {}}>
                  <Text style={styles.modalTitle}>選擇年級</Text>
                  <ScrollView style={styles.gradeList}>
                    {GRADES.map((g) => (
                      <TouchableOpacity
                        key={g}
                        style={[styles.gradeOption, grade === g && styles.gradeOptionActive]}
                        onPress={() => { setGrade(g); setGradeModalVisible(false); setLocalError(null); }}
                      >
                        <Text style={[styles.gradeOptionText, grade === g && styles.gradeOptionTextActive]}>{g}</Text>
                        {grade === g && <Ionicons name="checkmark" size={20} color="#d56c2f" />}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </TouchableOpacity>
              </TouchableOpacity>
            </Modal>

            {/* 電子郵件 + 發送驗證碼按鈕 */}
            <View style={styles.emailRow}>
              <TextInput
                style={[styles.input, styles.emailInput]}
                placeholder="電子郵件"
                placeholderTextColor="#9ca3af"
                value={email}
                onChangeText={(t) => { setEmail(t); setLocalError(null); clearAuthError(); }}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                editable={!otpVerified}
              />
              <TouchableOpacity
                style={[
                  styles.sendOtpButton,
                  (otpSending || countdown > 0 || otpVerified) && styles.sendOtpButtonDisabled
                ]}
                onPress={handleSendOtp}
                disabled={otpSending || countdown > 0 || otpVerified}
              >
                {otpSending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : otpVerified ? (
                  <Ionicons name="checkmark-circle" size={18} color="#fff" />
                ) : (
                  <Text style={styles.sendOtpText}>
                    {countdown > 0 ? `${countdown}s` : "發送驗證碼"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* OTP 輸入欄 + 驗證按鈕（尚未驗證時顯示） */}
            {otpToken && !otpVerified ? (
              <View style={styles.otpRow}>
                <TextInput
                  style={[styles.input, styles.otpInput]}
                  placeholder="6 位驗證碼"
                  placeholderTextColor="#9ca3af"
                  value={otpCode}
                  onChangeText={(t) => {
                    setOtpCode(t.replace(/[^0-9]/g, "").slice(0, 6));
                    setOtpError(null);
                  }}
                  keyboardType="number-pad"
                  maxLength={6}
                />
                <TouchableOpacity
                  style={styles.verifyOtpButton}
                  onPress={handleVerifyOtp}
                >
                  <Text style={styles.verifyOtpText}>驗證</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {otpVerified ? (
              <View style={styles.verifiedBanner}>
                <Ionicons name="checkmark-circle" size={16} color="#166534" />
                <Text style={styles.verifiedText}>電郵已驗證</Text>
              </View>
            ) : null}

            {otpError ? <Text style={styles.error}>{otpError}</Text> : null}

            {/* 密碼 */}
            <TextInput
              style={styles.input}
              placeholder="密碼（至少 6 字元）"
              placeholderTextColor="#9ca3af"
              value={password}
              onChangeText={(t) => { setPassword(t); setLocalError(null); clearAuthError(); }}
              secureTextEntry
              autoComplete="password"
            />
            <TextInput
              style={styles.input}
              placeholder="再次輸入密碼"
              placeholderTextColor="#9ca3af"
              value={confirmPassword}
              onChangeText={(t) => { setConfirmPassword(t); setLocalError(null); }}
              secureTextEntry
              autoComplete="password"
            />

            {displayError ? <Text style={styles.error}>{displayError}</Text> : null}
            {registerSuccess ? (
              <View style={styles.successBanner}>
                <Text style={styles.successText}>註冊成功！正在自動登入…</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.button, (loading || !isFirebaseConfigured) && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={loading || !isFirebaseConfigured}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>註冊</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.link}
              onPress={() => navigation.goBack()}
              disabled={loading}
            >
              <Text style={styles.linkText}>已有帳號？返回登入</Text>
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
    shadowOpacity: 0.1,
    shadowRadius: 12,
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
  // email row
  emailRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  emailInput: { flex: 1 },
  sendOtpButton: {
    backgroundColor: "#d56c2f",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 90
  },
  sendOtpButtonDisabled: { opacity: 0.55 },
  sendOtpText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  // otp row
  otpRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  otpInput: { flex: 1, letterSpacing: 4, fontSize: 18 },
  verifyOtpButton: {
    backgroundColor: "#d56c2f",
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 13,
    justifyContent: "center",
    alignItems: "center"
  },
  verifyOtpText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  verifiedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#dcfce7",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#22c55e"
  },
  verifiedText: { color: "#166534", fontSize: 13, fontWeight: "600" },
  error: { color: "#dc2626", fontSize: 13, marginBottom: 8 },
  button: {
    backgroundColor: "#d56c2f",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  link: { marginTop: 16, alignItems: "center" },
  linkText: { color: "#d56c2f", fontSize: 14 },
  // grade dropdown
  dropdown: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    backgroundColor: "#fffbeb"
  },
  dropdownText: { fontSize: 16, color: "#1c1917" },
  dropdownPlaceholder: { color: "#9ca3af" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 24 },
  modalContent: { backgroundColor: "#fff", borderRadius: 16, padding: 16, maxHeight: 320 },
  modalTitle: { fontSize: 16, fontWeight: "600", color: "#1c1917", marginBottom: 12 },
  gradeList: { maxHeight: 240 },
  gradeOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4
  },
  gradeOptionActive: { backgroundColor: "#fff7ed" },
  gradeOptionText: { fontSize: 16, color: "#374151" },
  gradeOptionTextActive: { fontWeight: "600", color: "#d56c2f" },
  successBanner: {
    backgroundColor: "#dcfce7",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#22c55e",
    alignItems: "center"
  },
  successText: { fontSize: 15, fontWeight: "600", color: "#166534" },
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
