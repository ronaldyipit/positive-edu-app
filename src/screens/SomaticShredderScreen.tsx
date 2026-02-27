import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  ScrollView,
  Platform,
  Vibration
} from "react-native";
import { Accelerometer } from "expo-sensors";

const COACH_API_BASE = process.env.EXPO_PUBLIC_COACH_API_URL || "http://localhost:4000";

const ENCOURAGEMENTS = [
  "做得好！壓力已被你親手粉碎了 💪",
  "你比你想像中更勇敢 🌟",
  "放下了，就輕了 🍃",
  "這一刻屬於你，好好呼吸 🌈",
  "每一次呼吸，都是重新開始 ✨",
  "你用身體把它甩走了，幹得漂亮 🔥"
];

const BREATH_PHASES = [
  { label: "吸氣", seconds: 4, targetSize: 140, color: "#bfdbfe" },
  { label: "屏氣", seconds: 7, targetSize: 140, color: "#c4b5fd" },
  { label: "呼氣", seconds: 8, targetSize: 72, color: "#bbf7d0" }
];

const SHAKE_THRESHOLD = 1.8; // 搖動強度門檻

export default function SomaticShredderScreen() {
  const [ventText, setVentText] = useState("");
  const [step, setStep] = useState<"write" | "shake" | "breathe" | "done">("write");
  const [shakeProgress, setShakeProgress] = useState(0); // 0–100
  const [encouragement, setEncouragement] = useState("");
  const [breathPhaseIdx, setBreathPhaseIdx] = useState(0);
  const [breathCountdown, setBreathCountdown] = useState(4);
  const [breathCycles, setBreathCycles] = useState(0);
  const [aiClosing, setAiClosing] = useState("");
  const [intensityFeedback, setIntensityFeedback] = useState("");
  const [shredPieces] = useState(() =>
    Array.from({ length: 12 }, (_, i) => ({
      id: i,
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      rot: new Animated.Value(0),
      opacity: new Animated.Value(0)
    }))
  );

  const circleAnim = useRef(new Animated.Value(72)).current;
  const shakeBarAnim = useRef(new Animated.Value(0)).current;
  const breathAnimRef = useRef<ReturnType<typeof Animated.timing> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shakeAccumRef = useRef(0);
  const lastShakeRef = useRef(0);
  const maxMagnitudeRef = useRef(0);

  // ── 加速度計監聽 ──────────────────────────────────────────
  useEffect(() => {
    if (step !== "shake") return;

    Accelerometer.setUpdateInterval(100);
    const sub = Accelerometer.addListener(({ x, y, z }) => {
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      const now = Date.now();

      if (magnitude > SHAKE_THRESHOLD && now - lastShakeRef.current > 150) {
        lastShakeRef.current = now;
        if (magnitude > maxMagnitudeRef.current) maxMagnitudeRef.current = magnitude;
        shakeAccumRef.current = Math.min(shakeAccumRef.current + 12, 100);
        setShakeProgress(shakeAccumRef.current);
        Animated.spring(shakeBarAnim, {
          toValue: shakeAccumRef.current,
          useNativeDriver: false,
          speed: 30
        }).start();

        if (shakeAccumRef.current >= 100) {
          sub.remove();
          triggerShredAnimation();
        }
      }
    });

    return () => sub.remove();
  }, [step]);

  const triggerShredAnimation = useCallback(() => {
    Vibration.vibrate(400);
    if (maxMagnitudeRef.current >= 2.8) setIntensityFeedback("很有力！💪");
    else if (maxMagnitudeRef.current >= 2.2) setIntensityFeedback("搖得很棒！");
    maxMagnitudeRef.current = 0;
    setEncouragement(ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)]);

    shredPieces.forEach((p, i) => {
      const angle = (i / shredPieces.length) * 2 * Math.PI;
      const dist = 70 + Math.random() * 50;
      p.x.setValue(0);
      p.y.setValue(0);
      p.rot.setValue(0);
      p.opacity.setValue(1);
      Animated.parallel([
        Animated.timing(p.x, { toValue: Math.cos(angle) * dist, duration: 600, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
        Animated.timing(p.y, { toValue: Math.sin(angle) * dist - 20, duration: 600, useNativeDriver: true }),
        Animated.timing(p.rot, { toValue: (Math.random() - 0.5) * 900, duration: 600, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(350),
          Animated.timing(p.opacity, { toValue: 0, duration: 250, useNativeDriver: true })
        ])
      ]).start();
    });

    setTimeout(() => {
      setStep("breathe");
      startBreathing(0, 0);
    }, 800);
  }, [shredPieces]);

  // ── 4-7-8 呼吸引導 ───────────────────────────────────────
  const startBreathing = useCallback((phaseIdx: number, cycles: number) => {
    const phase = BREATH_PHASES[phaseIdx];
    setBreathPhaseIdx(phaseIdx);
    setBreathCountdown(phase.seconds);

    breathAnimRef.current = Animated.timing(circleAnim, {
      toValue: phase.targetSize,
      duration: phase.seconds * 1000,
      useNativeDriver: false,
      easing: Easing.inOut(Easing.sine)
    });
    breathAnimRef.current.start(({ finished }) => {
      if (!finished) return;
      const nextPhase = (phaseIdx + 1) % BREATH_PHASES.length;
      const newCycles = nextPhase === 0 ? cycles + 1 : cycles;
      setBreathCycles(newCycles);
      if (newCycles >= 3) {
        setStep("done");
        fetch(`${COACH_API_BASE}/api/somatic-done`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
          .then((r) => r.json())
          .then((j) => j?.message && setAiClosing(j.message))
          .catch(() => {});
        return;
      }
      startBreathing(nextPhase, newCycles);
    });

    // 倒數計時
    if (countdownRef.current) clearInterval(countdownRef.current);
    let remaining = phase.seconds;
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      setBreathCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(countdownRef.current!);
      }
    }, 1000);
  }, [circleAnim]);

  useEffect(() => {
    return () => {
      breathAnimRef.current?.stop();
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const handleReset = () => {
    breathAnimRef.current?.stop();
    if (countdownRef.current) clearInterval(countdownRef.current);
    shakeAccumRef.current = 0;
    maxMagnitudeRef.current = 0;
    shakeBarAnim.setValue(0);
    circleAnim.setValue(72);
    setVentText("");
    setStep("write");
    setShakeProgress(0);
    setBreathPhaseIdx(0);
    setBreathCycles(0);
    setBreathCountdown(4);
    setAiClosing("");
    setIntensityFeedback("");
  };

  const currentPhase = BREATH_PHASES[breathPhaseIdx];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.title}>抒壓碎紙機</Text>

      {/* ── Step 1: 寫下壓力 ── */}
      {step === "write" && (
        <>
          <Text style={styles.subtitle}>
            把讓你煩惱的事寫出來。{"\n"}
            寫出來本身就是一種釋放。
          </Text>
          <TextInput
            style={styles.textArea}
            placeholder="寫下讓你壓力大的事…不用擔心，沒有人會看到"
            placeholderTextColor="#9ca3af"
            multiline
            value={ventText}
            onChangeText={setVentText}
          />
          <TouchableOpacity
            style={[styles.primaryBtn, !ventText.trim() && styles.btnDisabled]}
            onPress={() => ventText.trim() && setStep("shake")}
            disabled={!ventText.trim()}
          >
            <Text style={styles.primaryBtnText}>寫好了，去粉碎它 →</Text>
          </TouchableOpacity>
        </>
      )}

      {/* ── Step 2: 搖動手機 ── */}
      {step === "shake" && (
        <View style={styles.shakeSection}>
          <Text style={styles.shakeTitle}>📱 用力搖動你的手機！</Text>
          <Text style={styles.shakeDesc}>
            把所有壓力傾注到搖動裡，讓身體把它甩走
          </Text>

          {/* 顯示要粉碎的文字 */}
          <View style={styles.ventPreview}>
            <Text style={styles.ventPreviewText} numberOfLines={3}>{ventText}</Text>
          </View>

          {/* 碎片動畫層 */}
          <View style={styles.shredFxLayer} pointerEvents="none">
            {shredPieces.map((p) => (
              <Animated.Text
                key={p.id}
                style={[styles.shredPiece, {
                  opacity: p.opacity,
                  transform: [
                    { translateX: p.x },
                    { translateY: p.y },
                    { rotate: p.rot.interpolate({ inputRange: [-900, 900], outputRange: ["-900deg", "900deg"] }) }
                  ]
                }]}
              >
                ✂️
              </Animated.Text>
            ))}
          </View>

          {/* 進度條 */}
          <View style={styles.shakeBarBg}>
            <Animated.View style={[styles.shakeBarFill, {
              width: shakeBarAnim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] })
            }]} />
          </View>
          <Text style={styles.shakeHint}>
            {shakeProgress < 100 ? `${Math.round(shakeProgress)}% — 繼續搖！` : "粉碎中…💥"}
          </Text>

          {/* 備用按鈕（Web / 模擬器無加速度計） */}
          {Platform.OS === "web" && (
            <TouchableOpacity style={[styles.primaryBtn, { marginTop: 20 }]} onPress={triggerShredAnimation}>
              <Text style={styles.primaryBtnText}>💥 網頁版：點擊粉碎</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Step 3: 呼吸 ── */}
      {(step === "breathe" || step === "done") && (
        <>
          <View style={styles.shredResult}>
            <Text style={styles.shredResultTitle}>已粉碎 ✓</Text>
            <Text style={styles.encouragementText}>{encouragement}</Text>
            {intensityFeedback ? <Text style={styles.intensityText}>{intensityFeedback}</Text> : null}
            {aiClosing ? <Text style={styles.aiClosingText}>💬 {aiClosing}</Text> : null}
          </View>

          <View style={styles.breathSection}>
            <Text style={styles.breathTitle}>4-7-8 呼吸練習</Text>
            <Text style={styles.breathDesc}>吸氣 4 秒 → 屏氣 7 秒 → 呼氣 8 秒　共 3 次</Text>

            <View style={styles.breathCircleWrap}>
              <Animated.View style={[styles.breathCircle, {
                width: circleAnim,
                height: circleAnim,
                backgroundColor: step === "done" ? "#bbf7d0" : currentPhase.color
              }]} />
              <Text style={styles.breathPhaseLabel}>
                {step === "done" ? "完成 🎉" : currentPhase.label}
              </Text>
              {step !== "done" && (
                <Text style={styles.breathCountdown}>{breathCountdown}</Text>
              )}
            </View>

            {/* 進度點 */}
            <View style={styles.breathDotsRow}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={[styles.breathDot, breathCycles > i && styles.breathDotDone]} />
              ))}
            </View>

            <Text style={styles.breathStatusText}>
              {step === "done"
                ? "三次呼吸完成！副交感神經已啟動，好好感受這份平靜 🌿"
                : `第 ${breathCycles + 1} / 3 次`}
            </Text>
          </View>
        </>
      )}

      {/* 重設按鈕 */}
      {step !== "write" && (
        <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
          <Text style={styles.resetBtnText}>↩ 重新開始</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#f9fafb" },
  container: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 4, color: "#111827" },
  subtitle: { fontSize: 13, color: "#4b5563", marginBottom: 12, lineHeight: 20 },
  textArea: {
    minHeight: 130,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#d1d5db",
    padding: 14,
    backgroundColor: "#fff",
    fontSize: 15,
    color: "#111827",
    textAlignVertical: "top",
    marginBottom: 12
  },
  primaryBtn: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 999,
    alignSelf: "center"
  },
  btnDisabled: { opacity: 0.35 },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  // Shake step
  shakeSection: { alignItems: "center", paddingVertical: 8 },
  shakeTitle: { fontSize: 20, fontWeight: "700", color: "#111827", marginBottom: 6, textAlign: "center" },
  shakeDesc: { fontSize: 14, color: "#4b5563", textAlign: "center", marginBottom: 16 },
  ventPreview: {
    backgroundColor: "#fef2f2",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#fecaca",
    width: "100%",
    marginBottom: 20,
    minHeight: 60
  },
  ventPreviewText: { fontSize: 14, color: "#991b1b", lineHeight: 20 },
  shredFxLayer: { height: 60, justifyContent: "center", alignItems: "center", width: "100%" },
  shredPiece: { position: "absolute", fontSize: 20 },
  shakeBarBg: {
    width: "100%",
    height: 18,
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
    overflow: "hidden",
    marginBottom: 8
  },
  shakeBarFill: {
    height: "100%",
    backgroundColor: "#ef4444",
    borderRadius: 999
  },
  shakeHint: { fontSize: 14, color: "#6b7280", fontWeight: "600" },
  // Shred result
  shredResult: {
    backgroundColor: "#fff7ed",
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#fed7aa",
    alignItems: "center"
  },
  shredResultTitle: { fontSize: 20, fontWeight: "700", color: "#9a3412", marginBottom: 6 },
  encouragementText: { fontSize: 15, color: "#c2410c", textAlign: "center", lineHeight: 22 },
  intensityText: { fontSize: 14, color: "#ea580c", fontWeight: "600", marginTop: 4 },
  aiClosingText: { fontSize: 13, color: "#78350f", fontStyle: "italic", marginTop: 8 },
  // Breathing
  breathSection: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2
  },
  breathTitle: { fontSize: 17, fontWeight: "700", color: "#111827", marginBottom: 4 },
  breathDesc: { fontSize: 12, color: "#6b7280", marginBottom: 20, textAlign: "center" },
  breathCircleWrap: {
    width: 160,
    height: 160,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16
  },
  breathCircle: {
    position: "absolute",
    borderRadius: 999
  },
  breathPhaseLabel: { fontSize: 20, fontWeight: "700", color: "#1e3a5f", zIndex: 1 },
  breathCountdown: { fontSize: 28, fontWeight: "700", color: "#1e3a5f", marginTop: 4, zIndex: 1 },
  breathDotsRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
  breathDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#e5e7eb" },
  breathDotDone: { backgroundColor: "#22c55e" },
  breathStatusText: { fontSize: 13, color: "#4b5563", textAlign: "center", lineHeight: 20 },
  resetBtn: {
    alignSelf: "center",
    backgroundColor: "#6b7280",
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 999
  },
  resetBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 }
});
