import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ScrollView,
  TextInput,
  Linking,
  StatusBar,
  Modal,
  Dimensions,
  Platform
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { AppBackground } from "../components/AppBackground";
import { FlowAbstractArt } from "../components/FlowAbstractArt";
import { useAuth } from "../contexts/AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@flow_timer_data";
const COACH_API_BASE = process.env.EXPO_PUBLIC_COACH_API_URL || "https://positive-edu-app.vercel.app";

const MIN_DURATION_MINUTES = 5;

const DURATIONS = [
  { label: "5 分", minutes: 5 },
  { label: "15 分", minutes: 15 },
  { label: "25 分", minutes: 25 },
  { label: "45 分", minutes: 45 },
  { label: "60 分", minutes: 60 }
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

function randomPulseIntervalSec() {
  return 12 * 60 + Math.floor(Math.random() * 6 * 60);
}

const TIME_GUESS_OPTIONS = [5, 10, 15, 20, 25, 30, 40, 45, 60];
const SAFETY_CONTACT_KEY = "@deep_dive_safety_contact";
const LONG_PRESS_EXIT_SEC = 10;

/** 將電話轉成 WhatsApp 用的國際格式（僅數字，可選加 852） */
function toWhatsAppPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8) return null;
  if (digits.length === 8 && /^[69]/.test(digits)) return "852" + digits;
  if (digits.startsWith("852") && digits.length >= 11) return digits;
  if (digits.length >= 9) return digits;
  return null;
}

