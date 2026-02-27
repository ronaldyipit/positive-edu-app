import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  KeyboardAvoidingView,
  Platform
} from "react-native";

type Message = {
  id: string;
  from: "user" | "coach";
  text: string;
};

// Use .env EXPO_PUBLIC_COACH_API_URL for backend URL (e.g. http://192.168.68.120:4000 on LAN).
// Default: localhost so backend runs on same machine.
const COACH_API_BASE = process.env.EXPO_PUBLIC_COACH_API_URL || "http://localhost:4000";

// VIA 性格優勢（Seligman & Peterson）：6 種美德 × 24 項，讓使用者「自己想 3 個凸顯優勢」
const VIRTUE_STRENGTHS: { virtue: string; strengths: { id: string; label: string; emoji: string }[] }[] = [
  {
    virtue: "智慧與知識",
    strengths: [
      { id: "creativity", label: "創造力", emoji: "🎨" },
      { id: "curiosity", label: "好奇心", emoji: "🔍" },
      { id: "judgment", label: "判斷力", emoji: "⚖️" },
      { id: "love-of-learning", label: "愛學習", emoji: "📚" },
      { id: "perspective", label: "洞察力", emoji: "💡" }
    ]
  },
  {
    virtue: "勇氣",
    strengths: [
      { id: "bravery", label: "勇敢", emoji: "🦁" },
      { id: "perseverance", label: "堅毅", emoji: "💪" },
      { id: "honesty", label: "真誠", emoji: "💎" },
      { id: "zest", label: "幹勁", emoji: "🔥" }
    ]
  },
  {
    virtue: "仁愛",
    strengths: [
      { id: "love", label: "愛與被愛", emoji: "❤️" },
      { id: "kindness", label: "仁慈", emoji: "💛" },
      { id: "social-intelligence", label: "社交智慧", emoji: "🤝" }
    ]
  },
  {
    virtue: "正義",
    strengths: [
      { id: "citizenship", label: "公民感", emoji: "🏛️" },
      { id: "fairness", label: "公正", emoji: "⚖️" },
      { id: "leadership", label: "領導力", emoji: "🌟" }
    ]
  },
  {
    virtue: "節制",
    strengths: [
      { id: "forgiveness", label: "寬恕", emoji: "🕊️" },
      { id: "humility", label: "謙遜", emoji: "🙇" },
      { id: "prudence", label: "審慎", emoji: "🔒" },
      { id: "self-regulation", label: "自我規範", emoji: "🎯" }
    ]
  },
  {
    virtue: "超越自我",
    strengths: [
      { id: "appreciation", label: "對美和卓越的欣賞", emoji: "✨" },
      { id: "gratitude", label: "感恩", emoji: "🙏" },
      { id: "hope", label: "希望", emoji: "🌈" },
      { id: "humor", label: "幽默", emoji: "😄" },
      { id: "spirituality", label: "信仰", emoji: "🌅" }
    ]
  }
];

// 扁平列表，供 lookup 用
const ALL_STRENGTHS = VIRTUE_STRENGTHS.flatMap((v) => v.strengths);
function getStrengthById(id: string) {
  return ALL_STRENGTHS.find((s) => s.id === id);
}

const MOOD_BUTTONS = [
  { emoji: "😰", label: "有壓力" },
  { emoji: "😔", label: "情緒低落" },
  { emoji: "😠", label: "憤怒" },
  { emoji: "😟", label: "擔心" },
  { emoji: "😕", label: "迷失" },
  { emoji: "🌟", label: "想成長" }
];

function TypingDots() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: -6, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(600)
        ])
      ).start();
    animate(dot1, 0);
    animate(dot2, 150);
    animate(dot3, 300);
  }, []);

  return (
    <View style={typingStyles.row}>
      {[dot1, dot2, dot3].map((d, i) => (
        <Animated.View key={i} style={[typingStyles.dot, { transform: [{ translateY: d }] }]} />
      ))}
    </View>
  );
}

const typingStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 6, paddingHorizontal: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#9ca3af" }
});

