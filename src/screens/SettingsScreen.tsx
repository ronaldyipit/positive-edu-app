import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useAuth } from "../contexts/AuthContext";

export default function SettingsScreen() {
  const { user, signOut } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>設定</Text>
      {user?.email ? (
        <Text style={styles.email}>目前帳號：{user.email}</Text>
      ) : null}
      <TouchableOpacity style={styles.logoutButton} onPress={() => signOut()}>
        <Text style={styles.logoutText}>登出</Text>
      </TouchableOpacity>
      <Text style={styles.footer}>正向教育夥伴 v1.0</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "#f9fafb" },
  title: { fontSize: 22, fontWeight: "700", color: "#111827", marginBottom: 8 },
  email: { fontSize: 14, color: "#6b7280", marginBottom: 24 },
  logoutButton: {
    alignSelf: "flex-start",
    backgroundColor: "#6b7280",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12
  },
  logoutText: { color: "#fff", fontWeight: "600" },
  footer: { marginTop: 32, fontSize: 12, color: "#9ca3af" }
});
