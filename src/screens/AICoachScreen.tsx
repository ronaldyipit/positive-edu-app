import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { RootTabParamList } from "../navigation/types";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Modal,
  Linking
} from "react-native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { AppBackground } from "../components/AppBackground";
import { DefinitionInfoModal } from "../components/DefinitionInfoModal";

const STRENGTH_CITATION_URL =
  "https://global.oup.com/academic/product/character-strengths-and-virtues-9780195167016";

const GEELONG_POSITIVE_EDUCATION_BOOK_URL =
  "https://global.oup.com/academic/product/positive-education-9780198702580";

/** 完整出處（性格優勢分類與定義） */
const PETERSON_SELIGMAN_2004_CITATION =
  "Peterson, C., & Seligman, M. E. P. (2004). Character strengths and virtues: A handbook and classification. New York: Oxford University Press and Washington, DC: American Psychological Association.";

/** 後端 RAG 檢索來源之一；教練回覆或會在相關話題下改述書中觀點（非逐字引用） */
const NORRISH_SELIGMAN_2015_CITATION =
  "Norrish, J. M., & Seligman, M. E. (2015). Positive education: The Geelong grammar school journey. Oxford University Press.";

/** 與主頁模組、離線深潛等一致：單行標題（底部 Tab 仍為「正向教練」） */
const COACH_MODULE_TITLE = "正向教練 (AI聊天機器人)";

