import React from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Circle, Rect } from "react-native-svg";

/**
 * Deterministic "hash" from string for reproducible art from session.
 */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return Math.abs(h);
}

function seedToHue(seed: number): number {
  return seed % 360;
}

function seedToPercent(seed: number, max = 100): number {
  return (seed % max) / 100;
}

export type FlowArtProps = {
  taskName: string;
  minutes: number;
  difficulty: string | null;
  sessionId: string;
  width: number;
  height: number;
};

/**
 * Unique abstract art from this flow session (no scores).
 * Colors and shapes derived from task + duration + difficulty + sessionId.
 */
export function FlowAbstractArt({ taskName, minutes, difficulty, sessionId, width, height }: FlowArtProps) {
  const seed = hashStr([taskName, minutes, difficulty, sessionId].join("|"));
  const s1 = hashStr(seed + "1");
  const s2 = hashStr(seed + "2");
  const s3 = hashStr(seed + "3");
  const s4 = hashStr(seed + "4");

  const hue1 = seedToHue(s1);
  const hue2 = seedToHue(s2);
  const hue3 = seedToHue(s3);

  const cx1 = width * (0.2 + seedToPercent(s1, 60));
  const cy1 = height * (0.3 + seedToPercent(s2, 40));
  const r1 = 80 + (s1 % 80);
  const cx2 = width * (0.5 + seedToPercent(s3, 50));
  const cy2 = height * (0.5 + seedToPercent(s4, 40));
  const r2 = 60 + (s2 % 70);
  const cx3 = width * (0.7 + seedToPercent(s1 + s2, 30));
  const cy3 = height * (0.25 + seedToPercent(s3 + s4, 50));
  const r3 = 70 + (s3 % 60);

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={`hsl(${hue1}, 65%, 92%)`} />
            <Stop offset="100%" stopColor={`hsl(${hue2}, 55%, 85%)`} />
          </LinearGradient>
          <LinearGradient id="blob1" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={`hsl(${hue1}, 70%, 65%)`} stopOpacity="0.9" />
            <Stop offset="100%" stopColor={`hsl(${hue2}, 60%, 55%)`} stopOpacity="0.6" />
          </LinearGradient>
          <LinearGradient id="blob2" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={`hsl(${hue2}, 65%, 60%)`} stopOpacity="0.7" />
            <Stop offset="100%" stopColor={`hsl(${hue3}, 60%, 70%)`} stopOpacity="0.5" />
          </LinearGradient>
          <LinearGradient id="blob3" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={`hsl(${hue3}, 70%, 68%)`} stopOpacity="0.6" />
            <Stop offset="100%" stopColor={`hsl(${hue1}, 55%, 58%)`} stopOpacity="0.8" />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#bg)" />
        <Circle cx={cx1} cy={cy1} r={r1} fill="url(#blob1)" />
        <Circle cx={cx2} cy={cy2} r={r2} fill="url(#blob2)" />
        <Circle cx={cx3} cy={cy3} r={r3} fill="url(#blob3)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: "hidden", borderRadius: 20 }
});
