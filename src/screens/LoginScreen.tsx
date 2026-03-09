import React, { useState, useEffect } from "react";
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
import { useAuth } from "../contexts/AuthContext";
import { AppBackground } from "../components/AppBackground";

export default function LoginScreen({
  navigation
}: {
  navigation: { navigate: (name: string) => void };
}) {
  const { signIn, signInWithGoogle, googleLoading, authError, clearAuthError, isFirebaseConfigured } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    return () => clearAuthError();
  }, [clearAuthError]);

  const handleLogin = async () => {
    setLocalError(null);
    clearAuthError();
    if (!email.trim()) {
      setLocalError("請輸入電子郵件。");
      return;
    }
    if (!password) {
      setLocalError("請輸入密碼。");
      return;
    }
    if (loading) return;
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch {
      // authError 已由 AuthContext 設定
    } finally {
      setLoading(false);
    }
  };

  const displayError = localError || authError;
  const isAnyLoading = loading || googleLoading;

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
        {/* Google 登入（主要按鈕） */}
        <TouchableOpacity
          style={[styles.googleButton, isAnyLoading && styles.buttonDisabled]}
          onPress={signInWithGoogle}
          disabled={isAnyLoading}
        >
          {googleLoading ? (
            <ActivityIndicator color="#d56c2f" />
          ) : (
            <View style={styles.googleRow}>
              <Image
                source={require("../../assets/img/Google Logo.png")}
                style={styles.googleLogo}
                resizeMode="contain"
              />
              <Text style={styles.googleText}>以 Google 帳號登入</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* 分隔線 */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>或</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Email / 密碼（次要選項） */}
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
          editable={!isAnyLoading}
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
          editable={!isAnyLoading}
        />

        {displayError ? <Text style={styles.error}>{displayError}</Text> : null}

        <TouchableOpacity
          style={[styles.emailButton, isAnyLoading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={isAnyLoading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.emailButtonText}>以電子郵件登入</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.link}
          onPress={() => navigation.navigate("Register")}
          disabled={isAnyLoading}
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
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24
  },
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
  appLogo: {
    width: 88,
    height: 88,
    alignSelf: "center",
    marginBottom: 12
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1c1917",
    marginBottom: 4,
    textAlign: "center"
  },
  subtitle: {
    fontSize: 14,
    color: "#78716c",
    marginBottom: 20,
    textAlign: "center"
  },
  googleButton: {
    borderWidth: 1.5,
    borderColor: "#fde68a",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#fff",
    marginBottom: 16
  },
  googleRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  googleLogo: {
    width: 22,
    height: 22,
    marginRight: 10
  },
  googleText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1c1917"
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#fde68a"
  },
  dividerText: {
    marginHorizontal: 10,
    fontSize: 13,
    color: "#b45309"
  },
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
  error: { color: "#dc2626", fontSize: 13, marginBottom: 8 },
  emailButton: {
    backgroundColor: "#d56c2f",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4
  },
  buttonDisabled: { opacity: 0.6 },
  emailButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
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
