import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@theme_dark_v1";

export type ThemeColors = {
  background: string;
  card: string;
  cardBorder: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  accent: string;
  accentMuted: string;
  inputBg: string;
  inputBorder: string;
  bubbleCoach: string;
  bubbleUser: string;
  tabBarBg: string;
  tabBarBorder: string;
  safeAreaBg: string;
};

const light: ThemeColors = {
  background: "#fefce8",
  card: "#ffffff",
  cardBorder: "transparent",
  text: "#111827",
  textMuted: "#4b5563",
  textSubtle: "#9ca3af",
  accent: "#d56c2f",
  accentMuted: "#fdba74",
  inputBg: "#ffffff",
  inputBorder: "#d1d5db",
  bubbleCoach: "#ffffff",
  bubbleUser: "#d56c2f",
  tabBarBg: "#ffffff",
  tabBarBorder: "#e5e7eb",
  safeAreaBg: "#fefce8"
};

const dark: ThemeColors = {
  background: "#0f172a",
  card: "#1e293b",
  cardBorder: "#334155",
  text: "#e2e8f0",
  textMuted: "#cbd5e1",
  textSubtle: "#94a3b8",
  accent: "#fb923c",
  accentMuted: "#9a3412",
  inputBg: "#0f172a",
  inputBorder: "#475569",
  bubbleCoach: "#1e293b",
  bubbleUser: "#c2410c",
  tabBarBg: "#1e293b",
  tabBarBorder: "#334155",
  safeAreaBg: "#0f172a"
};

type ThemeContextValue = {
  isDark: boolean;
  colors: ThemeColors;
  setDarkMode: (value: boolean) => Promise<void>;
  toggleDarkMode: () => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem(STORAGE_KEY);
        setIsDark(v === "1");
      } catch {
        setIsDark(false);
      }
    })();
  }, []);

  const setDarkMode = useCallback(async (value: boolean) => {
    setIsDark(value);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const toggleDarkMode = useCallback(async () => {
    await setDarkMode(!isDark);
  }, [isDark, setDarkMode]);

  const colors = useMemo(() => (isDark ? dark : light), [isDark]);

  const value = useMemo(
    () => ({ isDark, colors, setDarkMode, toggleDarkMode }),
    [isDark, colors, setDarkMode, toggleDarkMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      isDark: false,
      colors: light,
      setDarkMode: async () => {},
      toggleDarkMode: async () => {}
    };
  }
  return ctx;
}

export const themeLightColors = light;
