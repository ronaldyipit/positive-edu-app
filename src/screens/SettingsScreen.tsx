import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../contexts/AuthContext";
import { AppBackground } from "../components/AppBackground";
import { getGamificationState, getLevelName, LEVEL_NAMES, LEVEL_XP } from "../utils/gamification";

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);

  useFocusEffect(
    React.useCallback(() => {
      getGamificationState()
        .then((g) => {
          setLevel(g.level);
          setXp(g.xp);
        })
        .catch(() => {});
    }, [])
  );

  return (
    <AppBackground>
    <View style={styles.outerWrap}>
      <View style={styles.whiteCard}>
      <ScrollView showsVerticalScrollIndicator={false}>
      <Image
        source={require("../../assets/img/AppLogo.png")}
        style={styles.appLogo}
        resizeMode="contain"
      />
      <Text style={styles.title}>設定</Text>
      {user?.email ? (
        <Text style={styles.email}>目前帳號：{user.email}</Text>
      ) : null}
      <View style={styles.levelSummary}>
        <Text style={styles.levelSummaryTitle}>目前等級</Text>
        <Text style={styles.levelSummaryValue}>Lv.{level}・{getLevelName(level)}</Text>
        <Text style={styles.levelSummarySub}>目前 {xp}/{LEVEL_XP} XP</Text>
      </View>
      <View style={styles.levelList}>
        <Text style={styles.levelListTitle}>等級一覽</Text>
        {LEVEL_NAMES.map((name, idx) => {
          const lv = idx + 1;
          return (
            <View key={name} style={[styles.levelRow, level === lv && styles.levelRowActive]}>
              <Text style={styles.levelRowLv}>Lv.{lv}</Text>
              <Text style={styles.levelRowName}>{name}</Text>
              <Text style={styles.levelRowRange}>{idx * LEVEL_XP} - {idx * LEVEL_XP + (LEVEL_XP - 1)} XP</Text>
            </View>
          );
        })}
      </View>
      <TouchableOpacity style={styles.logoutButton} onPress={() => signOut()}>
        <Text style={styles.logoutText}>登出</Text>
      </TouchableOpacity>
      <Text style={styles.footer}>正發光 v1.0</Text>
      </ScrollView>
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
  levelSummary: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14
  },
  levelSummaryTitle: { fontSize: 12, color: "#1d4ed8", fontWeight: "600" },
  levelSummaryValue: { fontSize: 16, color: "#1e3a8a", fontWeight: "800", marginTop: 2 },
  levelSummarySub: { fontSize: 12, color: "#2563eb", marginTop: 2 },
  levelList: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 20
  },
  levelListTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
    backgroundColor: "#f9fafb",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  levelRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6"
  },
  levelRowActive: { backgroundColor: "#fffbeb" },
  levelRowLv: { fontSize: 12, color: "#6b7280", fontWeight: "700" },
  levelRowName: { fontSize: 14, color: "#111827", fontWeight: "700", marginTop: 2 },
  levelRowRange: { fontSize: 11, color: "#9ca3af", marginTop: 2 },
  logoutButton: {
    alignSelf: "flex-start",
    backgroundColor: "#d56c2f",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  logoutText: { color: "#fff", fontWeight: "600", textAlign: "center" },
  footer: { marginTop: 32, fontSize: 12, color: "#78716c" }
});
