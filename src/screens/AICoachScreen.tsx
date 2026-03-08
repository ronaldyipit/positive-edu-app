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
  Platform,
  Modal,
  Linking
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppBackground } from "../components/AppBackground";

const STRENGTH_CITATION_URL = "https://www.cityu.edu.hk/ss_posed/content.aspx?lang=zh&title=12";

/** 24 項性格優勢定義（參考 Peterson & Seligman, 2004；香港城市大學正向教育研究室） */
const STRENGTH_DEFINITIONS: Record<string, string> = {
  creativity: "能够想出新方法去做事。如果有更好的方法，決不會滿足於用傳統方法去做同樣的事。",
  curiosity: "對任何事都感到好奇。經常發問，對所有話題和題目感到著迷，並喜歡探索和發掘新事物。",
  judgment: "能從多角度思考和考證事物是你重要的特質。不會妄下結論，只會根據實際的證據做決定。",
  "love-of-learning": "喜愛學習新事物。喜愛上學、閱讀、參觀博物館和任何有機會學習的地方。",
  perspective: "不認為自己有智慧，但自己的朋友卻看得到。重視自己對事物的洞察力，並向人尋求意見。",
  bravery: "無所畏懼，不會在威脅、挑戰、困難或痛苦面前畏縮。即使面對反抗，仍會為正義而發聲，並根據自己的信念而行動。",
  perseverance: "努力去完成自己開展的工作。無論怎樣的工作都會盡力準時完成，工作時不會分心，並在完成工作的過程中獲得滿足感。",
  honesty: "誠實的人不止說實話，還會以真誠和真摰的態度生活，不虛偽，是個「真心」的人。",
  zest: "無論做什麼事都懷著興奮的心情和幹勁。做事不會半途而廢，對你而言生命是一場歷險。",
  love: "重視與別人的親密關係，特別是那些互相分享與關懷的關係。那些給你最親密感覺的人，同樣感到與你最親密。",
  kindness: "對別人仁慈和寬宏大量。別人請你做事從不推搪，享受為別人做好事，即使是認識不深的人。",
  "social-intelligence": "明白別人的動機和感受。在不同的社交場合知道該做甚麼，才能使其他人感到自在。",
  citizenship: "作為團隊的一份子表現突出。你是效忠和致力於團隊的隊員，經常完成自己的分內事，並為團隊的成功而努力。",
  fairness: "對所有人公平是堅持不變的原則。不會因為個人感情而對別人作出有偏差的判斷，並給予每個人平等的機會。",
  leadership: "在領導方面表現出色。鼓勵組員完成工作，令每名組員有歸屬感，維持團隊的和諧。",
  forgiveness: "寬恕那些對不起自己的人，常常給別人第二次機會。座右銘是慈悲，不是報復。",
  humility: "不追求別人的注視，比較喜歡讓成就不言而喻。不認為自己很特別，而謙遜是公認和受重視的。",
  prudence: "很小心，做選擇時總是一貫地審慎行事。不會說那些將來會後悔的話，或是做將來會後悔的事。",
  "self-regulation": "自覺地規範自己的感覺與行為，是個自律的人。對食量和情緒有自制力，不會反被它們支配。",
  appreciation: "在生命中的一切，從大自然、藝術、數學、科學以至日常生活體驗，都有留意和欣賞其美麗、優秀和富技巧之處。",
  gratitude: "留意發生在自己身上的好事，但從不會視為理所當然。因為常常表達謝意，身邊的人知道你是個懂得感恩的人。",
  hope: "對未來有最好的期望，並努力達成心願。相信未來掌握在自己手中。",
  humor: "喜歡大笑和逗別人快樂，為別人帶來歡笑很重要。在任何情況下都嘗試去看事情輕鬆的一面。",
  spirituality: "對崇高的人生目標和宇宙意義有着強烈和貫徹的信念。知道自己怎樣在大環境中作出配合，信念塑造行為，也成了慰藉之源。"
};

type Message = {
  id: string;
  from: "user" | "coach";
  text: string;
};