export default function FlowTimerScreen() {
  const { user } = useAuth();
  const [selectedIdx, setSelectedIdx] = useState(2);
  const [customMinutesInput, setCustomMinutesInput] = useState("");
  const [taskName, setTaskName] = useState("");
  const [taskInput, setTaskInput] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "match" | "challenge" | null>(null);
  const [sessionLog, setSessionLog] = useState<{ task: string; minutes: number }[]>([]);

  const effectiveMinutes =
    selectedIdx >= 0
      ? DURATIONS[selectedIdx].minutes
      : Math.min(999, Math.max(MIN_DURATION_MINUTES, parseInt(customMinutesInput, 10) || MIN_DURATION_MINUTES));
  const totalSeconds = effectiveMinutes * 60;
  const [remaining, setRemaining] = useState(totalSeconds);
  const [running, setRunning] = useState(false);
  const [xp, setXp] = useState(0);
  const [completedSessions, setCompletedSessions] = useState(0);
  const [celebrateAnim] = useState(new Animated.Value(0));
  const [showCelebrate, setShowCelebrate] = useState(false);
  const [celebrateTask, setCelebrateTask] = useState("");
  const [aiReflection, setAiReflection] = useState("");
  const hasLoadedRef = useRef(false);
  const nextHapticAtRef = useRef(0);

  // 心流結束流程：盲測時間 → 對比驚喜 → 獨一無二抽象畫
  const [showTimeGuessModal, setShowTimeGuessModal] = useState(false);
  const [feltMinutes, setFeltMinutes] = useState<number | null>(null);
  const [showRevealModal, setShowRevealModal] = useState(false);
  const [flowTimeFeedbackMessage, setFlowTimeFeedbackMessage] = useState<string | null>(null);
  const [flowTimeFeedbackLoading, setFlowTimeFeedbackLoading] = useState(false);
  const [showArtModal, setShowArtModal] = useState(false);
  const [actualMinutesForReveal, setActualMinutesForReveal] = useState(0);
  const [sessionEndTaskName, setSessionEndTaskName] = useState("");
  const [sessionEndDifficulty, setSessionEndDifficulty] = useState<string | null>(null);
  const [sessionEndId, setSessionEndId] = useState("");
  const [safetyContact, setSafetyContact] = useState("");
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [showConfirmAfterWhatsApp, setShowConfirmAfterWhatsApp] = useState(false);
  const [exitLongPressProgress, setExitLongPressProgress] = useState(0);
  const longPressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const longPressStartRef = useRef(0);

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
    AsyncStorage.getItem(SAFETY_CONTACT_KEY).then((v) => { if (v != null) setSafetyContact(v); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!hasLoadedRef.current) return;
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ xp, completedSessions, sessionLog: sessionLog.slice(0, 10) })
    ).catch(() => {});
  }, [xp, completedSessions, sessionLog]);

  const progress = 1 - remaining / totalSeconds;
  const displayProgress = running ? Math.pow(progress, 0.85) : progress;
  const strokeDashoffset = CIRCUMFERENCE * (1 - displayProgress);
  const rpg = getRpgTitle(completedSessions);
  const level = Math.floor(xp / 100) + 1;
  const progressToNext = xp % 100;

  const handleSelectDuration = (idx: number) => {
    if (running) return;
    setSelectedIdx(idx);
    setRemaining(DURATIONS[idx].minutes * 60);
  };

  const handleCustomMinutesChange = (text: string) => {
    setSelectedIdx(-1);
    setCustomMinutesInput(text.replace(/[^0-9]/g, ""));
  };

  useEffect(() => {
    if (!running && selectedIdx === -1) {
      const mins = Math.min(999, Math.max(MIN_DURATION_MINUTES, parseInt(customMinutesInput, 10) || MIN_DURATION_MINUTES));
      setRemaining(mins * 60);
    }
  }, [customMinutesInput, selectedIdx, running]);

  useEffect(() => {
    if (!running) return;
    nextHapticAtRef.current = randomPulseIntervalSec();
  }, [running]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setRemaining((prev) => {
        const nextRemaining = prev - 1;
        const elapsed = totalSeconds - nextRemaining;
        if (elapsed >= nextHapticAtRef.current) {
          if (Platform.OS !== "web") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          }
          nextHapticAtRef.current += randomPulseIntervalSec();
        }
        if (prev <= 1) {
          clearInterval(id);
          setRunning(false);
          const minutes = Math.round(totalSeconds / 60);
          const earned = minutes * 2;
          const task = taskName.trim() || "自由學習";
          setXp((x) => x + earned);
          setCompletedSessions((c) => c + 1);
          setCelebrateTask(task);
          setSessionLog((log) => [{ task, minutes }, ...log].slice(0, 10));
          setActualMinutesForReveal(minutes);
          setSessionEndTaskName(task);
          setSessionEndDifficulty(difficulty);
          setSessionEndId(Date.now().toString());
          setShowTimeGuessModal(true);
          setFeltMinutes(null);
          fetch(`${COACH_API_BASE}/api/timer-reflection`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ task, minutes })
          })
            .then((r) => r.json())
            .then((j) => j?.message && setAiReflection(j.message))
            .catch(() => {});
          return totalSeconds;
        }
        return nextRemaining;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, taskName, totalSeconds, difficulty]);

  // 心流時差：開啟對比驚喜時向後端取得 AI 回饋
  useEffect(() => {
    if (!showRevealModal || feltMinutes === null) return;
    setFlowTimeFeedbackMessage(null);
    setFlowTimeFeedbackLoading(true);
    fetch(`${COACH_API_BASE}/api/flow-time-feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        feltMinutes,
        actualMinutes: actualMinutesForReveal,
        task: sessionEndTaskName || undefined
      })
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.message && setFlowTimeFeedbackMessage(j.message))
      .catch(() => {})
      .finally(() => setFlowTimeFeedbackLoading(false));
  }, [showRevealModal, feltMinutes, actualMinutesForReveal, sessionEndTaskName]);

  const handleStart = () => {
    if (running) {
      setRunning(false);
    } else {
      if (taskInput.trim()) setTaskName(taskInput.trim());
      setShowSafetyModal(true);
    }
  };

  const skipSafetyAndStart = () => {
    setShowSafetyModal(false);
    setRunning(true);
  };

  const handleReset = () => {
    setRunning(false);
    setRemaining(totalSeconds);
  };

  const earnedBadges = BADGES.filter((b) => completedSessions >= b.threshold);
  const nextBadge = BADGES.find((b) => completedSessions < b.threshold);
  const ringColor = running ? "#d56c2f" : remaining === totalSeconds ? "#e5e7eb" : "#f97316";
  const durationCounts = sessionLog.reduce((acc, s) => {
    acc[s.minutes] = (acc[s.minutes] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);
  const recommendedMinutes =
    sessionLog.length >= 2 ? Number(Object.entries(durationCounts).sort((a, b) => b[1] - a[1])[0]?.[0]) : null;
  const recommendedIdx = recommendedMinutes != null ? DURATIONS.findIndex((d) => d.minutes === recommendedMinutes) : -1;

  const displayName = user?.displayName?.trim() || "我";
  const craftMessage = `【${displayName}】正在進入「深潛心流」，預計在另一個維度待一陣子。請稍後再聯繫。`;
  const minutesForSession = effectiveMinutes;
  const safetySmsBody = `我現在進入 ${minutesForSession} 分鐘的「深潛心流」模式，手機將會斷網。結束後我會立刻回覆你。不用擔心！`;

  const openSafetySms = () => {
    const text = encodeURIComponent(safetySmsBody);
    const phone = toWhatsAppPhone(safetyContact.trim());
    if (phone) {
      Linking.openURL(`https://wa.me/${phone}?text=${text}`).catch(() => {});
      setShowSafetyModal(false);
      setShowConfirmAfterWhatsApp(true);
    } else {
      const url = safetyContact.trim() ? `sms:${safetyContact.trim()}&body=${text}` : `sms:?body=${text}`;
      Linking.openURL(url).catch(() => {});
      setShowSafetyModal(false);
      setShowConfirmAfterWhatsApp(true);
    }
  };

  const confirmStartAfterWhatsApp = () => {
    setShowConfirmAfterWhatsApp(false);
    setRunning(true);
  };

  const handleStartWithSafety = () => {
    if (!running && taskInput.trim()) setTaskName(taskInput.trim());
    setShowSafetyModal(true);
  };

  const handleExitLongPressStart = () => {
    longPressStartRef.current = Date.now();
    setExitLongPressProgress(0);
    longPressIntervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - longPressStartRef.current) / 1000;
      if (elapsed >= LONG_PRESS_EXIT_SEC) {
        if (longPressIntervalRef.current) clearInterval(longPressIntervalRef.current);
        longPressIntervalRef.current = null;
        setExitLongPressProgress(100);
        endSessionEarly();
      } else {
        setExitLongPressProgress((elapsed / LONG_PRESS_EXIT_SEC) * 100);
      }
    }, 100);
  };

  const handleExitLongPressEnd = () => {
    if (longPressIntervalRef.current) {
      clearInterval(longPressIntervalRef.current);
      longPressIntervalRef.current = null;
    }
    setExitLongPressProgress(0);
  };

  function endSessionEarly() {
    setRunning(false);
    const elapsedSec = totalSeconds - remaining;
    const actualMinutes = Math.max(1, Math.ceil(elapsedSec / 60));
    const task = taskName.trim() || "自由學習";
    setActualMinutesForReveal(actualMinutes);
    setSessionEndTaskName(task);
    setSessionEndDifficulty(difficulty);
    setSessionEndId(Date.now().toString());
    setShowTimeGuessModal(true);
    setFeltMinutes(null);
    setRemaining(totalSeconds);
  }

  return (
    <AppBackground>
      <StatusBar hidden={running} />
      {running ? (
        <View style={styles.flowModeContainer}>
          <LinearGradient colors={["#fff7ed", "#ffedd5", "#fed7aa", "#fdba74"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={styles.flowModeCenter}>
            <View style={styles.svgWrap}>
              <Svg width={SIZE} height={SIZE}>
                <Circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} stroke="rgba(255,255,255,0.6)" strokeWidth={STROKE} fill="none" />
                <Circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} stroke="#d56c2f" strokeWidth={STROKE} fill="none" strokeDasharray={`${CIRCUMFERENCE}`} strokeDashoffset={strokeDashoffset} strokeLinecap="round" rotation="-90" origin={`${SIZE / 2}, ${SIZE / 2}`} />
              </Svg>
              <View style={styles.timerOverlay}>
                <Text style={styles.flowModeLabel}>深潛中… 🌊</Text>
                {taskName ? <Text style={styles.flowModeTask}>{taskName}</Text> : null}
              </View>
            </View>
            <View style={styles.buttonsRow}>
              <TouchableOpacity style={[styles.button, styles.buttonPause]} onPress={handleStart}><Text style={styles.buttonText}>⏸ 暫停</Text></TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.buttonExit]}
                onPressIn={handleExitLongPressStart}
                onPressOut={handleExitLongPressEnd}
                activeOpacity={1}
              >
                <View style={styles.exitLongPressBg}>
                  <View style={[styles.exitLongPressFill, { width: `${exitLongPressProgress}%` }]} />
                </View>
                <Text style={styles.buttonText}>長按 {LONG_PRESS_EXIT_SEC} 秒結束</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
      <View style={styles.outerWrap}>
      <View style={styles.whiteCard}>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.title}>離線深潛</Text>
      <View style={styles.flowTheoryBox}>
        <Text style={styles.flowTheoryTitle}>什麼是心流？</Text>
        <Text style={styles.flowTheoryText}>
          心流（flow）不是單純「專注」，而是全神貫注、行動與意識合一的最佳體驗狀態。心理學家 Csíkszentmihályi 指出：當<Text style={styles.flowTheoryBold}> 挑戰與技能平衡 </Text>、有<Text style={styles.flowTheoryBold}> 清晰目標 </Text>與<Text style={styles.flowTheoryBold}> 即時回饋 </Text>時，較容易進入心流——沉浸、忘我、內在獎勵。計時只是輔助；先選一項對你有適當難度的任務，再開始。
        </Text>
        <TouchableOpacity onPress={() => Linking.openURL("https://en.wikipedia.org/wiki/Flow_(psychology)")}>
          <Text style={styles.flowTheoryLink}>參考：Flow (psychology) · Wikipedia</Text>
        </TouchableOpacity>
      </View>

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
            placeholder="今次想進入心流的任務（選填，例：溫習數學、寫一篇文）"
            placeholderTextColor="#9ca3af"
            value={taskInput}
            onChangeText={setTaskInput}
          />
        </View>
      )}
      {running && taskName ? (
        <Text style={styles.taskRunning}>🎯 任務：{taskName}</Text>
      ) : null}

      {/* 難度自評：心流 = 挑戰與技能平衡 */}
      {!running && (
        <View style={styles.difficultyRow}>
          <Text style={styles.difficultyLabel}>這次任務對你來說：</Text>
          <View style={styles.difficultyOptions}>
            {[
              { key: "easy" as const, label: "太易", emoji: "😴" },
              { key: "match" as const, label: "剛好", emoji: "🌊" },
              { key: "challenge" as const, label: "有挑戰", emoji: "🎯" }
            ].map(({ key, label, emoji }) => (
              <TouchableOpacity
                key={key}
                style={[styles.difficultyBtn, difficulty === key && styles.difficultyBtnActive]}
                onPress={() => setDifficulty(key)}
              >
                <Text style={[styles.difficultyBtnText, difficulty === key && styles.difficultyBtnTextActive]}>{emoji} {label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {difficulty !== null && (
            <Text style={styles.difficultyHint}>
              {difficulty === "match" && "✓ 剛好最易進入心流"}
              {difficulty === "easy" && "可試選更有挑戰的目標"}
              {difficulty === "challenge" && "有挑戰很好，保持清晰小目標"}
            </Text>
          )}
        </View>
      )}

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
      <View style={styles.customDurationRow}>
        <Text style={styles.customDurationLabel}>自訂：</Text>
        <TextInput
          style={[styles.customDurationInput, selectedIdx === -1 && styles.durationBtnActive, running && styles.durationBtnDisabled]}
          value={customMinutesInput}
          onChangeText={handleCustomMinutesChange}
          onFocus={() => !running && setSelectedIdx(-1)}
          placeholder="分鐘（至少 5）"
          placeholderTextColor="#9ca3af"
          keyboardType="number-pad"
          maxLength={3}
          editable={!running}
        />
        <Text style={styles.customDurationSuffix}>分鐘</Text>
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
          <Text style={styles.timerText}>{running ? "" : formatTime(remaining)}</Text>
          <Text style={styles.timerLabel}>{running ? "深潛中… 🌊" : remaining === totalSeconds ? "準備開始" : "已暫停"}</Text>
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
          <Text style={styles.celebrateXp}>+{effectiveMinutes * 2} XP 已獲得</Text>
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
      </View>
    </View>
      )}
      {/* 報平安：開始前發送簡訊 */}
      <Modal visible={showSafetyModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>發送報平安訊息</Text>
            <Text style={styles.safetyModalBody}>即將進入 {minutesForSession} 分鐘的「深潛心流」模式。填寫聯絡人電話後，將直接開啟該號碼的 WhatsApp 對話並預填以下內容；若未填則改為開啟簡訊。（建議手動關閉 Wi‑Fi；電話仍可接聽。）</Text>
            <Text style={styles.safetyPreview} numberOfLines={3}>{safetySmsBody}</Text>
            <TextInput
              style={styles.safetyContactInput}
              placeholder="報平安聯絡人電話（填寫後會開 WhatsApp，例：91234567）"
              placeholderTextColor="#9ca3af"
              value={safetyContact}
              onChangeText={(t) => { setSafetyContact(t); AsyncStorage.setItem(SAFETY_CONTACT_KEY, t).catch(() => {}); }}
              keyboardType="phone-pad"
            />
            <View style={styles.safetyButtonsRow}>
              <TouchableOpacity style={[styles.button, styles.buttonStart]} onPress={openSafetySms}>
                <Text style={styles.buttonText}>填寫並發送（開 WhatsApp）</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={skipSafetyAndStart}>
                <Text style={styles.buttonText}>跳過，直接開始</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* 從 WhatsApp／簡訊返回後，確認開始 */}
      <Modal visible={showConfirmAfterWhatsApp} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>發送報平安後，確認開始</Text>
            <Text style={styles.safetyModalBody}>請在 WhatsApp（或簡訊）發送報平安訊息後返回本 App，再按下方按鈕開始深潛。</Text>
            <View style={styles.safetyButtonsRow}>
              <TouchableOpacity style={[styles.button, styles.buttonStart]} onPress={confirmStartAfterWhatsApp}>
                <Text style={styles.buttonText}>確認開始深潛</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={() => setShowConfirmAfterWhatsApp(false)}>
                <Text style={styles.buttonText}>取消</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* 盲測時間：你覺得過了多久？ */}
      <Modal visible={showTimeGuessModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>剛才這段體驗，你直覺覺得過了多久？</Text>
            <View style={styles.timeGuessRow}>
              {TIME_GUESS_OPTIONS.map((m) => (
                <TouchableOpacity key={m} style={styles.timeGuessBtn} onPress={() => { setFeltMinutes(m); setShowTimeGuessModal(false); setShowRevealModal(true); }}>
                  <Text style={styles.timeGuessBtnText}>{m} 分</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
      {/* 對比驚喜：偷走了 X 分鐘 */}
      <Modal visible={showRevealModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>✨ 心流時差</Text>
            {feltMinutes !== null && (
              <>
                <Text style={styles.revealText}>你覺得：{feltMinutes} 分鐘</Text>
                <Text style={styles.revealText}>實際：{actualMinutesForReveal} 分鐘</Text>
                <Text style={styles.revealMessage}>
                  {flowTimeFeedbackLoading
                    ? "正在根據你的心流時差生成回饋…"
                    : flowTimeFeedbackMessage
                      ? flowTimeFeedbackMessage
                      : actualMinutesForReveal > feltMinutes
                        ? `哇！剛才你進入了深層心流。你偷走了 ${actualMinutesForReveal - feltMinutes} 分鐘的焦慮，並把它轉化成了純粹的創造力。這就是你的「超能力狀態」。`
                        : actualMinutesForReveal < feltMinutes
                          ? "時間感很準！你專注在當下，心流讓這段時間過得充實。"
                          : "你與時間同步，心流讓這段體驗剛剛好。"}
                </Text>
                <TouchableOpacity style={[styles.button, styles.buttonStart]} onPress={() => { setShowRevealModal(false); setShowArtModal(true); }}>
                  <Text style={styles.buttonText}>看我的心流畫作</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
      {/* 獨一無二抽象畫 + 深潛心流訊息 */}
      <Modal visible={showArtModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.artModalCard}>
            <Text style={styles.artModalTitle}>屬於你這次心流的獨一無二</Text>
            <View style={styles.artWrap}>
              <FlowAbstractArt
                taskName={sessionEndTaskName}
                minutes={actualMinutesForReveal}
                difficulty={sessionEndDifficulty}
                sessionId={sessionEndId}
                width={Dimensions.get("window").width - 48}
                height={220}
              />
            </View>
            <TouchableOpacity
              style={styles.copyCraftBtn}
              onPress={() => Clipboard.setStringAsync(craftMessage).then(() => {})}
            >
              <Text style={styles.copyCraftBtnText}>📋 複製深潛心流訊息</Text>
            </TouchableOpacity>
            <Text style={styles.craftPreview} numberOfLines={2}>{craftMessage}</Text>
            <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={() => setShowArtModal(false)}>
              <Text style={styles.buttonText}>完成</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  outerWrap: { flex: 1, padding: 16 },
  flowModeContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  flowModeCenter: { alignItems: "center", justifyContent: "center" },
  flowModeLabel: { fontSize: 20, fontWeight: "700", color: "#1f2937" },
  flowModeTask: { fontSize: 14, color: "#6b7280", marginTop: 8 },
  whiteCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#d56c2f",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 3
  },
  scroll: { flex: 1 },
  container: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 12, color: "#111827" },
  // Flow theory
  flowTheoryBox: {
    backgroundColor: "#eff6ff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#bfdbfe"
  },
  flowTheoryTitle: { fontSize: 14, fontWeight: "700", color: "#1e40af", marginBottom: 6 },
  flowTheoryText: { fontSize: 13, color: "#374151", lineHeight: 20 },
  flowTheoryBold: { fontWeight: "700", color: "#1e40af" },
  flowTheoryLink: { fontSize: 11, color: "#2563eb", marginTop: 8, textDecorationLine: "underline" },
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
  taskRunning: { fontSize: 13, color: "#d56c2f", fontWeight: "600", marginBottom: 8, textAlign: "center" },
  // Difficulty (challenge-skill balance)
  difficultyRow: { marginBottom: 12 },
  difficultyLabel: { fontSize: 12, color: "#6b7280", marginBottom: 6 },
  difficultyOptions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  difficultyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "#d1d5db",
    backgroundColor: "#fff"
  },
  difficultyBtnActive: { borderColor: "#2563eb", backgroundColor: "#eff6ff" },
  difficultyBtnText: { fontSize: 13, color: "#6b7280", fontWeight: "600" },
  difficultyBtnTextActive: { color: "#2563eb" },
  difficultyHint: { fontSize: 11, color: "#2563eb", marginTop: 6 },
  // Duration
  durationRow: { flexDirection: "row", justifyContent: "center", marginBottom: 12, gap: 8 },
  durationBtn: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 999, borderWidth: 1.5, borderColor: "#d1d5db", backgroundColor: "#fff"
  },
  durationBtnActive: { borderColor: "#d56c2f", backgroundColor: "#fff7ed" },
  durationBtnDisabled: { opacity: 0.4 },
  durationText: { fontSize: 14, color: "#6b7280", fontWeight: "600" },
  durationTextActive: { color: "#d56c2f" },
  customDurationRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 12, gap: 8 },
  customDurationLabel: { fontSize: 14, color: "#6b7280", fontWeight: "600" },
  customDurationInput: {
    width: 72,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "#d1d5db",
    backgroundColor: "#fff",
    fontSize: 14,
    color: "#111827",
    textAlign: "center"
  },
  customDurationSuffix: { fontSize: 14, color: "#6b7280" },
  recommendText: { fontSize: 12, color: "#b45309", textAlign: "center", marginBottom: 8 },
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
  buttonStart: { backgroundColor: "#d56c2f" },
  buttonPause: { backgroundColor: "#f97316" },
  buttonSecondary: { backgroundColor: "#6b7280" },
  buttonExit: { backgroundColor: "#374151", minWidth: 140 },
  exitLongPressBg: { position: "absolute", left: 8, right: 8, bottom: 4, height: 4, backgroundColor: "rgba(255,255,255,0.3)", borderRadius: 2, overflow: "hidden" },
  exitLongPressFill: { height: "100%", backgroundColor: "#fff", borderRadius: 2 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  // Stats
  statsBox: {
    padding: 16, borderRadius: 16, backgroundColor: "#fff",
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, marginBottom: 12
  },
  statsHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  statsTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  xpText: { fontSize: 14, color: "#d56c2f", fontWeight: "600" },
  progressBar: { height: 10, borderRadius: 999, backgroundColor: "#e5e7eb", overflow: "hidden", marginBottom: 4 },
  progressFill: { height: "100%", backgroundColor: "#d56c2f", borderRadius: 999 },
  statsSubtext: { fontSize: 12, color: "#6b7280" },
  nextBadge: { marginTop: 8, fontSize: 13, color: "#b45309" },
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
  logMin: { fontSize: 13, color: "#6b7280", fontWeight: "600" },
  // Modals
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 24 },
  modalCard: { backgroundColor: "#fff", borderRadius: 20, padding: 24, width: "100%", maxWidth: 360 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#111827", marginBottom: 16, textAlign: "center" },
  timeGuessRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 10 },
  timeGuessBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, backgroundColor: "#eff6ff", borderWidth: 1.5, borderColor: "#bfdbfe" },
  timeGuessBtnText: { fontSize: 15, fontWeight: "600", color: "#2563eb" },
  revealText: { fontSize: 15, color: "#374151", marginBottom: 4 },
  revealMessage: { fontSize: 15, color: "#1e40af", fontWeight: "600", marginVertical: 16, lineHeight: 22 },
  artModalCard: { backgroundColor: "#fff", borderRadius: 20, padding: 24, width: "100%", maxWidth: 360, alignItems: "center" },
  artModalTitle: { fontSize: 18, fontWeight: "700", color: "#111827", marginBottom: 16 },
  artWrap: { marginBottom: 16, borderRadius: 20, overflow: "hidden" },
  copyCraftBtn: { paddingVertical: 12, paddingHorizontal: 20, backgroundColor: "#eff6ff", borderRadius: 12, marginBottom: 8 },
  copyCraftBtnText: { fontSize: 14, fontWeight: "600", color: "#2563eb" },
  craftPreview: { fontSize: 12, color: "#6b7280", marginBottom: 16, textAlign: "center" },
  safetyModalBody: { fontSize: 14, color: "#374151", marginBottom: 8, lineHeight: 20 },
  safetyPreview: { fontSize: 12, color: "#6b7280", marginBottom: 12, fontStyle: "italic" },
  safetyContactInput: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, marginBottom: 16, backgroundColor: "#fff" },
  safetyButtonsRow: { flexDirection: "column", gap: 10 }
});
