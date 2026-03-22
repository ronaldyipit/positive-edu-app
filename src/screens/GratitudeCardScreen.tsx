import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  Image,
  Animated,
  Linking,
  Keyboard,
  InteractionManager
} from "react-native";
import { copyAsync, cacheDirectory } from "expo-file-system/legacy";
import ViewShot from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import * as IntentLauncher from "expo-intent-launcher";
import { Audio } from "expo-av";
import { AppBackground } from "../components/AppBackground";
import { DefinitionInfoModal } from "../components/DefinitionInfoModal";
import * as MediaLibrary from "expo-media-library";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { awardXp } from "../utils/gamification";

const COACH_API_BASE = process.env.EXPO_PUBLIC_COACH_API_URL || "https://positive-edu-app.vercel.app";
const TASKS_PER_PAGE = 5;
/** 「任務完成」覆蓋層與火焰音效時長（毫秒） */
const COMPLETE_RELAY_SOUND_MS = 3000;

/** 感恩之操作型定義概括自 Emmons 對感恩情緒與傾向之論述（正向心理學常用架構） */
const GRATITUDE_CITATION =
  "Emmons, R. A. (2007). Thanks!: How the new science of gratitude can make you happier. Houghton Mifflin.";

const MODES = [
  { id: "message", label: "1) 寫感謝訊息" },
  { id: "repay", label: "2) 默默報答同一個人" },
  { id: "forward", label: "3) 把善意傳揚開去" }
] as const;
type TorchMode = (typeof MODES)[number]["id"];
type TorchTask = {
  id: string;
  mode: TorchMode;
  title: string;
  detail: string;
  recipient?: string;
  keyword?: string;
  repayAction?: string;
  repayWhen?: string;
  forwardTarget?: string;
  forwardAction?: string;
  messageText?: string;
  createdAt: number;
  completed: boolean;
  completedAt?: number;
  remindedAt?: number;
};
const TORCH_TASKS_KEY = "@torch_warm_tasks_v1";

const THEMES = [
  { name: "暖陽", bg: "#fefce8", border: "#fde047", title: "#854d0e", body: "#78350f", accent: "#fbbf24", emoji: "🌻" },
  { name: "薰衣草", bg: "#faf5ff", border: "#c084fc", title: "#6b21a8", body: "#581c87", accent: "#a855f7", emoji: "💜" },
  { name: "薄荷", bg: "#f0fdf4", border: "#86efac", title: "#166534", body: "#14532d", accent: "#22c55e", emoji: "🍃" },
  { name: "天空", bg: "#eff6ff", border: "#93c5fd", title: "#1e40af", body: "#1e3a8a", accent: "#3b82f6", emoji: "🌸" },
  { name: "玫瑰", bg: "#fff1f2", border: "#fda4af", title: "#9f1239", body: "#881337", accent: "#f43f5e", emoji: "🌹" }
];

const RANDOM_PROMPTS = [
  "今天邊個幫你慳咗 10 分鐘？",
  "最近邊個喺你低潮時撐咗你一下？",
  "有冇一件小事令你覺得世界其實幾暖？",
  "如果要回應一次善意，你會做乜？",
  "若果係陌生人幫咗你，你會點傳落去？"
];

const CARD_TEMPLATES = [
  (r: string, k: string) =>
    `親愛的 ${r}，\n\n謝謝你總是讓我感受到${k}。\n有你在，日子輕鬆很多，真的很感謝你。\n\n感恩你的人 🌟`,
  (r: string, k: string) =>
    `${r}，\n\n想讓你知道，你給我的${k}對我來說非常重要。\n每次想到你，心裡都暖暖的。謝謝你 💛`,
  (r: string, k: string) =>
    `致 ${r}，\n\n有時候我沒說出口，但我一直都很感謝你的${k}。\n你讓我的生命更美好。謝謝你 🌸`
];