/** 24 項性格優勢定義（參考 Peterson & Seligman, 2004；以下為意義相近之改述） */
const STRENGTH_DEFINITIONS: Record<string, string> = {
  creativity: "樂於以新方式處理事務；一旦發現更佳途徑，便不願停留在舊有做法。",
  curiosity: "對周遭保持求知慾，常提問、好探索，願意主動發掘尚未了解的事物。",
  judgment: "習慣從多面向檢視議題，不憑空臆斷，而是依據事實與理據下判斷。",
  "love-of-learning": "真心享受吸收新知，不論課堂、閱讀、展館或任何學習情境都樂在其中。",
  perspective: "未必自詡聰穎，但旁人常覺得你有遠見；你重視反思，也樂於徵詢他人意見。",
  bravery: "面對威脅、難關或壓力仍敢向前；即使遭遇反對，仍會依信念為公義發聲。",
  perseverance: "一旦開始便會貫徹到底，盡力準時完成、專注不散漫，並從完成過程中獲得滿足。",
  honesty: "不只口說真話，生活態度也真摯一致，不造作，待人以誠為本。",
  zest: "做什麼都帶著熱情與活力，輕易不言棄；對你而言，生命像一場願意全情投入的旅程。",
  love: "珍惜彼此分享與關顧的親密關係；與你最親近的人，同樣感到與你心靈相近。",
  kindness: "待人寬厚，樂於伸出援手；有人需要幫忙時少推託，對相識不深者亦願多走一步。",
  "social-intelligence": "能察覺他人的動機與感受，並在不同場合調整言行，使眾人相處得自在。",
  citizenship: "在群體中盡責投入，信守承諾、做好本分，並為整體成果貢獻心力。",
  fairness: "堅持一視同仁，不因私情而偏袒，願給每人合理且平等的機會。",
  leadership: "擅長帶領眾人朝目標前進，使成員有歸屬與士氣，並維繫團隊和諧。",
  forgiveness: "對曾傷害自己的人仍願釋懷，多給機會重修關係；取向是寬容而非報復。",
  humility: "不刻意博取注目，寧以成果說話；不認為自己高人一等，謙遜是你受敬重的一環。",
  prudence: "做決定前習慣深思，言行謹慎；避免說出或做出日後會懊悔的事。",
  "self-regulation": "能自覺調節情緒與行為，對飲食、衝動與心情有所節制，不易被其牽制。",
  appreciation: "能在自然、藝術、學問以至日常細節中，察覺美、卓越與工巧之處。",
  gratitude: "會留意並珍惜身邊好事，不視一切為理所當然；常表達謝意，讓人感受到你的感恩之心。",
  hope: "對將來抱持正面想像，並願付諸行動；相信努力可以影響前路。",
  humor: "喜歡歡笑與為人帶來輕鬆感；即使處境不易，仍嘗試以幽默角度紓緩壓力。",
  spirituality: "對人生意義或更大格局懷有穩定信念，明白自己於世界中的位置；信念指引行動，亦帶來內在平安。"
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

/**
 * 後端可於回覆結尾附 [[SHREDDER]] / [[FLOW]] / [[TORCH]]（各佔一行），
 * 前端移除 token 並顯示對應分頁連結。
 */
const COACH_NAV_LINK_ORDER = [
  { token: "[[SHREDDER]]", screen: "紓壓" as const, label: "→ 開啟紓壓碎紙" },
  { token: "[[FLOW]]", screen: "離線深潛" as const, label: "→ 開啟離線深潛" },
  { token: "[[TORCH]]", screen: "感恩" as const, label: "→ 開啟火炬傳暖" }
];

function stripCoachNavTokens(text: string): {
  body: string;
  links: { screen: keyof RootTabParamList; label: string }[];
} {
  const links: { screen: keyof RootTabParamList; label: string }[] = [];
  let body = text;
  for (const { token, screen, label } of COACH_NAV_LINK_ORDER) {
    if (body.includes(token)) {
      links.push({ screen, label });
      body = body.split(token).join("");
    }
  }
  body = body.replace(/\n{3,}/g, "\n\n").trim();
  return { body, links };
}

// Use .env EXPO_PUBLIC_COACH_API_URL for backend URL (e.g. http://192.168.68.120:4000 on LAN).
// Default: localhost so backend runs on same machine.
const COACH_API_BASE = process.env.EXPO_PUBLIC_COACH_API_URL || "https://positive-edu-app.vercel.app";

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
  const route = useRoute<RouteProp<RootTabParamList, "正向教練">>();
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const tabBarHeight = useBottomTabBarHeight();
  const pendingFlowPrefillRef = useRef<string | null>(null);
  const [flowPrefillPending, setFlowPrefillPending] = useState(false);

  // "strengths-select" → 先選優勢；"chat" → 進入對話
  const [screen, setScreen] = useState<"strengths-select" | "chat">("strengths-select");
  const [definitionStrengthId, setDefinitionStrengthId] = useState<string | null>(null);
  const [showStrengthIntroModal, setShowStrengthIntroModal] = useState(false);
  const [selectedStrengths, setSelectedStrengths] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const handleStartChatRef = useRef<() => void>(() => {});

  const handleStartChat = useCallback(() => {
    const strengthLabels = selectedStrengths
      .map((id) => getStrengthById(id)?.label)
      .filter(Boolean)
      .join("、");

    const intro =
      selectedStrengths.length > 0
        ? `你好！我是 ${COACH_MODULE_TITLE} 🌱\n\n你選擇了你的核心優勢：**${strengthLabels}**。\n\n我會在對話中幫你善用這些優勢來面對挑戰。今天你想談什麼？若一時未能描述清楚，可從上方情緒按鈕選一個開始對話。`
        : `你好！我是 ${COACH_MODULE_TITLE} 🌱\n\n今天你想談什麼？若一時未能描述清楚，可從上方情緒按鈕選一個開始對話；或直接輸入。`;

    setMessages([{ id: "intro", from: "coach", text: intro }]);
    setScreen("chat");
  }, [selectedStrengths]);

  handleStartChatRef.current = handleStartChat;

  /** 離線深潛 → navigate 帶入 coachPrefillFromFlow */
  useEffect(() => {
    const raw = route.params?.coachPrefillFromFlow;
    if (typeof raw !== "string" || !raw.trim()) return;
    const text = raw.trim();
    navigation.setParams({ coachPrefillFromFlow: undefined } as never);
    pendingFlowPrefillRef.current = text;
    const n = selectedStrengths.length;
    const onChat = screen === "chat";
    setFlowPrefillPending(n < 3);
    if (n === 3) {
      setFlowPrefillPending(false);
      if (!onChat) {
        handleStartChatRef.current();
      } else {
        setInput(text);
        pendingFlowPrefillRef.current = null;
      }
    }
  }, [route.params?.coachPrefillFromFlow, selectedStrengths.length, screen, navigation]);

  useEffect(() => {
    if (screen === "chat" && pendingFlowPrefillRef.current) {
      const t = pendingFlowPrefillRef.current;
      pendingFlowPrefillRef.current = null;
      setInput(t);
      setFlowPrefillPending(false);
    }
  }, [screen]);

  const scrollToBottom = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  useEffect(() => {
    if (screen !== "chat" || Platform.OS === "web") return;
    const event = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const sub = Keyboard.addListener(event, () => scrollToBottom());
    return () => sub.remove();
  }, [screen]);

  const toggleStrength = (id: string) => {
    setSelectedStrengths((prev) =>
      prev.includes(id)
        ? prev.filter((s) => s !== id)
        : prev.length < 3
        ? [...prev, id]
        : prev
    );
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
        <Text style={styles.title} accessibilityRole="header">
          {COACH_MODULE_TITLE}
        </Text>

        {flowPrefillPending ? (
          <View style={styles.flowPrefillBanner}>
            <Text style={styles.flowPrefillBannerText}>
              你已從「離線深潛」帶備想同教練講嘅內容。請先選滿 3 個性格優勢，再按下方開始對話，輸入框會自動預填。
            </Text>
          </View>
        ) : null}

        <View style={styles.resonanceBlock}>
          <Text style={styles.resonanceText}>
            成日被人話「你唔夠好」、淨係睇成績？其實你身上有好多強項，只係未有人同你一齊發掘。讀書、測驗、人際……壓力好大時，認識自己嘅性格優勢，可以幫你更有力、更接納自己。
          </Text>
        </View>

        <TouchableOpacity style={styles.infoTriggerBtn} onPress={() => setShowStrengthIntroModal(true)}>
          <Text style={styles.infoTriggerText}>甚麼是性格優勢？（按此查看）</Text>
        </TouchableOpacity>

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
                  <Text style={styles.defModalCitation}>參考：{PETERSON_SELIGMAN_2004_CITATION}</Text>
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

        <DefinitionInfoModal
          visible={showStrengthIntroModal}
          onRequestClose={() => setShowStrengthIntroModal(false)}
          title="甚麼是性格優勢？"
          citation={PETERSON_SELIGMAN_2004_CITATION}
          bodyText={
            "性格優勢由心理學家 Peterson 與 Seligman 提出，他們識別出六種美德及二十四種性格優勢（Peterson & Seligman, 2004）。當我們發現、承認並在日常生活中運用這些優勢時，會更愉快、更有成就、更具彈性，對生活更滿意（Seligman, 2011）。"
          }
        />

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
          <Text style={styles.citationLink} onPress={() => Linking.openURL(STRENGTH_CITATION_URL)}>
            Peterson & Seligman (2004)
          </Text>
          {"\n"}
          <Text style={styles.citationFooterDetail}>{PETERSON_SELIGMAN_2004_CITATION}</Text>
        </Text>

        <Text style={styles.geelongRagFooter}>
          開始對話後，教練有時會按你的話題，參考從以下專書檢索並改寫的內容（非逐字引用）：{" "}
          <Text style={styles.citationLink} onPress={() => Linking.openURL(GEELONG_POSITIVE_EDUCATION_BOOK_URL)}>
            Norrish & Seligman (2015)
          </Text>
          {"\n"}
          <Text style={styles.citationFooterDetail}>{NORRISH_SELIGMAN_2015_CITATION}</Text>
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
      keyboardVerticalOffset={Platform.OS === "ios" ? tabBarHeight : 0}
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
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
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
              {m.from === "coach" ? (
                (() => {
                  const { body, links } = stripCoachNavTokens(m.text);
                  return (
                    <View>
                      <Text style={styles.bubbleText}>
                        {parseBoldSegments(body).map((seg, i) =>
                          seg.bold ? (
                            <Text key={i} style={[styles.bubbleText, styles.bubbleTextBold]}>
                              {seg.text}
                            </Text>
                          ) : (
                            seg.text
                          )
                        )}
                      </Text>
                      {links.map((link, idx) => (
                        <TouchableOpacity
                          key={`${link.screen}-${idx}`}
                          style={styles.moduleNavLinkWrap}
                          onPress={() => navigation.navigate(link.screen)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.moduleNavLinkText}>{link.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  );
                })()
              ) : (
                <Text style={[styles.bubbleText, styles.userBubbleText]}>{m.text}</Text>
              )}
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

        <View style={styles.chatFooterLegal}>
          <Text style={styles.disclaimer}>本教練僅供教育用途，不能取代專業心理健康服務。</Text>
          <Text style={styles.geelongRagChatNote}>
            部分回覆或會參考從專書檢索的段落並改寫（僅在與正向教育／相關話題切合時；非逐字引用）。
          </Text>
          <Text style={styles.geelongRagChatCitation}>
            <Text style={styles.citationLink} onPress={() => Linking.openURL(GEELONG_POSITIVE_EDUCATION_BOOK_URL)}>
              Norrish & Seligman (2015)
            </Text>
            <Text style={styles.citationFooterDetail}>
              {"\n"}
              {NORRISH_SELIGMAN_2015_CITATION}
            </Text>
          </Text>
        </View>
      </ScrollView>

      {/* 輸入框（緊貼鍵盤上方；聲明與書目已置於上方對話捲動區底部） */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="輸入你想說的話..."
          placeholderTextColor="#9ca3af"
          value={input}
          onChangeText={setInput}
          multiline
          scrollEnabled
          textAlignVertical="top"
          returnKeyType="default"
          blurOnSubmit={false}
          onFocus={() => scrollToBottom()}
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
  title: { fontSize: 22, fontWeight: "700", marginBottom: 12, color: "#111827" },
  flowPrefillBanner: {
    backgroundColor: "#eff6ff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#bfdbfe"
  },
  flowPrefillBannerText: { fontSize: 13, color: "#1e40af", lineHeight: 20 },
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
  citationFooterDetail: { fontSize: 10, color: "#9ca3af", marginTop: 6, lineHeight: 15 },
  citationLink: { color: "#d56c2f", textDecorationLine: "underline" },
  geelongRagFooter: {
    fontSize: 11,
    color: "#9ca3af",
    marginTop: 4,
    marginBottom: 8,
    lineHeight: 16
  },
  geelongRagChatNote: {
    fontSize: 10,
    color: "#9ca3af",
    textAlign: "center",
    marginTop: 4,
    paddingHorizontal: 12,
    lineHeight: 15
  },
  geelongRagChatCitation: {
    fontSize: 11,
    color: "#9ca3af",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 6,
    paddingHorizontal: 12
  },
  virtueSection: { marginBottom: 18 },
  virtueTitle: { fontSize: 14, fontWeight: "700", color: "#374151", marginBottom: 8 },
  startBtn: {
    backgroundColor: "#d56c2f",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  startBtnDisabled: { backgroundColor: "#fdba74", opacity: 0.9 },
  startBtnText: { color: "#fff", fontWeight: "700", fontSize: 16, textAlign: "center" },
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
  editStrengthsBtn: {
    marginLeft: "auto",
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  editStrengthsBtnText: { fontSize: 12, color: "#d56c2f", fontWeight: "600", textAlign: "center" },
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
    justifyContent: "center",
    gap: 4
  },
  moodEmoji: { fontSize: 16 },
  moodLabel: { fontSize: 12, color: "#374151", fontWeight: "500", textAlign: "center" },
  // Chat
  chat: { flex: 1 },
  chatContent: { padding: 12, gap: 4, paddingBottom: 20 },
  chatFooterLegal: {
    marginTop: 12,
    paddingTop: 8,
    paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e5e7eb"
  },
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
  moduleNavLinkWrap: { marginTop: 8, alignSelf: "stretch", alignItems: "center" },
  moduleNavLinkText: {
    fontSize: 14,
    color: "#d56c2f",
    fontWeight: "700",
    textDecorationLine: "underline",
    textAlign: "center"
  },
  userBubbleText: { color: "#fff" },
  // Input
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 8,
    backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e5e7eb"
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingTop: Platform.OS === "ios" ? 10 : 8,
    paddingBottom: Platform.OS === "ios" ? 10 : 8,
    backgroundColor: "#fff",
    fontSize: 14,
    color: "#111827",
    lineHeight: 20
  },
  sendButton: {
    backgroundColor: "#d56c2f",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center"
  },
  sendButtonDisabled: { opacity: 0.4 },
  sendText: { color: "#fff", fontWeight: "700", textAlign: "center" },
  disclaimer: { fontSize: 11, color: "#9ca3af", textAlign: "center", paddingBottom: 4 }
});