/** 把訊息中的 **文字** 拆成片段，方便用粗體顯示 */
function parseBoldSegments(str: string): { text: string; bold: boolean }[] {
  const parts: { text: string; bold: boolean }[] = [];
  let remaining = str;
  while (remaining.length > 0) {
    const i = remaining.indexOf("**");
    if (i === -1) {
      parts.push({ text: remaining, bold: false });
      break;
    }
    if (i > 0) parts.push({ text: remaining.slice(0, i), bold: false });
    const j = remaining.indexOf("**", i + 2);
    if (j === -1) {
      parts.push({ text: remaining.slice(i), bold: false });
      break;
    }
    parts.push({ text: remaining.slice(i + 2, j), bold: true });
    remaining = remaining.slice(j + 2);
  }
  return parts;
}

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
  const [definitionStrengthId, setDefinitionStrengthId] = useState<string | null>(null);
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
      ? `你好！我是 AI 正向心態教練 🌱\n\n你選擇了你的核心優勢：**${strengthLabels}**。\n\n我會在對話中幫你善用這些優勢來面對挑戰。今天你想談什麼？若一時未能描述清楚，可從上方情緒按鈕選一個開始對話。`
      : "你好！我是 AI 正向心態教練 🌱\n\n今天你想談什麼？若一時未能描述清楚，可從上方情緒按鈕選一個開始對話；或直接輸入。";

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
      <AppBackground>
      <View style={styles.outerWrap}>
        <View style={styles.whiteCard}>
      <ScrollView style={styles.container} contentContainerStyle={styles.selectContainer}>
        <Text style={styles.title}>AI 正向心態教練</Text>

        <View style={styles.resonanceBlock}>
          <Text style={styles.resonanceText}>
            成日被人話「你唔夠好」、淨係睇成績？其實你身上有好多強項，只係未有人同你一齊發掘。讀書、測驗、人際……壓力好大時，認識自己嘅性格強項，可以幫你更有力、更接納自己。
          </Text>
        </View>

        <Text style={styles.introHeading}>甚麼是性格強項？</Text>
        <Text style={styles.introBody}>
          性格強項由心理學家 Peterson 與 Seligman 提出，他們識別出六種美德及二十四種性格強項（Peterson & Seligman, 2004）。當我們發現、承認並在日常生活中運用這些強項時，會更愉快、更有成就、更具彈性，對生活更滿意（Seligman, 2011；香港城市大學正向教育研究室，n.d.）。
        </Text>

        <Text style={styles.selectHeading}>想想你最突出的 3 個性格優勢</Text>
        <Text style={styles.selectDesc}>
          不用填問卷，從下面 24 項性格優勢中，選出你認為最能代表自己的 3 個。{"\n"}
          教練會根據你的選擇來引導對話，幫你用自身強項面對挑戰。
        </Text>
        <Text style={styles.selectDefHint}>
          點擊每項右側的 ⓘ 圖示可查看定義。
        </Text>

        {VIRTUE_STRENGTHS.map(({ virtue, strengths }) => (
          <View key={virtue} style={styles.virtueSection}>
            <Text style={styles.virtueTitle}>{virtue}</Text>
            <View style={styles.strengthsGrid}>
              {strengths.map((s) => {
                const selected = selectedStrengths.includes(s.id);
                const definition = STRENGTH_DEFINITIONS[s.id];
                return (
                  <View key={s.id} style={styles.strengthBtnWrap}>
                    <TouchableOpacity
                      style={[styles.strengthBtn, selected && styles.strengthBtnSelected]}
                      onPress={() => toggleStrength(s.id)}
                    >
                      <Text style={styles.strengthEmoji}>{s.emoji}</Text>
                      <Text style={[styles.strengthLabel, selected && styles.strengthLabelSelected]}>
                        {s.label}
                      </Text>
                      {selected && <Text style={styles.strengthCheck}>✓</Text>}
                    </TouchableOpacity>
                    {definition ? (
                      <TouchableOpacity
                        style={styles.strengthInfoBtn}
                        onPress={() => setDefinitionStrengthId(s.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="information-circle-outline" size={18} color="#78716c" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        ))}

        <Modal
          visible={!!definitionStrengthId}
          transparent
          animationType="fade"
          onRequestClose={() => setDefinitionStrengthId(null)}
        >
          <TouchableOpacity
            style={styles.defModalOverlay}
            activeOpacity={1}
            onPress={() => setDefinitionStrengthId(null)}
          >
            <TouchableOpacity
              style={styles.defModalContent}
              activeOpacity={1}
              onPress={() => {}}
            >
              {definitionStrengthId ? (
                <>
                  <View style={styles.defModalHeader}>
                    <Text style={styles.defModalTitle}>
                      {getStrengthById(definitionStrengthId)?.emoji}{" "}
                      {getStrengthById(definitionStrengthId)?.label}
                    </Text>
                    <TouchableOpacity onPress={() => setDefinitionStrengthId(null)} hitSlop={12}>
                      <Ionicons name="close" size={24} color="#64748b" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.defModalBody}>
                    {STRENGTH_DEFINITIONS[definitionStrengthId]}
                  </Text>
                  <Text style={styles.defModalCitation}>
                    參考：香港城市大學正向教育研究室「美德與品格強項」(Peterson & Seligman, 2004)
                  </Text>
                  <TouchableOpacity
                    style={styles.defModalLink}
                    onPress={() => Linking.openURL(STRENGTH_CITATION_URL)}
                  >
                    <Text style={styles.defModalLinkText}>查看來源</Text>
                    <Ionicons name="open-outline" size={14} color="#d56c2f" />
                  </TouchableOpacity>
                </>
              ) : null}
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

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

        <Text style={styles.citationFooter}>
          性格優勢分類參考：{" "}
          <Text
            style={styles.citationLink}
            onPress={() => Linking.openURL(STRENGTH_CITATION_URL)}
          >
            香港城市大學正向教育研究室 — 美德與品格強項
          </Text>
        </Text>
      </ScrollView>
        </View>
      </View>
      </AppBackground>
    );
  }

  // ── 對話畫面 ────────────────────────────────────────────────
  return (
    <AppBackground>
    <View style={styles.outerWrap}>
      <View style={styles.whiteCard}>
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
            <Text style={styles.editStrengthsBtnText}>更改性格優勢</Text>
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
                {m.from === "coach"
                  ? parseBoldSegments(m.text).map((seg, i) =>
                      seg.bold ? (
                        <Text key={i} style={[styles.bubbleText, styles.bubbleTextBold]}>{seg.text}</Text>
                      ) : (
                        seg.text
                      )
                    )
                  : m.text}
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
      </View>
    </View>
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
  container: { flex: 1 },
  // Strengths select
  selectContainer: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 20, fontWeight: "700", color: "#111827", marginBottom: 14, paddingHorizontal: 4 },
  resonanceBlock: {
    backgroundColor: "#fff7ed",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#d56c2f"
  },
  resonanceText: {
    fontSize: 14,
    color: "#78350f",
    lineHeight: 22
  },
  introHeading: { fontSize: 15, fontWeight: "700", color: "#374151", marginBottom: 6 },
  introBody: {
    fontSize: 13,
    color: "#4b5563",
    lineHeight: 20,
    marginBottom: 14
  },
  selectHeading: { fontSize: 18, fontWeight: "700", color: "#111827", marginBottom: 6 },
  selectDesc: { fontSize: 13, color: "#4b5563", marginBottom: 8, lineHeight: 20 },
  selectDefHint: { fontSize: 12, color: "#78716c", marginBottom: 14, fontStyle: "italic" },
  strengthsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  strengthBtnWrap: { flexDirection: "row", alignItems: "center", gap: 4 },
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
  strengthBtnSelected: { borderColor: "#d56c2f", backgroundColor: "#fff7ed" },
  strengthEmoji: { fontSize: 18 },
  strengthLabel: { fontSize: 14, color: "#374151", fontWeight: "500" },
  strengthLabelSelected: { color: "#b45309", fontWeight: "700" },
  strengthCheck: { fontSize: 14, color: "#d56c2f", fontWeight: "700" },
  strengthInfoBtn: { padding: 4, justifyContent: "center" },
  selectHint: { fontSize: 13, color: "#6b7280", marginBottom: 16, textAlign: "center" },
  defModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 24
  },
  defModalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    maxWidth: 400,
    alignSelf: "center"
  },
  defModalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  defModalTitle: { fontSize: 18, fontWeight: "700", color: "#1c1917", flex: 1 },
  defModalBody: { fontSize: 14, color: "#374151", lineHeight: 22, marginBottom: 12 },
  defModalCitation: { fontSize: 11, color: "#78716c", fontStyle: "italic", marginBottom: 8 },
  defModalLink: { flexDirection: "row", alignItems: "center", gap: 4 },
  defModalLinkText: { fontSize: 13, color: "#d56c2f", fontWeight: "600" },
  citationFooter: { fontSize: 11, color: "#9ca3af", marginTop: 16, marginBottom: 8 },
  citationLink: { color: "#d56c2f", textDecorationLine: "underline" },
  virtueSection: { marginBottom: 18 },
  virtueTitle: { fontSize: 14, fontWeight: "700", color: "#374151", marginBottom: 8 },
  startBtn: {
    backgroundColor: "#d56c2f",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center"
  },
  startBtnDisabled: { backgroundColor: "#fdba74", opacity: 0.9 },
  startBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  // Chat screen top bar
  strengthsBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fff7ed",
    borderBottomWidth: 1,
    borderBottomColor: "#fed7aa"
  },
  strengthTag: {
    backgroundColor: "#ffedd5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999
  },
  strengthTagText: { fontSize: 12, color: "#b45309", fontWeight: "600" },
  editStrengthsBtn: { marginLeft: "auto" },
  editStrengthsBtnText: { fontSize: 12, color: "#d56c2f", fontWeight: "600" },
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
  userBubble: { backgroundColor: "#d56c2f", borderBottomRightRadius: 4 },
  coachBubble: {
    backgroundColor: "#fff",
    borderBottomLeftRadius: 4,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1
  },
  bubbleText: { fontSize: 14, color: "#111827", lineHeight: 20 },
  bubbleTextBold: { fontWeight: "700" },
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
  sendButton: { backgroundColor: "#d56c2f", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 21 },
  sendButtonDisabled: { opacity: 0.4 },
  sendText: { color: "#fff", fontWeight: "700" },
  disclaimer: { fontSize: 11, color: "#9ca3af", textAlign: "center", paddingBottom: 8 }
});
