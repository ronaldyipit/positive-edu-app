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

export default function RegisterScreen({ navigation }: { navigation: { goBack: () => void } }) {
  const { signUp, authError, clearAuthError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    return () => clearAuthError();
  }, [clearAuthError]);

  const handleRegister = async () => {
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
    if (password.length < 6) {
      setLocalError("密碼至少需要 6 個字元。");
      return;
    }
    if (password !== confirmPassword) {
      setLocalError("兩次輸入的密碼不一致。");
      return;
    }
    setLoading(true);
    try {
      await signUp(email.trim(), password);
    } catch {
      // authError 由 AuthContext 設定
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
      <View style={styles.card}>
        <Text style={styles.title}>建立帳號</Text>
        <Text style={styles.subtitle}>註冊後即可使用所有功能</Text>

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
        />
        <TextInput
          style={styles.input}
          placeholder="密碼（至少 6 字元）"
          placeholderTextColor="#9ca3af"
          value={password}
          onChangeText={(t) => {
            setPassword(t);
            setLocalError(null);
            clearAuthError();
          }}
          secureTextEntry
          autoComplete="password"
        />
        <TextInput
          style={styles.input}
          placeholder="再次輸入密碼"
          placeholderTextColor="#9ca3af"
          value={confirmPassword}
          onChangeText={(t) => {
            setConfirmPassword(t);
            setLocalError(null);
          }}
          secureTextEntry
          autoComplete="password"
        />

        {displayError ? <Text style={styles.error}>{displayError}</Text> : null}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={loading}
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
  title: { fontSize: 24, fontWeight: "700", color: "#0f172a", marginBottom: 4, textAlign: "center" },
  subtitle: { fontSize: 14, color: "#64748b", marginBottom: 20, textAlign: "center" },
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
  button: {
    backgroundColor: "#2563eb",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  link: { marginTop: 16, alignItems: "center" },
  linkText: { color: "#2563eb", fontSize: 14 }
});