export default function GratitudeCardScreen() {
  const [mode, setMode] = useState<TorchMode>("message");
  const [recipient, setRecipient] = useState("");
  const [keyword, setKeyword] = useState("");
  const [repayAction, setRepayAction] = useState("");
  const [repayWhen, setRepayWhen] = useState("");
  const [forwardTarget, setForwardTarget] = useState("");
  const [forwardAction, setForwardAction] = useState("");
  const [generatedText, setGeneratedText] = useState<string | null>(null);
  const [themeIdx, setThemeIdx] = useState(0);
  const [templateIdx, setTemplateIdx] = useState(0);
  const [prompt, setPrompt] = useState(RANDOM_PROMPTS[0]);
  const [saving, setSaving] = useState(false);
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiImageUrl, setAiImageUrl] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);
  const [torchTasks, setTorchTasks] = useState<TorchTask[]>([]);
  const [taskPage, setTaskPage] = useState(1);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  const viewShotRef = useRef<ViewShot>(null);
  const leftWobble = useRef(new Animated.Value(0)).current;
  const flameTravel = useRef(new Animated.Value(0)).current;
  const rightGlow = useRef(new Animated.Value(0)).current;
  const transferringRef = useRef(false);
  const [showCompleteRelay, setShowCompleteRelay] = useState(false);
  const [showGratitudeIntroModal, setShowGratitudeIntroModal] = useState(false);
  const completeTravel = useRef(new Animated.Value(0)).current;
  const completeRightGlow = useRef(new Animated.Value(0)).current;
  const completeOverlayOpacity = useRef(new Animated.Value(0)).current;
  const completingRef = useRef(false);
  const completeFireSoundRef = useRef<Audio.Sound | null>(null);
  const fireSoundStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const theme = THEMES[themeIdx];

  useEffect(() => {
    let mounted = true;
    Audio.Sound.createAsync(require("../../assets/sound/fire.mp3"))
      .then(({ sound }) => {
        if (mounted) completeFireSoundRef.current = sound;
      })
      .catch(() => {});
    return () => {
      mounted = false;
      if (fireSoundStopTimerRef.current) {
        clearTimeout(fireSoundStopTimerRef.current);
        fireSoundStopTimerRef.current = null;
      }
      completeFireSoundRef.current?.unloadAsync();
    };
  }, []);

  const playCompleteFireSound = async () => {
    if (fireSoundStopTimerRef.current) {
      clearTimeout(fireSoundStopTimerRef.current);
      fireSoundStopTimerRef.current = null;
    }
    try {
      const s = completeFireSoundRef.current;
      if (!s) return;
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      await s.stopAsync().catch(() => {});
      await s.setPositionAsync(0);
      await s.playAsync();
      fireSoundStopTimerRef.current = setTimeout(() => {
        fireSoundStopTimerRef.current = null;
        s.stopAsync()
          .then(() => s.setPositionAsync(0))
          .catch(() => {});
      }, COMPLETE_RELAY_SOUND_MS);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(leftWobble, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(leftWobble, { toValue: -1, duration: 600, useNativeDriver: true }),
        Animated.timing(leftWobble, { toValue: 0, duration: 600, useNativeDriver: true })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [leftWobble]);

  useEffect(() => {
    AsyncStorage.getItem(TORCH_TASKS_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setTorchTasks(parsed);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(TORCH_TASKS_KEY, JSON.stringify(torchTasks)).catch(() => {});
  }, [torchTasks]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(torchTasks.length / TASKS_PER_PAGE));
    setTaskPage((prev) => Math.min(prev, totalPages));
  }, [torchTasks.length]);

  useEffect(() => {
    if (torchTasks.length === 0) return;
    const now = Date.now();
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    const dueIds: string[] = [];
    let dueCount = 0;
    torchTasks.forEach((t) => {
      if (!t.completed && !t.remindedAt && now - t.createdAt >= oneWeekMs) {
        dueIds.push(t.id);
        dueCount += 1;
      }
    });
    if (dueCount === 0) return;
    setTorchTasks((prev) =>
      prev.map((t) => (dueIds.includes(t.id) ? { ...t, remindedAt: now } : t))
    );
    Alert.alert("火炬提醒", `你有 ${dueCount} 項火炬任務已超過一星期，記得去「火炬行動簿」確認是否已完成。`);
  }, [torchTasks]);

  const addTorchTask = (task: Omit<TorchTask, "id" | "createdAt">) => {
    const next: TorchTask = {
      ...task,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now()
    };
    setTorchTasks((prev) => [next, ...prev]);
  };

  const markTaskCompleted = (id: string) => {
    let awarded: TorchTask | null = null;
    setTorchTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id || t.completed) return t;
        awarded = t;
        return { ...t, completed: true, completedAt: Date.now() };
      })
    );
    if (awarded?.mode === "repay") {
      awardXp(15).catch(() => {});
    } else if (awarded?.mode === "forward") {
      awardXp(30).catch(() => {});
    }
    triggerCompleteRelay();
  };

  const startEditTask = (task: TorchTask) => {
    if (task.completed) return;
    setMode(task.mode);
    setRecipient(task.recipient ?? "");
    setKeyword(task.keyword ?? "");
    setRepayAction(task.repayAction ?? "");
    setRepayWhen(task.repayWhen ?? "");
    setForwardTarget(task.forwardTarget ?? "");
    setForwardAction(task.forwardAction ?? "");
    if (task.mode === "message") setGeneratedText(task.messageText ?? null);
    setEditingTaskId(task.id);
  };

  const cancelEditTask = () => {
    setEditingTaskId(null);
  };

  const saveMessageTask = () => {
    const payload = {
      mode: "message" as const,
      title: `感謝訊息：${recipient.trim() || "未命名對象"}`,
      detail: (generatedText?.trim() || `你感謝了對方：${keyword.trim()}`).slice(0, 120),
      recipient: recipient.trim(),
      keyword: keyword.trim(),
      messageText: generatedText?.trim() || CARD_TEMPLATES[templateIdx](recipient.trim(), keyword.trim()),
      completed: false
    };
    if (editingTaskId) {
      setTorchTasks((prev) => prev.map((t) => (t.id === editingTaskId && !t.completed ? { ...t, ...payload } : t)));
      Alert.alert("已更新", "感謝訊息任務已更新。");
      return;
    }
    addTorchTask(payload);
    Alert.alert("已加入火炬行動簿", "感謝訊息任務已新增，你可稍後再發送。");
  };

  const regenerateMessageTask = (task: TorchTask) => {
    const r = task.recipient?.trim() || "";
    const k = task.keyword?.trim() || "";
    if (!r || !k) {
      Alert.alert("資料不足", "此任務缺少對象或關鍵字，請先按「編輯」補齊。");
      return;
    }
    const text = CARD_TEMPLATES[templateIdx](r, k);
    setTorchTasks((prev) =>
      prev.map((t) =>
        t.id === task.id && !t.completed
          ? { ...t, messageText: text, detail: text.slice(0, 120) }
          : t
      )
    );
    if (editingTaskId === task.id) setGeneratedText(text);
    Alert.alert("已更新內文", "已為此任務重新生成訊息內容。");
  };

  const sendMessageTask = async (task: TorchTask) => {
    const r = task.recipient?.trim() || "";
    const k = task.keyword?.trim() || "";
    const text = task.messageText?.trim() || (r && k ? CARD_TEMPLATES[templateIdx](r, k) : "");
    if (!text) {
      Alert.alert("未有可發送內容", "請先按「編輯」或「生成內文」。");
      return;
    }
    const encoded = encodeURIComponent(text);
    const urls = [`whatsapp://send?text=${encoded}`, `https://wa.me/?text=${encoded}`];
    let opened = false;
    for (const url of urls) {
      try {
        const can = await Linking.canOpenURL(url);
        if (can) {
          await Linking.openURL(url);
          opened = true;
          break;
        }
      } catch {}
    }
    if (!opened) {
      Alert.alert("未能開啟 WhatsApp", "請先安裝 WhatsApp，或稍後再試。");
      return;
    }
    setTorchTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: true, completedAt: Date.now() } : t)));
    awardXp(20).catch(() => {});
    triggerCompleteRelay();
  };

  const triggerTorchRelay = () => {
    if (transferringRef.current) return;
    transferringRef.current = true;
    flameTravel.setValue(0);
    rightGlow.setValue(0);
    Animated.sequence([
      Animated.timing(flameTravel, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(rightGlow, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(380),
      Animated.timing(rightGlow, { toValue: 0, duration: 450, useNativeDriver: true })
    ]).start(() => {
      flameTravel.setValue(0);
      transferringRef.current = false;
    });
  };

  const triggerCompleteRelay = () => {
    if (completingRef.current) return;
    completingRef.current = true;
    setShowCompleteRelay(true);
    void playCompleteFireSound();
    completeTravel.setValue(0);
    completeRightGlow.setValue(0);
    completeOverlayOpacity.setValue(0);
    // 覆蓋層總時長 ≈ COMPLETE_RELAY_SOUND_MS（160 + 850 + delay + 250）
    const postFlameDelay = Math.max(0, COMPLETE_RELAY_SOUND_MS - 160 - 850 - 250);
    Animated.sequence([
      Animated.timing(completeOverlayOpacity, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(completeTravel, { toValue: 1, duration: 850, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(550),
          Animated.timing(completeRightGlow, { toValue: 1, duration: 180, useNativeDriver: true })
        ])
      ]),
      Animated.delay(postFlameDelay),
      Animated.timing(completeOverlayOpacity, { toValue: 0, duration: 250, useNativeDriver: true })
    ]).start(() => {
      completingRef.current = false;
      setShowCompleteRelay(false);
      completeTravel.setValue(0);
      completeRightGlow.setValue(0);
    });
  };

  const requiredValid = (() => {
    if (mode === "message") return !!recipient.trim() && !!keyword.trim();
    if (mode === "repay") return !!recipient.trim() && !!keyword.trim() && !!repayAction.trim();
    return !!keyword.trim() && !!forwardAction.trim();
  })();
  const totalTaskPages = Math.max(1, Math.ceil(torchTasks.length / TASKS_PER_PAGE));
  const pageStart = (taskPage - 1) * TASKS_PER_PAGE;
  const pagedTorchTasks = torchTasks.slice(pageStart, pageStart + TASKS_PER_PAGE);

  useEffect(() => {
    // 只有「寫感謝訊息」模式需要卡片內容
    if (mode !== "message") {
      setGeneratedText(null);
      setAiImageUrl(null);
    }
  }, [mode]);

  const handleGenerate = () => {
    if (!requiredValid) return;
    if (mode === "message") {
      setGeneratedText(CARD_TEMPLATES[templateIdx](recipient.trim(), keyword.trim()));
      triggerTorchRelay();
      return;
    }
    if (mode === "repay") {
      const repayPayload = {
        mode: "repay" as const,
        title: `默默報答：${recipient.trim()}`,
        detail: `曾幫你：${keyword.trim()}；你會做：${repayAction.trim()}；時間：${repayWhen.trim() || "本週內"}`,
        recipient: recipient.trim(),
        keyword: keyword.trim(),
        repayAction: repayAction.trim(),
        repayWhen: repayWhen.trim(),
        completed: false
      };
      if (editingTaskId) {
        setTorchTasks((prev) =>
          prev.map((t) => (t.id === editingTaskId && !t.completed ? { ...t, ...repayPayload } : t))
        );
        setEditingTaskId(null);
        Alert.alert("已更新", "火炬任務內容已更新。");
      } else {
        addTorchTask(repayPayload);
        Alert.alert("已加入火炬行動簿", "這項任務已記錄。完成後可在下方手動標記「已完成」。");
      }
      triggerTorchRelay();
      return;
    }
    const forwardPayload = {
      mode: "forward" as const,
      title: `傳揚開去：${forwardTarget.trim() || "下一位有需要的人"}`,
      detail: `收到善意：${keyword.trim()}；行動：${forwardAction.trim()}`,
      keyword: keyword.trim(),
      forwardTarget: forwardTarget.trim(),
      forwardAction: forwardAction.trim(),
      completed: false
    };
    if (editingTaskId) {
      setTorchTasks((prev) =>
        prev.map((t) => (t.id === editingTaskId && !t.completed ? { ...t, ...forwardPayload } : t))
      );
      setEditingTaskId(null);
      Alert.alert("已更新", "火炬任務內容已更新。");
    } else {
      addTorchTask(forwardPayload);
      Alert.alert("已加入火炬行動簿", "這項任務已記錄。完成後可在下方手動標記「已完成」。");
    }
    triggerTorchRelay();
  };

  const handleGenerateAi = async () => {
    if (mode !== "message" || !recipient.trim() || !keyword.trim()) return;
    setLoadingAi(true);
    try {
      const res = await fetch(`${COACH_API_BASE}/api/gratitude-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: recipient.trim(), keyword: keyword.trim() })
      });
      const json = res.ok ? await res.json().catch(() => ({})) : {};
      if (json?.text) {
        setGeneratedText(json.text);
        triggerTorchRelay();
      } else {
        // API 未實作或失敗時改用本地模板，避免 404 且按鈕仍有作用
        setGeneratedText(CARD_TEMPLATES[templateIdx](recipient.trim(), keyword.trim()));
        triggerTorchRelay();
      }
    } catch {
      setGeneratedText(CARD_TEMPLATES[templateIdx](recipient.trim(), keyword.trim()));
      triggerTorchRelay();
    }
    setLoadingAi(false);
  };

  const handleGenerateAiImage = async () => {
    if (!recipient.trim() || !keyword.trim()) return;
    setLoadingImage(true);
    setAiImageUrl(null);
    try {
      const res = await fetch(`${COACH_API_BASE}/api/gratitude-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: recipient.trim(), keyword: keyword.trim() })
      });
      const json = res.ok ? await res.json().catch(() => ({})) : {};
      if (json?.imageUrl) setAiImageUrl(json.imageUrl);
    } catch {
      // 插圖 API 未實作或失敗時不顯示插圖，卡片仍可正常使用
    }
    setLoadingImage(false);
  };

  const handleRandomPrompt = () => {
    setPrompt(RANDOM_PROMPTS[Math.floor(Math.random() * RANDOM_PROMPTS.length)]);
  };

  const handleSwitchTemplate = () => {
    const next = (templateIdx + 1) % CARD_TEMPLATES.length;
    setTemplateIdx(next);
    if (recipient.trim() && keyword.trim()) {
      setGeneratedText(CARD_TEMPLATES[next](recipient.trim(), keyword.trim()));
    }
  };

  const captureCard = async (): Promise<string | null> => {
    if (!viewShotRef.current?.capture) return null;
    try {
      const uri = await viewShotRef.current.capture();
      return uri;
    } catch {
      return null;
    }
  };

  /** MediaLibrary 需要帶副檔名的本機路徑（部分 Android 截圖檔名無 .png） */
  const ensurePngFileUri = async (uri: string): Promise<string> => {
    const pathPart = uri.split("?")[0] ?? uri;
    if (/\.png$/i.test(pathPart)) return uri;
    if (!cacheDirectory) return uri;
    const dest = `${cacheDirectory}torch-gratitude-${Date.now()}.png`;
    await copyAsync({ from: uri, to: dest });
    return dest;
  };

  const captureCardForExport = async (): Promise<string | null> => {
    Keyboard.dismiss();
    await new Promise<void>((resolve) => {
      InteractionManager.runAfterInteractions(() => resolve());
    });
    await new Promise((r) => setTimeout(r, Platform.OS === "android" ? 150 : 80));
    const raw = await captureCard();
    if (!raw) return null;
    try {
      return await ensurePngFileUri(raw);
    } catch {
      return raw;
    }
  };

  const requestMediaSavePermission = async (): Promise<boolean> => {
    let { status } = await MediaLibrary.requestPermissionsAsync(true);
    if (status !== "granted") {
      ({ status } = await MediaLibrary.requestPermissionsAsync(false));
    }
    return status === "granted";
  };

  const handleSaveToGallery = async () => {
    if (Platform.OS === "web") {
      Alert.alert("提示", "網頁版請使用「分享」功能或長按圖片儲存。");
      return;
    }
    setSaving(true);
    try {
      const ok = await requestMediaSavePermission();
      if (!ok) {
        Alert.alert("需要權限", "請允許存取相簿以儲存卡片圖片。");
        return;
      }
      const uri = await captureCardForExport();
      if (!uri) throw new Error("截圖失敗");
      // 先用 saveToLibrary；若裝置不支援則 fallback 到 createAsset
      try {
        await MediaLibrary.saveToLibraryAsync(uri);
      } catch {
        const asset = await MediaLibrary.createAssetAsync(uri);
        await MediaLibrary.createAlbumAsync("正發光", asset, false).catch(() => {});
      }
      Alert.alert("已儲存 📸", "火炬傳暖卡已儲存到你的相簿。");
    } catch (e) {
      Alert.alert("儲存失敗", "未能儲存到相簿，請檢查相簿權限後再試。");
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    setSaving(true);
    try {
      const uri = await captureCardForExport();
      if (!uri) throw new Error("截圖失敗");
      if (Platform.OS === "web") {
        Alert.alert("提示", "網頁版暫不支援分享，請長按圖片儲存。");
        return;
      }
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert("不支援", "此裝置不支援分享功能。");
        return;
      }
      if (Platform.OS === "android") {
        try {
          await IntentLauncher.startActivityAsync("android.intent.action.SEND", {
            type: "image/png",
            data: uri,
            packageName: "com.whatsapp",
            extra: { "android.intent.extra.STREAM": uri }
          });
        } catch {
          await Sharing.shareAsync(uri, {
            mimeType: "image/png",
            dialogTitle: "分享感恩卡到 WhatsApp（選擇聯絡人）"
          });
        }
      } else {
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: "分享感恩卡到 WhatsApp（選擇聯絡人）"
        });
      }
      if (mode === "message") {
        addTorchTask({
          mode: "message",
          title: `感謝訊息：${recipient.trim() || "未命名對象"}`,
          detail: generatedText?.slice(0, 120) || `你感謝了對方：${keyword.trim()}`,
          completed: true,
          completedAt: Date.now()
        });
        awardXp(20).catch(() => {});
        triggerCompleteRelay();
      }
    } catch {
      Alert.alert("分享失敗", "請再試一次。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppBackground>
    <View style={styles.outerWrap}>
      <View style={styles.whiteCard}>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.title}>火炬傳暖</Text>
      <View style={styles.expHintBox}>
        <Text style={styles.expHintTitle}>EXP 獎勵</Text>
        <Text style={styles.expHintItem}>✉️ 寫感謝訊息（成功傳送） +20</Text>
        <Text style={styles.expHintItem}>🤝 默默報答同一個人（標記完成） +15</Text>
        <Text style={styles.expHintItem}>🔥 把善意傳揚開去（標記完成） +30</Text>
      </View>
      <View style={styles.resonanceBlock}>
        <Text style={styles.resonanceText}>
          有時唔係冇人幫你，只係忙到連一句多謝都未講出口。{"\n"}
          感恩唔係要你煽情，而係幫你記得：你唔係一個人，身邊一直有人同善意撐住你。
        </Text>
      </View>
      <TouchableOpacity style={styles.infoTriggerBtn} onPress={() => setShowGratitudeIntroModal(true)}>
        <Text style={styles.infoTriggerText}>甚麼是感恩？（按此查看）</Text>
      </TouchableOpacity>
      <View style={styles.moduleTaskBlock}>
        <Text style={styles.moduleTaskTitle}>呢個 Module 做咩？</Text>
        <Text style={styles.moduleTaskText}>
          你可以用三種方式回應善意：{"\n"}
          1) 寫感謝訊息，直接向對方表達謝意{"\n"}
          2) 默默報答同一個人，用行動回應佢對你嘅好{"\n"}
          3) 把善意傳揚開去，將呢份好意傳去下一個人{"\n\n"}
          完成後會記錄喺「火炬行動簿」，方便你慢慢實踐。
        </Text>
      </View>
      <View style={styles.torchRelayBox}>
        <Animated.Text
          style={[
            styles.torchIcon,
            { transform: [{ rotate: leftWobble.interpolate({ inputRange: [-1, 1], outputRange: ["-8deg", "8deg"] }) }] }
          ]}
        >
          🔥
        </Animated.Text>
        <View style={styles.torchLane}>
          <Animated.View
            style={[
              styles.travelFlame,
              {
                opacity: flameTravel.interpolate({ inputRange: [0, 0.05, 0.95, 1], outputRange: [0, 1, 1, 0] }),
                transform: [{ translateX: flameTravel.interpolate({ inputRange: [0, 1], outputRange: [0, 118] }) }]
              }
            ]}
          >
            <Text style={styles.travelFlameText}>✨</Text>
          </Animated.View>
        </View>
        <Animated.View style={{ opacity: rightGlow.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] }) }}>
          <Text style={styles.torchIcon}>🔥</Text>
        </Animated.View>
      </View>

      <View style={styles.modeRow}>
        {MODES.map((m) => {
          const active = mode === m.id;
          return (
            <TouchableOpacity
              key={m.id}
              style={[styles.modeBtn, active && styles.modeBtnActive]}
              onPress={() => {
                setMode(m.id);
                setEditingTaskId(null);
              }}
            >
              <Text style={[styles.modeBtnText, active && styles.modeBtnTextActive]}>{m.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {editingTaskId && mode !== "message" ? (
        <View style={styles.editingBanner}>
          <Text style={styles.editingBannerText}>你正在編輯火炬任務</Text>
          <TouchableOpacity onPress={cancelEditTask}>
            <Text style={styles.editingCancelText}>取消編輯</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* 靈感提示 */}
      <TouchableOpacity style={styles.promptBox} onPress={handleRandomPrompt}>
        <Text style={styles.promptLabel}>💡 靈感提示（點擊換一個）</Text>
        <Text style={styles.promptText}>{prompt}</Text>
      </TouchableOpacity>

      {mode !== "forward" && (
        <TextInput
          style={styles.input}
          placeholder={mode === "message" ? "送給誰？（例如：媽媽、同學 Kris）" : "你想默默回應邊個？"}
          placeholderTextColor="#9ca3af"
          value={recipient}
          onChangeText={setRecipient}
        />
      )}
      <TextInput
        style={styles.input}
        placeholder={
          mode === "message"
            ? "他／她做咗乜令你想答謝？"
            : mode === "repay"
              ? "對方曾經點樣幫過你？"
              : "你收到過一件咩善意？（例如：陌生人幫你扶門）"
        }
        placeholderTextColor="#9ca3af"
        value={keyword}
        onChangeText={setKeyword}
      />
      {mode === "repay" && (
        <>
          <TextInput
            style={styles.input}
            placeholder="你打算點樣默默回應？（例如：下次主動幫佢溫書）"
            placeholderTextColor="#9ca3af"
            value={repayAction}
            onChangeText={setRepayAction}
          />
          <TextInput
            style={styles.input}
            placeholder="預計幾時做？（例如：今個星期五）"
            placeholderTextColor="#9ca3af"
            value={repayWhen}
            onChangeText={setRepayWhen}
          />
        </>
      )}
      {mode === "forward" && (
        <>
          <TextInput
            style={styles.input}
            placeholder="你想把善意傳畀邊類人？（例如：同學、陌生人、家人）"
            placeholderTextColor="#9ca3af"
            value={forwardTarget}
            onChangeText={setForwardTarget}
          />
          <TextInput
            style={styles.input}
            placeholder="你打算做咩行動傳揚開去？"
            placeholderTextColor="#9ca3af"
            value={forwardAction}
            onChangeText={setForwardAction}
          />
        </>
      )}

      {/* 主題顏色 */}
      <Text style={styles.themeLabel}>卡片主題</Text>
      <View style={styles.themeRow}>
        {THEMES.map((t, i) => (
          <TouchableOpacity
            key={t.name}
            style={[styles.themeBtn, { backgroundColor: t.bg, borderColor: t.border }, themeIdx === i && styles.themeBtnActive]}
            onPress={() => setThemeIdx(i)}
          >
            <Text style={{ fontSize: 16 }}>{t.emoji}</Text>
            <Text style={[styles.themeName, { color: t.title }]}>{t.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.generateBtn, !requiredValid && styles.btnDisabled]}
          onPress={handleGenerate}
          disabled={!requiredValid}
        >
          <Text style={styles.generateBtnText}>
              {mode === "message" ? "📝 生成內容" : editingTaskId ? "✏️ 更新火炬任務" : "📒 新增到火炬行動簿"}
          </Text>
        </TouchableOpacity>
        {mode === "message" && (
          <TouchableOpacity
            style={[styles.switchBtn, !requiredValid && styles.btnDisabled]}
            onPress={saveMessageTask}
            disabled={!requiredValid}
          >
            <Text style={styles.switchBtnText}>📒 新增到火炬行動簿</Text>
          </TouchableOpacity>
        )}
        {mode === "message" && (
          <TouchableOpacity
            style={[styles.generateBtnAi, (!recipient.trim() || !keyword.trim() || loadingAi) && styles.btnDisabled]}
            onPress={handleGenerateAi}
            disabled={!recipient.trim() || !keyword.trim() || loadingAi}
          >
            <Text style={styles.generateBtnText}>{loadingAi ? "生成中…" : "✨ AI 生成內文"}</Text>
          </TouchableOpacity>
        )}
        {mode === "message" && generatedText && (
          <TouchableOpacity style={styles.switchBtn} onPress={handleSwitchTemplate}>
            <Text style={styles.switchBtnText}>換款式</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 卡片預覽（只限「寫感謝訊息」模式） */}
      {mode === "message" && generatedText && (
        <>
          <ViewShot
            ref={viewShotRef}
            options={{
              format: "png",
              quality: 1.0,
              ...(Platform.OS === "android" ? { fileName: "torch-gratitude-card.png" } : {})
            }}
            style={[styles.card, { backgroundColor: theme.bg, borderColor: theme.border }]}
          >
            {aiImageUrl ? (
              <Image source={{ uri: aiImageUrl }} style={styles.cardBgImage} resizeMode="cover" />
            ) : null}
            <View style={[styles.cardTopBar, { backgroundColor: theme.accent }]} />

            <View style={styles.cardInner}>
              <Text style={[styles.cardEmoji]}>{theme.emoji}</Text>
              <Text style={[styles.cardBody, { color: theme.body }]}>{generatedText}</Text>
              <View style={[styles.cardDivider, { backgroundColor: theme.border }]} />
              <Text style={[styles.cardFooter, { color: theme.title }]}>
                正發光
              </Text>
            </View>
          </ViewShot>

          {/* 可修訂內文（與卡片同步，儲存／分享時以修訂後為準） */}
          <Text style={styles.editLabel}>✏️ 可修訂內文</Text>
          <TextInput
            style={[styles.cardBodyInput, { color: theme.body, borderColor: theme.border }]}
            value={generatedText ?? ""}
            onChangeText={setGeneratedText}
            placeholder="在此編輯感恩卡內文…"
            placeholderTextColor="#9ca3af"
            multiline
            textAlignVertical="top"
          />

          {mode === "message" && (
            <>
              {/* AI 插圖：無圖時顯示「AI 插圖（選填）」，有圖時顯示「重新生成插圖」 */}
              <TouchableOpacity
                style={[
                  styles.generateBtnAi,
                  styles.aiIllustrationBtn,
                  (!recipient.trim() || !keyword.trim() || loadingImage) && styles.btnDisabled
                ]}
                onPress={handleGenerateAiImage}
                disabled={!recipient.trim() || !keyword.trim() || loadingImage}
              >
                <Text style={styles.generateBtnText}>
                  {loadingImage ? "生成中…（約需 2–3 分鐘）" : aiImageUrl ? "🖼 重新生成插圖" : "🖼 AI 插圖（選填）"}
                </Text>
              </TouchableOpacity>
              <Text style={styles.imageHint}>⏱ 生成插圖約需 2–3 分鐘，請耐心等候。</Text>
            </>
          )}

          {/* 操作按鈕 */}
          {mode === "message" && (
            <>
              <View style={styles.saveRow}>
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: theme.accent }, saving && styles.btnDisabled]}
                  onPress={handleSaveToGallery}
                  disabled={saving}
                >
                  <Text style={styles.saveBtnText}>📸 儲存到相簿</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.shareBtn, { borderColor: theme.accent }, saving && styles.btnDisabled]}
                  onPress={handleShare}
                  disabled={saving}
                >
                  <Text style={[styles.shareBtnText, { color: theme.title }]}>🔗 傳送訊息並新增到火炬行動簿</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.hintText}>
                按「傳送訊息並新增到火炬行動簿」後會開啟 WhatsApp，並在行動簿新增一項已完成紀錄。
              </Text>
            </>
          )}
        </>
      )}

      <View style={styles.logBox}>
        <Text style={styles.logTitle}>📒 火炬行動簿</Text>
        {torchTasks.length === 0 ? (
          <Text style={styles.logEmpty}>你未有火炬任務。先完成一個「生成內容」吧。</Text>
        ) : (
          pagedTorchTasks.map((t) => (
            <View key={t.id} style={styles.logItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.logItemTitle}>
                  {t.mode === "message" ? "✉️" : t.mode === "repay" ? "🤝" : "🔥"} {t.title}
                </Text>
                <Text style={styles.logItemDetail}>{t.detail}</Text>
                <View style={styles.logMetaRow}>
                  <Text style={styles.logItemMeta}>{new Date(t.createdAt).toLocaleDateString("zh-HK")}</Text>
                  <View style={[styles.statusChip, t.completed ? styles.statusChipDone : styles.statusChipPending]}>
                    <Text style={[styles.statusChipText, t.completed ? styles.statusChipTextDone : styles.statusChipTextPending]}>
                      {t.completed ? "已完成" : "待完成"}
                    </Text>
                  </View>
                </View>
              </View>
              {!t.completed ? (
                t.mode === "message" ? (
                  <View style={styles.logActionCol}>
                    <TouchableOpacity style={styles.editBtn} onPress={() => startEditTask(t)}>
                      <Text style={styles.editBtnText}>編輯</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.editBtn} onPress={() => regenerateMessageTask(t)}>
                      <Text style={styles.editBtnText}>生成內文</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.doneBtn} onPress={() => sendMessageTask(t)}>
                      <Text style={styles.doneBtnText}>發送訊息</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.logActionCol}>
                    <TouchableOpacity style={styles.editBtn} onPress={() => startEditTask(t)}>
                      <Text style={styles.editBtnText}>編輯</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.doneBtn} onPress={() => markTaskCompleted(t.id)}>
                      <Text style={styles.doneBtnText}>標記完成</Text>
                    </TouchableOpacity>
                  </View>
                )
              ) : null}
            </View>
          ))
        )}
        {torchTasks.length > TASKS_PER_PAGE ? (
          <View style={styles.paginationRow}>
            <TouchableOpacity
              style={[styles.pageBtn, taskPage === 1 && styles.pageBtnDisabled]}
              onPress={() => setTaskPage((p) => Math.max(1, p - 1))}
              disabled={taskPage === 1}
            >
              <Text style={styles.pageBtnText}>上一頁</Text>
            </TouchableOpacity>
            <Text style={styles.pageInfo}>第 {taskPage} / {totalTaskPages} 頁</Text>
            <TouchableOpacity
              style={[styles.pageBtn, taskPage === totalTaskPages && styles.pageBtnDisabled]}
              onPress={() => setTaskPage((p) => Math.min(totalTaskPages, p + 1))}
              disabled={taskPage === totalTaskPages}
            >
              <Text style={styles.pageBtnText}>下一頁</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </ScrollView>
      </View>
    </View>
    <DefinitionInfoModal
      visible={showGratitudeIntroModal}
      onRequestClose={() => setShowGratitudeIntroModal(false)}
      title="甚麼是感恩？"
      citation={GRATITUDE_CITATION}
      bodyText={
        "感恩（gratitude）在正向心理學的文獻中，常指能察覺並珍惜生命中所領受的美好、助力與善意，並意識到這些美好至少有一部分來自自身以外（例如他人、機會或其他來源），而伴隨感謝的情緒或較穩定的傾向。\n\n感恩並非要否定困境，而是在面對壓力時仍能辨識支持與資源、維繫與他人及環境的連結；亦可透過言語或行動向對方傳達謝意。"
      }
    />
    {showCompleteRelay ? (
      <Animated.View pointerEvents="none" style={[styles.completeOverlay, { opacity: completeOverlayOpacity }]}>
        <View style={styles.completeCard}>
          <Text style={styles.completeTitle}>任務完成</Text>
          <View style={styles.completeTorchRow}>
            <Text style={styles.completeTorch}>🔥</Text>
            <View style={styles.completeLane}>
              <Animated.View
                style={[
                  styles.completeTravelFlame,
                  {
                    opacity: completeTravel.interpolate({ inputRange: [0, 0.06, 0.95, 1], outputRange: [0, 1, 1, 0] }),
                    transform: [{ translateX: completeTravel.interpolate({ inputRange: [0, 1], outputRange: [0, 172] }) }]
                  }
                ]}
              >
                <Text style={styles.completeTravelFlameText}>✨</Text>
              </Animated.View>
            </View>
            <Animated.View style={{ opacity: completeRightGlow.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }}>
              <Text style={styles.completeTorch}>🔥</Text>
            </Animated.View>
          </View>
        </View>
      </Animated.View>
    ) : null}
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  outerWrap: { flex: 1, padding: 16 },
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
  title: { fontSize: 22, fontWeight: "700", marginBottom: 14, color: "#111827" },
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
  infoTriggerBtn: {
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  infoTriggerText: { fontSize: 13, color: "#1d4ed8", fontWeight: "700", textAlign: "center" },
  moduleTaskBlock: { marginBottom: 14 },
  moduleTaskTitle: { fontSize: 18, fontWeight: "700", color: "#111827", marginBottom: 6 },
  moduleTaskText: { fontSize: 13, color: "#334155", lineHeight: 20 },
  torchRelayBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14
  },
  torchIcon: { fontSize: 28 },
  torchLane: {
    width: 128,
    height: 16,
    borderRadius: 999,
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
    marginHorizontal: 10,
    justifyContent: "center"
  },
  travelFlame: { position: "absolute", left: 2 },
  travelFlameText: { fontSize: 14 },
  modeRow: { gap: 8, marginBottom: 12 },
  modeBtn: {
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  modeBtnActive: {
    borderColor: "#d56c2f",
    backgroundColor: "#fff7ed"
  },
  modeBtnText: { fontSize: 13, color: "#4b5563", fontWeight: "600", textAlign: "center" },
  modeBtnTextActive: { color: "#b45309" },
  editingBanner: {
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fed7aa",
    backgroundColor: "#fff7ed",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  editingBannerText: { fontSize: 12, color: "#9a3412", fontWeight: "700" },
  editingCancelText: { fontSize: 12, color: "#b45309", fontWeight: "700", textAlign: "center" },
  promptBox: {
    backgroundColor: "#fffbeb",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#fde68a",
    alignItems: "center"
  },
  promptLabel: { fontSize: 11, color: "#b45309", fontWeight: "600", marginBottom: 4, textAlign: "center", alignSelf: "stretch" },
  promptText: { fontSize: 14, color: "#92400e", textAlign: "center" },
  input: {
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: "#fff",
    marginBottom: 10,
    color: "#111827"
  },
  themeLabel: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 8 },
  themeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  themeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4
  },
  themeBtnActive: { borderWidth: 3 },
  themeName: { fontSize: 13, fontWeight: "600", textAlign: "center" },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" },
  generateBtn: {
    backgroundColor: "#d56c2f",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center"
  },
  generateBtnAi: {
    backgroundColor: "#d56c2f",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center"
  },
  /** 與上方「可修訂內文」輸入框分開少許 */
  aiIllustrationBtn: { marginTop: 16, marginBottom: 6 },
  btnDisabled: { opacity: 0.35 },
  generateBtnText: { color: "#fff", fontWeight: "700", fontSize: 15, textAlign: "center" },
  switchBtn: {
    borderWidth: 1.5,
    borderColor: "#d56c2f",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center"
  },
  switchBtnText: { color: "#d56c2f", fontWeight: "600", fontSize: 14, textAlign: "center" },
  // Card (ViewShot area)
  card: {
    borderRadius: 20,
    borderWidth: 2,
    overflow: "hidden",
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4
  },
  cardBgImage: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
    opacity: 0.25
  },
  cardTopBar: { height: 8, width: "100%" },
  cardInner: { padding: 24, alignItems: "center" },
  cardEmoji: { fontSize: 40, marginBottom: 12 },
  cardBody: { fontSize: 16, lineHeight: 26, textAlign: "center", marginBottom: 16 },
  cardDivider: { height: 1, width: "60%", marginBottom: 12, opacity: 0.5 },
  cardFooter: { fontSize: 11, fontWeight: "600", letterSpacing: 0.5, opacity: 0.7 },
  editLabel: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 },
  cardBodyInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    lineHeight: 24,
    minHeight: 100,
    backgroundColor: "#fefce8"
  },
  imageHint: { fontSize: 12, color: "#6b7280", marginBottom: 12 },
  // Save / Share
  saveRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
  saveBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 15, textAlign: "center" },
  shareBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    backgroundColor: "#fff"
  },
  shareBtnText: { fontWeight: "700", fontSize: 15, textAlign: "center" },
  hintText: { fontSize: 12, color: "#9ca3af", textAlign: "center" }
  ,
  logBox: {
    marginTop: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    padding: 12
  },
  logTitle: { fontSize: 15, fontWeight: "700", color: "#111827", marginBottom: 8 },
  logEmpty: { fontSize: 13, color: "#6b7280" },
  logItem: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    paddingTop: 10,
    marginTop: 10
  },
  logItemTitle: { fontSize: 13, fontWeight: "700", color: "#1f2937", marginBottom: 3 },
  logItemDetail: { fontSize: 12, color: "#4b5563", lineHeight: 18 },
  logMetaRow: { flexDirection: "row", alignItems: "center", marginTop: 6, gap: 8 },
  logItemMeta: { fontSize: 11, color: "#9ca3af" },
  paginationRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  pageBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
    alignItems: "center",
    justifyContent: "center"
  },
  pageBtnDisabled: { opacity: 0.45 },
  pageBtnText: { fontSize: 12, fontWeight: "700", color: "#9a3412", textAlign: "center" },
  pageInfo: { fontSize: 12, color: "#6b7280", fontWeight: "600" },
  logActionCol: { marginLeft: 10, gap: 8 },
  editBtn: {
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe",
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center"
  },
  editBtnText: { fontSize: 12, color: "#1d4ed8", fontWeight: "800", textAlign: "center" },
  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  statusChipPending: { backgroundColor: "#fff7ed", borderColor: "#fdba74" },
  statusChipDone: { backgroundColor: "#ecfdf5", borderColor: "#86efac" },
  statusChipText: { fontSize: 11, fontWeight: "700", textAlign: "center" },
  statusChipTextPending: { color: "#9a3412" },
  statusChipTextDone: { color: "#166534" },
  doneBtn: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center"
  },
  doneBtnText: { color: "#fff", fontWeight: "700", fontSize: 12, textAlign: "center" },
  completeOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(17,24,39,0.42)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18
  },
  completeCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#fed7aa",
    paddingVertical: 22,
    paddingHorizontal: 18,
    alignItems: "center"
  },
  completeTitle: { fontSize: 22, fontWeight: "800", color: "#9a3412", marginBottom: 14 },
  completeTorchRow: { flexDirection: "row", alignItems: "center" },
  completeTorch: { fontSize: 56 },
  completeLane: {
    width: 190,
    height: 22,
    borderRadius: 999,
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
    marginHorizontal: 12,
    justifyContent: "center"
  },
  completeTravelFlame: { position: "absolute", left: 2 },
  completeTravelFlameText: { fontSize: 22 }
});
