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
  Platform,
  ActivityIndicator
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { RootTabParamList } from "../navigation/types";
import { AppBackground } from "../components/AppBackground";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { awardXp } from "../utils/gamification";

const STORAGE_KEY = "@flow_timer_data";
const COACH_API_BASE = process.env.EXPO_PUBLIC_COACH_API_URL || "https://positive-edu-app.vercel.app";
const FLOW_REFERENCE =
  "Csikzentimihalyi, M. (1975). Beyond boredom and anxiety: Experiencing flow in work and play. San Francisco/Washington/London.";

const MIN_DURATION_MINUTES = 5;

const DURATIONS = [
  { label: "5 分", minutes: 5 },
  { label: "15 分", minutes: 15 },
  { label: "25 分", minutes: 25 },
  { label: "45 分", minutes: 45 },
  { label: "60 分", minutes: 60 }
];

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
const LONG_PRESS_EXIT_SEC = 5;

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
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const insets = useSafeAreaInsets();
  /** 底部略留空即可（Tab 內容區已在上方面板，毋須過大留白） */
  const scrollBottomPad = 12 + Math.min(insets.bottom, 20) + 20;
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
  const [showFlowIntroModal, setShowFlowIntroModal] = useState(false);
  const [actualMinutesForReveal, setActualMinutesForReveal] = useState(0);
  const [sessionEndTaskName, setSessionEndTaskName] = useState("");
  /** 心流時差藍色一句：一律 AI 生成 */
  const [flowRevealAiMessage, setFlowRevealAiMessage] = useState<string | null>(null);
  const [flowRevealAiLoading, setFlowRevealAiLoading] = useState(false);
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
      JSON.stringify({ sessionLog: sessionLog.slice(0, 10) })
    ).catch(() => {});
  }, [sessionLog]);

  const progress = 1 - remaining / totalSeconds;
  const displayProgress = running ? Math.pow(progress, 0.85) : progress;
  const strokeDashoffset = CIRCUMFERENCE * (1 - displayProgress);
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
          const task = taskName.trim() || "自由學習";
          setCelebrateTask(task);
          setSessionLog((log) => [{ task, minutes }, ...log].slice(0, 10));
          setActualMinutesForReveal(minutes);
          setSessionEndTaskName(task);
          setShowTimeGuessModal(true);
          setFeltMinutes(null);
          // 只有完整完成（非提早結束）才計入共用 Gamification XP
          awardXp(20).catch(() => {});
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

  useEffect(() => {
    if (!showRevealModal || feltMinutes === null) return;
    setFlowRevealAiLoading(true);
    setFlowRevealAiMessage(null);
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
      .then((j) => {
        if (j?.message && typeof j.message === "string") setFlowRevealAiMessage(j.message.trim());
      })
      .catch(() => {})
      .finally(() => setFlowRevealAiLoading(false));
  }, [showRevealModal, feltMinutes, actualMinutesForReveal, sessionEndTaskName]);

  const buildFlowCoachPrefill = () => {
    const task = sessionEndTaskName.trim() || "自由學習";
    const felt = feltMinutes ?? 0;
    return `我啱啱完成離線深潛：任務係「${task}」，實際專注咗 ${actualMinutesForReveal} 分鐘，但我覺得只係過咗 ${felt} 分鐘。想同你傾下呢段體驗同心得。`;
  };

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

  const ringColor = running ? "#d56c2f" : remaining === totalSeconds ? "#e5e7eb" : "#f97316";
  const durationCounts = sessionLog.reduce((acc, s) => {
    acc[s.minutes] = (acc[s.minutes] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);
  const recommendedMinutes =
    sessionLog.length >= 2 ? Number(Object.entries(durationCounts).sort((a, b) => b[1] - a[1])[0]?.[0]) : null;
  const recommendedIdx = recommendedMinutes != null ? DURATIONS.findIndex((d) => d.minutes === recommendedMinutes) : -1;

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
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.container, { paddingBottom: scrollBottomPad }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator
      nestedScrollEnabled
    >
      <Text style={styles.title}>離線深潛</Text>
      <View style={styles.expHintBox}>
        <Text style={styles.expHintTitle}>EXP 獎勵</Text>
        <Text style={styles.expHintItem}>🌊 完整完成離線深潛（無提早結束） +20</Text>
      </View>
      <View style={styles.resonanceBlock}>
        <Text style={styles.resonanceText}>
          測驗、功課、補習、比較……成日個腦停唔到？{"\n"}
          呢度唔係叫你「努力啲」，而係俾你一段時間，進入心流，專注做好一件事，慢慢搵返你自己嘅節奏。
        </Text>
      </View>

      <TouchableOpacity style={styles.flowTheoryBox} onPress={() => setShowFlowIntroModal(true)}>
        <Text style={styles.flowTheoryTitle}>什麼是心流？（按此查看）</Text>
      </TouchableOpacity>

      <View style={styles.moduleTaskBlock}>
        <Text style={styles.moduleTaskTitle}>你都做得到！</Text>
        <Text style={styles.moduleTaskText}>
          今次目標係幫你進入心流狀態，專注完成一件事。{"\n\n"}
          1) 揀一個任務，再調到「有挑戰但做得到」：太易會悶，太難會焦慮{"\n"}
          2) 設一個清晰小目標：例如「做完第 1–3 題」或「背完 10 個詞」{"\n"}
          3) 設定時間，手動關閉通知／Wi‑Fi，畀自己真係「離線」只做一件事{"\n"}
          4) 用即時回饋推住自己：做卷就對答案／計分；溫書就每 5–10 分鐘自測一次{"\n"}
          5) 完成後做個小回顧：你覺得過咗幾耐？時間感會話你知你有幾沉浸
        </Text>
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

      {/* 時長選擇（與任務區隔開；45／60 分同一行） */}
      <View style={styles.durationSection}>
        <Text style={styles.durationSectionLabel}>選擇時長</Text>
        <View style={styles.durationRow}>
          {DURATIONS.slice(0, 3).map((d, i) => (
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
        <View style={styles.durationRowLast}>
          {DURATIONS.slice(3, 5).map((d, j) => {
            const i = j + 3;
            return (
              <TouchableOpacity
                key={d.minutes}
                style={[styles.durationBtn, selectedIdx === i && styles.durationBtnActive, running && styles.durationBtnDisabled]}
                onPress={() => handleSelectDuration(i)}
                disabled={running}
              >
                <Text style={[styles.durationText, selectedIdx === i && styles.durationTextActive]}>{d.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      <View style={styles.customDurationRow}>
        <Text style={styles.customDurationLabel}>自訂：</Text>
        <TextInput
          style={[styles.customDurationInput, selectedIdx === -1 && styles.durationBtnActive, running && styles.durationBtnDisabled]}
          value={customMinutesInput}
          onChangeText={handleCustomMinutesChange}
          onFocus={() => !running && setSelectedIdx(-1)}
          placeholder="≥5"
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
      {/* 心流時差 → 可轉去正向教練繼續傾 */}
      <Modal visible={showRevealModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>✨ 心流時差</Text>
            {feltMinutes !== null && (
              <>
                <Text style={styles.revealText}>你覺得：{feltMinutes} 分鐘</Text>
                <Text style={styles.revealText}>實際：{actualMinutesForReveal} 分鐘</Text>
                <View style={styles.revealHintWrap}>
                  {flowRevealAiLoading ? (
                    <View style={styles.revealAiLoadingRow}>
                      <ActivityIndicator color="#2563eb" size="small" />
                      <Text style={styles.revealHintMuted}>正在為你生成回饋…</Text>
                    </View>
                  ) : (
                    <Text style={styles.revealHint}>
                      {flowRevealAiMessage ||
                        (actualMinutesForReveal > feltMinutes
                          ? "專注時時間好似過得特別快，好常見㗎。"
                          : actualMinutesForReveal < feltMinutes
                            ? "你覺得過咗好耐，代表你有投入喺件事上面。"
                            : "節奏啱啱好，呢段深潛好穩陣。")}
                    </Text>
                  )}
                </View>
                <Text style={styles.revealCoachHint}>
                  想同 AI 教練傾多兩句？會幫你預填今次任務、時長同時間感，你按送出就可以開傾。
                </Text>
                <TouchableOpacity
                  style={[styles.button, styles.buttonStart, { marginBottom: 10 }]}
                  onPress={() => {
                    setShowRevealModal(false);
                    navigation.navigate("正向教練", { coachPrefillFromFlow: buildFlowCoachPrefill() });
                  }}
                >
                  <Text style={styles.buttonText}>同教練講剛才嘅深潛</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={() => setShowRevealModal(false)}>
                  <Text style={styles.buttonText}>完成</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
      <Modal visible={showFlowIntroModal} transparent animationType="fade" onRequestClose={() => setShowFlowIntroModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>什麼是心流？</Text>
            <Text style={styles.flowTheoryText}>
              心流（flow）不是單純「專注」，而是全神貫注、行動與意識合一的最佳體驗狀態。心理學家 Csíkszentmihályi 指出：當<Text style={styles.flowTheoryBold}> 挑戰與技能平衡 </Text>、有<Text style={styles.flowTheoryBold}> 清晰目標 </Text>與<Text style={styles.flowTheoryBold}> 即時回饋 </Text>時，較容易進入心流——沉浸、忘我、內在獎勵。計時只是輔助；先選一項對你有適當難度的任務，再開始。
            </Text>
            <Text style={styles.flowTheoryLink}>出處：{FLOW_REFERENCE}</Text>
            <TouchableOpacity style={[styles.button, styles.buttonSecondary, { marginTop: 14 }]} onPress={() => setShowFlowIntroModal(false)}>
              <Text style={styles.buttonText}>關閉</Text>
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
  container: { padding: 16 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 12, color: "#111827" },
  expHintBox: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 12,
    padding: 10,
    marginBottom: 10
  },
  expHintTitle: { fontSize: 12, fontWeight: "800", color: "#1e40af", marginBottom: 4 },
  expHintItem: { fontSize: 12, color: "#1e3a8a", lineHeight: 18 },
  resonanceBlock: {
    backgroundColor: "#fff7ed",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#d56c2f"
  },
  resonanceText: { fontSize: 14, color: "#78350f", lineHeight: 22 },
  moduleTaskBlock: { marginBottom: 14 },
  moduleTaskTitle: { fontSize: 18, fontWeight: "700", color: "#111827", marginBottom: 6 },
  moduleTaskText: { fontSize: 13, color: "#334155", lineHeight: 20 },
  // Flow theory
  flowTheoryBox: {
    backgroundColor: "#eff6ff",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#bfdbfe"
  },
  flowTheoryTitle: { fontSize: 13, fontWeight: "700", color: "#1d4ed8", textAlign: "center" },
  flowTheoryText: { fontSize: 13, color: "#374151", lineHeight: 20 },
  flowTheoryBold: { fontWeight: "700", color: "#1e40af" },
  flowTheoryLink: { fontSize: 11, color: "#64748b", marginTop: 8, fontStyle: "italic", lineHeight: 16 },
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
  durationSection: {
    marginTop: 22,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb"
  },
  durationSectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 12,
    textAlign: "center"
  },
  durationRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
    gap: 8
  },
  durationRowLast: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    gap: 8
  },
  durationBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "#d1d5db",
    backgroundColor: "#fff"
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
  revealHintWrap: { minHeight: 48, marginTop: 10, marginBottom: 12, justifyContent: "center" },
  revealHint: { fontSize: 14, color: "#1e40af", fontWeight: "600", lineHeight: 21 },
  revealHintMuted: { fontSize: 14, color: "#6b7280", marginLeft: 8 },
  revealAiLoadingRow: { flexDirection: "row", alignItems: "center" },
  revealCoachHint: { fontSize: 13, color: "#6b7280", lineHeight: 20, marginBottom: 16 },
  safetyModalBody: { fontSize: 14, color: "#374151", marginBottom: 8, lineHeight: 20 },
  safetyPreview: { fontSize: 12, color: "#6b7280", marginBottom: 12, fontStyle: "italic" },
  safetyContactInput: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, marginBottom: 16, backgroundColor: "#fff" },
  safetyButtonsRow: { flexDirection: "column", gap: 10 }
});
