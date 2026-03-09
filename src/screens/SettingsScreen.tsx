import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { AppBackground } from "../components/AppBackground";

export default function SettingsScreen() {
  const { user, signOut } = useAuth();

  return (
    <AppBackground>
    <View style={styles.outerWrap}>
      <View style={styles.whiteCard}>
      <Image
        source={require("../../assets/img/AppLogo.png")}
        style={styles.appLogo}
        resizeMode="contain"
      />
      <Text style={styles.title}>設定</Text>
      {user?.email ? (
        <Text style={styles.email}>目前帳號：{user.email}</Text>
      ) : null}
      <TouchableOpacity style={styles.logoutButton} onPress={() => signOut()}>
        <Text style={styles.logoutText}>登出</Text>
      </TouchableOpacity>
      <Text style={styles.footer}>正發光 v1.0</Text>
      </View>
    </View>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  outerWrap: { flex: 1, padding: 16 },
  whiteCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#d56c2f",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 3
  },
  appLogo: { width: 120, height: 120, alignSelf: "center", marginBottom: 16 },
  title: { fontSize: 22, fontWeight: "700", color: "#111827", marginBottom: 8 },
  email: { fontSize: 14, color: "#6b7280", marginBottom: 24 },
  logoutButton: {
    alignSelf: "flex-start",
    backgroundColor: "#d56c2f",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12
  },
  logoutText: { color: "#fff", fontWeight: "600" },
  footer: { marginTop: 32, fontSize: 12, color: "#78716c" }
});
