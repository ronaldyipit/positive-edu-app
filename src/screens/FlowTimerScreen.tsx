import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  ScrollView,
  TextInput
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@flow_timer_data";
const COACH_API_BASE = process.env.EXPO_PUBLIC_COACH_API_URL || "http://localhost:4000";

const DURATIONS = [
  { label: "5 分", minutes: 5 },
  { label: "15 分", minutes: 15 },
  { label: "25 分", minutes: 25 },
  { label: "45 分", minutes: 45 }
];

// RPG 稱號：根據累計完成次數
const RPG_TITLES = [
  { threshold: 0,  icon: "🌱", title: "初心學者",   color: "#16a34a" },
  { threshold: 3,  icon: "🔥", title: "燃燒鬥士",   color: "#ea580c" },
  { threshold: 5,  icon: "⚡", title: "心流俠客",   color: "#7c3aed" },
  { threshold: 10, icon: "🏆", title: "專注大師",   color: "#b45309" },
  { threshold: 20, icon: "💎", title: "傳奇學者",   color: "#0369a1" },
  { threshold: 40, icon: "👑", title: "至尊智者",   color: "#be185d" }
];

const BADGES = [
  { threshold: 1,  icon: "🌱", name: "第一步" },
  { threshold: 3,  icon: "🔥", name: "燃燒中" },
  { threshold: 5,  icon: "⚡", name: "心流達人" },
  { threshold: 10, icon: "🏆", name: "專注大師" },
  { threshold: 20, icon: "💎", name: "傳奇學者" }
];

