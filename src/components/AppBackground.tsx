import React from "react";
import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const AUTH_GRADIENT = ["#fefce8", "#fef9c3", "#fff7ed"] as const;
const DEFAULT_GRADIENT = ["#fefce8", "#fef9c3", "#fff7ed"] as const;

/** 全螢幕柔和漸層背景。全 App 統一為 Logo 暖黃金橙調 */
export function AppBackground({
  children,
  variant = "default"
}: {
  children: React.ReactNode;
  variant?: "default" | "auth";
}) {
  const colors = variant === "auth" ? AUTH_GRADIENT : DEFAULT_GRADIENT;
  return (
    <View style={styles.wrapper}>
      <LinearGradient
        colors={[...colors]}
        style={StyleSheet.absoluteFillObject}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 }
});
