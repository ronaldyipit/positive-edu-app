import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from "react-native";
import { useAuth } from "../contexts/AuthContext";

export default function LoginScreen({
  navigation
}: {
  navigation: { navigate: (name: string) => void };
}) {
  const { signIn, signInWithGoogle, googleLoading, authError, clearAuthError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return () => clearAuthError();
  }, [clearAuthError]);

  const handleLogin = async () => {
    if (!email.trim() || !password || loading) return;
    setLoading(true);
    clearAuthError();
    try {
      await signIn(email.trim(), password);
    } catch {
      // 錯誤已由 AuthContext 設為 authError
    } finally {
      setLoading(false);
    }
  };

  const isAnyLoading = loading || googleLoading;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.title}>正向教育夥伴</Text>
        <Text style={styles.subtitle}>建立你的正向成長習慣</Text>

        {/* Google 登入（主要按鈕） */}
        <TouchableOpacity
          style={[styles.googleButton, isAnyLoading && styles.buttonDisabled]}
          onPress={signInWithGoogle}
          disabled={isAnyLoading}
        >
          {googleLoading ? (
            <ActivityIndicator color="#1f2937" />
          ) : (
            <View style={styles.googleRow}>
              <Text style={styles.googleIcon}>G</Text>
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
            clearAuthError();
          }}
          secureTextEntry
          autoComplete="password"
          editable={!isAnyLoading}
        />

        {authError ? <Text style={styles.error}>{authError}</Text> : null}

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
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f0f9ff"
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
    textAlign: "center"
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 20,
    textAlign: "center"
  },
  googleButton: {
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
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
  googleIcon: {
    fontSize: 18,
    fontWeight: "700",
    color: "#4285F4",
    marginRight: 10
  },
  googleText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937"
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#e2e8f0"
  },
  dividerText: {
    marginHorizontal: 10,
    fontSize: 13,
    color: "#9ca3af"
  },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: "#f8fafc"
  },
  error: { color: "#dc2626", fontSize: 13, marginBottom: 8 },
  emailButton: {
    backgroundColor: "#2563eb",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4
  },
  buttonDisabled: { opacity: 0.6 },
  emailButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  link: { marginTop: 16, alignItems: "center" },
  linkText: { color: "#2563eb", fontSize: 14 }
});
