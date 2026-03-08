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
  Image,
  Modal,
  ScrollView
} from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { AppBackground } from "../components/AppBackground";
import { Ionicons } from "@expo/vector-icons";

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

  useEffect(() => {
    return () => clearAuthError();
  }, [clearAuthError]);

  const handleRegister = async () => {
    setLocalError(null);
    clearAuthError();
    if (!displayName.trim()) {
      setLocalError("請輸入用戶名稱。");
      return;
    }
    if (!grade) {
      setLocalError("請選擇年級。");
      return;
    }
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
      await signUp(email.trim(), password, displayName.trim(), grade);
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
      <AppBackground variant="auth">
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

        <TextInput
          style={styles.input}
          placeholder="用戶名稱"
          placeholderTextColor="#9ca3af"
          value={displayName}
          onChangeText={(t) => {
            setDisplayName(t);
            setLocalError(null);
            clearAuthError();
          }}
          autoCapitalize="words"
        />
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
            <TouchableOpacity
              style={styles.modalContent}
              activeOpacity={1}
              onPress={() => {}}
            >
              <Text style={styles.modalTitle}>選擇年級</Text>
              <ScrollView style={styles.gradeList}>
                {GRADES.map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.gradeOption, grade === g && styles.gradeOptionActive]}
                    onPress={() => {
                      setGrade(g);
                      setGradeModalVisible(false);
                      setLocalError(null);
                    }}
                  >
                    <Text style={[styles.gradeOptionText, grade === g && styles.gradeOptionTextActive]}>{g}</Text>
                    {grade === g && <Ionicons name="checkmark" size={20} color="#d56c2f" />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

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
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3
  },
  appLogo: {
    width: 88,
    height: 88,
    alignSelf: "center",
    marginBottom: 12
  },
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
  // 年級下拉
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 24
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    maxHeight: 320
  },
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
