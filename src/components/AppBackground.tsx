import React from "react";
import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../contexts/ThemeContext";

const AUTH_GRADIENT_LIGHT = ["#fefce8", "#fef9c3", "#fff7ed"] as const;
const DEFAULT_GRADIENT_LIGHT = ["#fefce8", "#fef9c3", "#fff7ed"] as const;
/** 深色：柔和深灰／深藍，避免純黑 */
const DEFAULT_GRADIENT_DARK = ["#0f172a", "#1e293b", "#172554"] as const;
const AUTH_GRADIENT_DARK = ["#0f172a", "#1e293b", "#1e3a5f"] as const;

/** 全螢幕柔和漸層背景；跟隨 ThemeContext 深色模式 */
export function AppBackground({
  children,
  variant = "default"
}: {
  children: React.ReactNode;
  variant?: "default" | "auth";
}) {
  const { isDark } = useTheme();
  const colors =
    isDark
      ? variant === "auth"
        ? AUTH_GRADIENT_DARK
        : DEFAULT_GRADIENT_DARK
      : variant === "auth"
        ? AUTH_GRADIENT_LIGHT
        : DEFAULT_GRADIENT_LIGHT;
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