export default function AICoachScreen() {
  // "strengths-select" → 先選優勢；"chat" → 進入對話
  const [screen, setScreen] = useState<"strengths-select" | "chat">("strengths-select");
  const [selectedStrengths, setSelectedStrengths] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const scrollToBottom = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const toggleStrength = (id: string) => {
    setSelectedStrengths((prev) =>
      prev.includes(id)
        ? prev.filter((s) => s !== id)
        : prev.length < 3
        ? [...prev, id]
        : prev
    );
  };

  const handleStartChat = () => {
    const strengthLabels = selectedStrengths
      .map((id) => getStrengthById(id)?.label)
      .filter(Boolean)
      .join("、");

    const intro = selectedStrengths.length > 0
      ? `你好！我是 AI 正向心態教練 🌱\n\n你選擇了你的核心優勢：**${strengthLabels}**。\n\n我會在對話中幫你善用這些優勢來面對挑戰。今天你想談什麼？`
      : "你好！我是 AI 正向心態教練 🌱\n\n今天你想談什麼？可以直接輸入，或點下面的情緒按鈕快速開始。";

    setMessages([{ id: "intro", from: "coach", text: intro }]);
    setScreen("chat");
  };

  const handleSend = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;
    const userMessage: Message = { id: Date.now().toString(), from: "user", text };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    scrollToBottom();

    try {
      const strengthLabels = selectedStrengths
        .map((id) => getStrengthById(id)?.label)
        .filter(Boolean);

      const history = [...messages, userMessage].map((m) => ({
        role: m.from === "user" ? "user" : "assistant",
        content: m.text
      }));

      const response = await fetch(`${COACH_API_BASE}/api/coach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, strengths: strengthLabels })
      });
      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-coach`,
          from: "coach",
          text: data?.reply ?? "暫時未能取得回應，請稍後再試，或和身邊信任的大人談談。"
        }
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-err`, from: "coach", text: "系統暫時遇到問題，請稍後再試，或和身邊信任的大人談談。" }
      ]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  // ── 優勢選擇畫面（自己想 3 個凸顯優勢，不填問卷）────────────────────────
  if (screen === "strengths-select") {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.selectContainer}>
        <Text style={styles.title}>AI 正向心態教練</Text>
        <Text style={styles.selectHeading}>想想你最突出的 3 個性格優勢</Text>
        <Text style={styles.selectDesc}>
          不用填問卷，從下面 24 項性格優勢中，選出你認為最能代表自己的 3 個。{"\n"}
          教練會根據你的選擇來引導對話，幫你用自身強項面對挑戰。
        </Text>

        {VIRTUE_STRENGTHS.map(({ virtue, strengths }) => (
          <View key={virtue} style={styles.virtueSection}>
            <Text style={styles.virtueTitle}>{virtue}</Text>
            <View style={styles.strengthsGrid}>
              {strengths.map((s) => {
                const selected = selectedStrengths.includes(s.id);
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.strengthBtn, selected && styles.strengthBtnSelected]}
                    onPress={() => toggleStrength(s.id)}
                  >
                    <Text style={styles.strengthEmoji}>{s.emoji}</Text>
                    <Text style={[styles.strengthLabel, selected && styles.strengthLabelSelected]}>
                      {s.label}
                    </Text>
                    {selected && <Text style={styles.strengthCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}

        <Text style={styles.selectHint}>
          {selectedStrengths.length === 0
            ? "請選出 3 個最能代表你的性格優勢"
            : `已選 ${selectedStrengths.length} / 3 個`}
        </Text>

        <TouchableOpacity
          style={[styles.startBtn, selectedStrengths.length < 3 && styles.startBtnDisabled]}
          onPress={handleStartChat}
          disabled={selectedStrengths.length < 3}
        >
          <Text style={styles.startBtnText}>
            {selectedStrengths.length === 3 ? "以我的 3 個優勢開始對話 →" : "請先選滿 3 個優勢"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── 對話畫面 ────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={80}
    >
      {/* 頂部：已選優勢標籤 */}
      {selectedStrengths.length > 0 && (
        <View style={styles.strengthsBar}>
          {selectedStrengths.map((id) => {
            const s = getStrengthById(id);
            if (!s) return null;
            return (
              <View key={id} style={styles.strengthTag}>
                <Text style={styles.strengthTagText}>{s.emoji} {s.label}</Text>
              </View>
            );
          })}
          <TouchableOpacity onPress={() => setScreen("strengths-select")} style={styles.editStrengthsBtn}>
            <Text style={styles.editStrengthsBtnText}>更改</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 情緒快選 */}
      <View style={styles.moodRow}>
        {MOOD_BUTTONS.map((m) => (
          <TouchableOpacity
            key={m.label}
            style={styles.moodBtn}
            onPress={() => handleSend(`我現在感到${m.label} ${m.emoji}`)}
            disabled={loading}
          >
            <Text style={styles.moodEmoji}>{m.emoji}</Text>
            <Text style={styles.moodLabel}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 對話 */}
      <ScrollView
        ref={scrollRef}
        style={styles.chat}
        contentContainerStyle={styles.chatContent}
        onContentSizeChange={scrollToBottom}
      >
        {messages.map((m) => (
          <View
            key={m.id}
            style={[styles.messageRow, m.from === "user" ? styles.messageRowUser : styles.messageRowCoach]}
          >
            {m.from === "coach" && (
              <View style={styles.avatar}><Text style={styles.avatarText}>🌱</Text></View>
            )}
            <View style={[styles.bubble, m.from === "user" ? styles.userBubble : styles.coachBubble]}>
              <Text style={[styles.bubbleText, m.from === "user" && styles.userBubbleText]}>
                {m.text}
              </Text>
            </View>
            {m.from === "user" && (
              <View style={styles.avatar}><Text style={styles.avatarText}>🙂</Text></View>
            )}
          </View>
        ))}
        {loading && (
          <View style={[styles.messageRow, styles.messageRowCoach]}>
            <View style={styles.avatar}><Text style={styles.avatarText}>🌱</Text></View>
            <View style={[styles.bubble, styles.coachBubble]}><TypingDots /></View>
          </View>
        )}
      </ScrollView>

      {/* 輸入框 */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="輸入你想說的話..."
          placeholderTextColor="#9ca3af"
          value={input}
          onChangeText={setInput}
          returnKeyType="send"
          onSubmitEditing={() => handleSend()}
          editable={!loading}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!input.trim() || loading) && styles.sendButtonDisabled]}
          onPress={() => handleSend()}
          disabled={!input.trim() || loading}
        >
          <Text style={styles.sendText}>送出</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.disclaimer}>本教練僅供教育用途，不能取代專業心理健康服務。</Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  // Strengths select
  selectContainer: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 20, fontWeight: "700", color: "#111827", marginBottom: 14, paddingHorizontal: 4 },
  selectHeading: { fontSize: 18, fontWeight: "700", color: "#111827", marginBottom: 6 },
  selectDesc: { fontSize: 13, color: "#4b5563", marginBottom: 18, lineHeight: 20 },
  strengthsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  strengthBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff"
  },
  strengthBtnSelected: { borderColor: "#2563eb", backgroundColor: "#eff6ff" },
  strengthEmoji: { fontSize: 18 },
  strengthLabel: { fontSize: 14, color: "#374151", fontWeight: "500" },
  strengthLabelSelected: { color: "#1d4ed8", fontWeight: "700" },
  strengthCheck: { fontSize: 14, color: "#2563eb", fontWeight: "700" },
  selectHint: { fontSize: 13, color: "#6b7280", marginBottom: 20, textAlign: "center" },
  virtueSection: { marginBottom: 18 },
  virtueTitle: { fontSize: 14, fontWeight: "700", color: "#374151", marginBottom: 8 },
  startBtn: {
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center"
  },
  startBtnDisabled: { backgroundColor: "#93c5fd", opacity: 0.9 },
  startBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  // Chat screen top bar
  strengthsBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#eff6ff",
    borderBottomWidth: 1,
    borderBottomColor: "#bfdbfe"
  },
  strengthTag: {
    backgroundColor: "#dbeafe",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999
  },
  strengthTagText: { fontSize: 12, color: "#1d4ed8", fontWeight: "600" },
  editStrengthsBtn: { marginLeft: "auto" },
  editStrengthsBtnText: { fontSize: 12, color: "#2563eb", fontWeight: "600" },
  // Mood buttons
  moodRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  moodBtn: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  moodEmoji: { fontSize: 16 },
  moodLabel: { fontSize: 12, color: "#374151", fontWeight: "500" },
  // Chat
  chat: { flex: 1 },
  chatContent: { padding: 12, gap: 4 },
  messageRow: { flexDirection: "row", alignItems: "flex-end", marginVertical: 3 },
  messageRowUser: { justifyContent: "flex-end" },
  messageRowCoach: { justifyContent: "flex-start" },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#e5e7eb",
    alignItems: "center", justifyContent: "center",
    marginHorizontal: 4
  },
  avatarText: { fontSize: 16 },
  bubble: { padding: 10, borderRadius: 18, maxWidth: "72%" },
  userBubble: { backgroundColor: "#2563eb", borderBottomRightRadius: 4 },
  coachBubble: {
    backgroundColor: "#fff",
    borderBottomLeftRadius: 4,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1
  },
  bubbleText: { fontSize: 14, color: "#111827", lineHeight: 20 },
  userBubbleText: { color: "#fff" },
  // Input
  inputRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  input: {
    flex: 1, minHeight: 42,
    borderWidth: 1, borderColor: "#d1d5db",
    borderRadius: 21, paddingHorizontal: 14,
    paddingVertical: 8, backgroundColor: "#fff",
    fontSize: 14, color: "#111827"
  },
  sendButton: { backgroundColor: "#2563eb", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 21 },
  sendButtonDisabled: { opacity: 0.4 },
  sendText: { color: "#fff", fontWeight: "700" },
  disclaimer: { fontSize: 11, color: "#9ca3af", textAlign: "center", paddingBottom: 8 }
});
