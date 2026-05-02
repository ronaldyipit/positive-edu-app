import { StyleSheet } from "react-native";

const APP_FONT_SCALE = 1.15;

type StyleValue = Record<string, unknown>;
type StyleSheetMap = Record<string, StyleValue>;

function scaleStyleValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => scaleStyleValue(item));
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === "fontSize" && typeof v === "number") {
        next[k] = Math.round(v * APP_FONT_SCALE * 10) / 10;
      } else {
        next[k] = scaleStyleValue(v);
      }
    }
    return next;
  }
  return value;
}

const originalCreate = StyleSheet.create;

StyleSheet.create = function createWithScaledFontSize<T extends StyleSheetMap>(styles: T): T {
  const scaled = scaleStyleValue(styles) as T;
  return originalCreate(scaled);
};