function getRpgTitle(sessions: number) {
  let result = RPG_TITLES[0];
  for (const t of RPG_TITLES) {
    if (sessions >= t.threshold) result = t;
  }
  return result;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

const RADIUS = 90;
const STROKE = 10;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SIZE = (RADIUS + STROKE) * 2 + 8;

export default function FlowTimerScreen() {
  const [selectedIdx, setSelectedIdx] = useState(2);
  const [taskName, setTaskName] = useState("");
  const [taskInput, setTaskInput] = useState("");
  const [sessionLog, setSessionLog] = useState<{ task: string; minutes: number }[]>([]);

  const totalSeconds = DURATIONS[selectedIdx].minutes * 60;
  const [remaining, setRemaining] = useState(totalSeconds);
  const [running, setRunning] = useState(false);
  const [xp, setXp] = useState(0);
  const [completedSessions, setCompletedSessions] = useState(0);
  const [celebrateAnim] = useState(new Animated.Value(0));
  const [showCelebrate, setShowCelebrate] = useState(false);
  const [celebrateTask, setCelebrateTask] = useState("");
  const [aiReflection, setAiReflection] = useState("");
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    (async () => {
      if (hasLoadedRef.current) return;
      hasLoadedRef.current = true;
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const data = JSON.parse(raw);
        if (typeof data.xp === "number") setXp(data.xp);
        if (typeof data.completedSessions === "number") setCompletedSessions(data.completedSessions);
        if (Array.isArray(data.sessionLog)) setSessionLog(data.sessionLog.slice(0, 10));
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (!hasLoadedRef.current) return;
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ xp, completedSessions, sessionLog: sessionLog.slice(0, 10) })
    ).catch(() => {});
  }, [xp, completedSessions, sessionLog]);

  const progress = 1 - remaining / totalSeconds;
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);
  const rpg = getRpgTitle(completedSessions);
  const level = Math.floor(xp / 100) + 1;
  const progressToNext = xp % 100;

  const handleSelectDuration = (idx: number) => {
    if (running) return;
    setSelectedIdx(idx);
    setRemaining(DURATIONS[idx].minutes * 60);
  };

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          setRunning(false);
          const earned = DURATIONS[selectedIdx].minutes * 2;
          const task = taskName.trim() || "自由學習";
          const minutes = DURATIONS[selectedIdx].minutes;
          setXp((x) => x + earned);
          setCompletedSessions((c) => c + 1);
          setCelebrateTask(task);
          setSessionLog((log) => [{ task, minutes }, ...log].slice(0, 10));
          setAiReflection("");
          fetch(`${COACH_API_BASE}/api/timer-reflection`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ task, minutes })
          })
            .then((r) => r.json())
            .then((j) => j?.message && setAiReflection(j.message))
            .catch(() => {});
          triggerCelebrate();
          return DURATIONS[selectedIdx].minutes * 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, selectedIdx, taskName]);

  const triggerCelebrate = () => {
    setShowCelebrate(true);
    celebrateAnim.setValue(0);
    Animated.sequence([
      Animated.timing(celebrateAnim, { toValue: 1, duration: 400, useNativeDriver: true, easing: Easing.out(Easing.back(2)) }),
      Animated.delay(2200),
      Animated.timing(celebrateAnim, { toValue: 0, duration: 300, useNativeDriver: true })
    ]).start(() => setShowCelebrate(false));
  };

  const handleStart = () => {
    if (!running && taskInput.trim()) setTaskName(taskInput.trim());
    setRunning((r) => !r);
  };

  const handleReset = () => {
    setRunning(false);
    setRemaining(totalSeconds);
  };

  const earnedBadges = BADGES.filter((b) => completedSessions >= b.threshold);
  const nextBadge = BADGES.find((b) => completedSessions < b.threshold);
  const ringColor = running ? "#2563eb" : remaining === totalSeconds ? "#e5e7eb" : "#f97316";
  const durationCounts = sessionLog.reduce((acc, s) => {
    acc[s.minutes] = (acc[s.minutes] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);
  const recommendedMinutes =
    sessionLog.length >= 2 ? Number(Object.entries(durationCounts).sort((a, b) => b[1] - a[1])[0]?.[0]) : null;
  const recommendedIdx = recommendedMinutes != null ? DURATIONS.findIndex((d) => d.minutes === recommendedMinutes) : -1;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.title}>心流專注計時</Text>

      {/* RPG 稱號 */}
      <View style={[styles.rpgBanner, { borderColor: rpg.color }]}>
        <Text style={styles.rpgIcon}>{rpg.icon}</Text>
        <View>
          <Text style={[styles.rpgTitle, { color: rpg.color }]}>{rpg.title}</Text>
          <Text style={styles.rpgSub}>等級 {level} · {xp} XP · 完成 {completedSessions} 次</Text>
        </View>
      </View>

      {/* 任務命名 */}
      {!running && (
        <View style={styles.taskInputRow}>
          <TextInput
            style={styles.taskInput}
            placeholder="今次專注的任務（選填，如：溫習數學）"
            placeholderTextColor="#9ca3af"
            value={taskInput}
            onChangeText={setTaskInput}
          />
        </View>
      )}
      {running && taskName ? (
        <Text style={styles.taskRunning}>🎯 任務：{taskName}</Text>
      ) : null}

      {/* 時長選擇 */}
      <View style={styles.durationRow}>
        {DURATIONS.map((d, i) => (
          <TouchableOpacity
            key={d.minutes}
            style={[styles.durationBtn, selectedIdx === i && styles.durationBtnActive, running && styles.durationBtnDisabled]}
            onPress={() => handleSelectDuration(i)}
            disabled={running}
          >
            <Text style={[styles.durationText, selectedIdx === i && styles.durationTextActive]}>{d.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {recommendedIdx >= 0 && recommendedIdx !== selectedIdx && !running && (
        <Text style={styles.recommendText}>💡 你較常完成 {DURATIONS[recommendedIdx].label}，這次也可以試試</Text>
      )}

      {/* 環形計時圈 */}
      <View style={styles.svgWrap}>
        <Svg width={SIZE} height={SIZE}>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} stroke="#e5e7eb" strokeWidth={STROKE} fill="none" />
          <Circle
            cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
            stroke={ringColor} strokeWidth={STROKE} fill="none"
            strokeDasharray={`${CIRCUMFERENCE}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            rotation="-90"
            origin={`${SIZE / 2}, ${SIZE / 2}`}
          />
        </Svg>
        <View style={styles.timerOverlay}>
          <Text style={styles.timerText}>{formatTime(remaining)}</Text>
          <Text style={styles.timerLabel}>{running ? "專注中… 🎯" : remaining === totalSeconds ? "準備開始" : "已暫停"}</Text>
        </View>
      </View>

      {/* 升級慶祝 */}
      {showCelebrate && (
        <Animated.View style={[styles.celebrateBox, {
          opacity: celebrateAnim,
          transform: [{ scale: celebrateAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }]
        }]}>
          <Text style={styles.celebrateText}>
            🎉 完成！{celebrateTask ? `「${celebrateTask}」` : ""}
          </Text>
          <Text style={styles.celebrateXp}>+{DURATIONS[selectedIdx].minutes * 2} XP 已獲得</Text>
          {aiReflection ? <Text style={styles.celebrateAi}>💬 {aiReflection}</Text> : null}
        </Animated.View>
      )}

      {/* 按鈕 */}
      <View style={styles.buttonsRow}>
        <TouchableOpacity style={[styles.button, running ? styles.buttonPause : styles.buttonStart]} onPress={handleStart}>
          <Text style={styles.buttonText}>{running ? "⏸ 暫停" : "▶ 開始"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={handleReset}>
          <Text style={styles.buttonText}>↩ 重設</Text>
        </TouchableOpacity>
      </View>

      {/* XP 進度條 */}
      <View style={styles.statsBox}>
        <View style={styles.statsHeader}>
          <Text style={styles.statsTitle}>等級 {level}</Text>
          <Text style={styles.xpText}>{xp} XP</Text>
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progressToNext}%` }]} />
        </View>
        <Text style={styles.statsSubtext}>下一等級還需 {100 - progressToNext} XP</Text>
        {nextBadge && (
          <Text style={styles.nextBadge}>下一個徽章：{nextBadge.icon} {nextBadge.name}（完成 {nextBadge.threshold} 次）</Text>
        )}
      </View>

      {/* 徽章 */}
      {earnedBadges.length > 0 && (
        <View style={styles.badgeBox}>
          <Text style={styles.badgeTitle}>已獲得的徽章</Text>
          <View style={styles.badgeRow}>
            {earnedBadges.map((b) => (
              <View key={b.name} style={styles.badgeItem}>
                <Text style={styles.badgeIcon}>{b.icon}</Text>
                <Text style={styles.badgeName}>{b.name}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 最近完成記錄 */}
      {sessionLog.length > 0 && (
        <View style={styles.logBox}>
          <Text style={styles.logTitle}>最近完成記錄</Text>
          {sessionLog.slice(0, 5).map((s, i) => (
            <View key={i} style={styles.logRow}>
              <Text style={styles.logTask}>✅ {s.task}</Text>
              <Text style={styles.logMin}>{s.minutes} 分</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#f9fafb" },
  container: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 12, color: "#111827" },
  // RPG Banner
  rpgBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 2,
    padding: 12,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2
  },
  rpgIcon: { fontSize: 32 },
  rpgTitle: { fontSize: 18, fontWeight: "800" },
  rpgSub: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  // Task input
  taskInputRow: { marginBottom: 10 },
  taskInput: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: "#fff",
    color: "#111827"
  },
  taskRunning: { fontSize: 13, color: "#2563eb", fontWeight: "600", marginBottom: 8, textAlign: "center" },
  // Duration
  durationRow: { flexDirection: "row", justifyContent: "center", marginBottom: 12, gap: 8 },
  durationBtn: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 999, borderWidth: 1.5, borderColor: "#d1d5db", backgroundColor: "#fff"
  },
  durationBtnActive: { borderColor: "#2563eb", backgroundColor: "#eff6ff" },
  durationBtnDisabled: { opacity: 0.4 },
  durationText: { fontSize: 14, color: "#6b7280", fontWeight: "600" },
  durationTextActive: { color: "#2563eb" },
  recommendText: { fontSize: 12, color: "#7c3aed", textAlign: "center", marginBottom: 8 },
  // Timer ring
  svgWrap: { alignSelf: "center", justifyContent: "center", alignItems: "center", marginBottom: 8 },
  timerOverlay: { position: "absolute", alignItems: "center" },
  timerText: { fontSize: 42, fontWeight: "700", color: "#1f2937" },
  timerLabel: { marginTop: 4, fontSize: 13, color: "#4b5563" },
  // Celebrate
  celebrateBox: {
    alignSelf: "center",
    backgroundColor: "#fef9c3",
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#fde047",
    alignItems: "center"
  },
  celebrateText: { fontSize: 16, fontWeight: "700", color: "#854d0e" },
  celebrateXp: { fontSize: 13, color: "#a16207", marginTop: 2 },
  celebrateAi: { fontSize: 12, color: "#92400e", marginTop: 6, fontStyle: "italic" },
  // Buttons
  buttonsRow: { flexDirection: "row", justifyContent: "center", marginBottom: 16, gap: 12 },
  button: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999 },
  buttonStart: { backgroundColor: "#22c55e" },
  buttonPause: { backgroundColor: "#f97316" },
  buttonSecondary: { backgroundColor: "#6b7280" },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  // Stats
  statsBox: {
    padding: 16, borderRadius: 16, backgroundColor: "#fff",
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, marginBottom: 12
  },
  statsHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  statsTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  xpText: { fontSize: 14, color: "#2563eb", fontWeight: "600" },
  progressBar: { height: 10, borderRadius: 999, backgroundColor: "#e5e7eb", overflow: "hidden", marginBottom: 4 },
  progressFill: { height: "100%", backgroundColor: "#2563eb", borderRadius: 999 },
  statsSubtext: { fontSize: 12, color: "#6b7280" },
  nextBadge: { marginTop: 8, fontSize: 13, color: "#7c3aed" },
  // Badges
  badgeBox: {
    padding: 16, borderRadius: 16, backgroundColor: "#fff",
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, marginBottom: 12
  },
  badgeTitle: { fontSize: 15, fontWeight: "700", color: "#111827", marginBottom: 10 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  badgeItem: { alignItems: "center", minWidth: 56 },
  badgeIcon: { fontSize: 28 },
  badgeName: { fontSize: 11, color: "#4b5563", marginTop: 2, textAlign: "center" },
  // Session log
  logBox: {
    padding: 16, borderRadius: 16, backgroundColor: "#fff",
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 2
  },
  logTitle: { fontSize: 15, fontWeight: "700", color: "#111827", marginBottom: 10 },
  logRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  logTask: { fontSize: 13, color: "#374151", flex: 1 },
  logMin: { fontSize: 13, color: "#6b7280", fontWeight: "600" }
});
