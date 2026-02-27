import React, { useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  Image
} from "react-native";
import ViewShot from "react-native-view-shot";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";

const COACH_API_BASE = process.env.EXPO_PUBLIC_COACH_API_URL || "http://localhost:4000";

const THEMES = [
  { name: "暖陽", bg: "#fefce8", border: "#fde047", title: "#854d0e", body: "#78350f", accent: "#fbbf24", emoji: "🌻" },
  { name: "薰衣草", bg: "#faf5ff", border: "#c084fc", title: "#6b21a8", body: "#581c87", accent: "#a855f7", emoji: "💜" },
  { name: "薄荷", bg: "#f0fdf4", border: "#86efac", title: "#166534", body: "#14532d", accent: "#22c55e", emoji: "🍃" },
  { name: "天空", bg: "#eff6ff", border: "#93c5fd", title: "#1e40af", body: "#1e3a8a", accent: "#3b82f6", emoji: "🌸" },
  { name: "玫瑰", bg: "#fff1f2", border: "#fda4af", title: "#9f1239", body: "#881337", accent: "#f43f5e", emoji: "🌹" }
];

const RANDOM_PROMPTS = [
  "今天哪件小事讓你微笑了？",
  "誰讓你覺得被理解和支持？",
  "有什麼你平時忽略但其實很感恩的東西？",
  "最近有誰默默幫過你？",
  "你感恩自己哪一個特質？"
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
  const [recipient, setRecipient] = useState("");
  const [keyword, setKeyword] = useState("");
  const [generatedText, setGeneratedText] = useState<string | null>(null);
  const [themeIdx, setThemeIdx] = useState(0);
  const [templateIdx, setTemplateIdx] = useState(0);
  const [prompt, setPrompt] = useState(RANDOM_PROMPTS[0]);
  const [saving, setSaving] = useState(false);
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiImageUrl, setAiImageUrl] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);

  const viewShotRef = useRef<ViewShot>(null);
  const theme = THEMES[themeIdx];

  const handleGenerate = () => {
    if (!recipient.trim() || !keyword.trim()) return;
    setGeneratedText(CARD_TEMPLATES[templateIdx](recipient.trim(), keyword.trim()));
  };

  const handleGenerateAi = async () => {
    if (!recipient.trim() || !keyword.trim()) return;
    setLoadingAi(true);
    try {
      const res = await fetch(`${COACH_API_BASE}/api/gratitude-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: recipient.trim(), keyword: keyword.trim() })
      });
      const json = await res.json();
      if (json?.text) setGeneratedText(json.text);
    } catch {}
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
      const json = await res.json();
      if (json?.imageUrl) setAiImageUrl(json.imageUrl);
    } catch {}
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

  const handleSaveToGallery = async () => {
    if (Platform.OS === "web") {
      Alert.alert("提示", "網頁版請使用「分享」功能或長按圖片儲存。");
      return;
    }
    setSaving(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("需要權限", "請允許存取相簿以儲存卡片圖片。");
        return;
      }
      const uri = await captureCard();
      if (!uri) throw new Error("截圖失敗");
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert("已儲存 📸", "感恩卡已儲存到你的相簿！");
    } catch {
      Alert.alert("儲存失敗", "請再試一次。");
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    setSaving(true);
    try {
      const uri = await captureCard();
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
      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: "分享感恩卡"
      });
    } catch {
      Alert.alert("分享失敗", "請再試一次。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.title}>感恩卡製作</Text>
      <Text style={styles.subtitle}>不好意思當面說「謝謝」？製作一張感恩卡直接傳給對方吧。</Text>

      {/* 靈感提示 */}
      <TouchableOpacity style={styles.promptBox} onPress={handleRandomPrompt}>
        <Text style={styles.promptLabel}>💡 靈感提示（點擊換一個）</Text>
        <Text style={styles.promptText}>{prompt}</Text>
      </TouchableOpacity>

      <TextInput
        style={styles.input}
        placeholder="送給誰？（例如：媽媽、同學 Kris）"
        placeholderTextColor="#9ca3af"
        value={recipient}
        onChangeText={setRecipient}
      />
      <TextInput
        style={styles.input}
        placeholder="感謝他／她什麼？（例如：陪伴、耐心、鼓勵）"
        placeholderTextColor="#9ca3af"
        value={keyword}
        onChangeText={setKeyword}
      />

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
          style={[styles.generateBtn, (!recipient.trim() || !keyword.trim()) && styles.btnDisabled]}
          onPress={handleGenerate}
          disabled={!recipient.trim() || !keyword.trim()}
        >
          <Text style={styles.generateBtnText}>📝 模板生成</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.generateBtnAi, (!recipient.trim() || !keyword.trim() || loadingAi) && styles.btnDisabled]}
          onPress={handleGenerateAi}
          disabled={!recipient.trim() || !keyword.trim() || loadingAi}
        >
          <Text style={styles.generateBtnText}>{loadingAi ? "生成中…" : "✨ AI 生成內文"}</Text>
        </TouchableOpacity>
        {generatedText && (
          <TouchableOpacity style={styles.switchBtn} onPress={handleSwitchTemplate}>
            <Text style={styles.switchBtnText}>換款式</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 卡片預覽（ViewShot 截圖範圍） */}
      {generatedText && (
        <>
          <ViewShot
            ref={viewShotRef}
            options={{ format: "png", quality: 1.0 }}
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
                Positive Education Companion
              </Text>
            </View>
          </ViewShot>

          {!aiImageUrl && (
            <TouchableOpacity
              style={[styles.generateBtnAi, { marginBottom: 8 }, (!recipient.trim() || !keyword.trim() || loadingImage) && styles.btnDisabled]}
              onPress={handleGenerateAiImage}
              disabled={!recipient.trim() || !keyword.trim() || loadingImage}
            >
              <Text style={styles.generateBtnText}>{loadingImage ? "生成中…" : "🖼 AI 插圖（選填）"}</Text>
            </TouchableOpacity>
          )}

          {/* 操作按鈕 */}
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
              <Text style={[styles.shareBtnText, { color: theme.title }]}>🔗 分享</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.hintText}>
            儲存後可直接傳到 WhatsApp、IG 給 {recipient}。
          </Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#f9fafb" },
  container: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 4, color: "#111827" },
  subtitle: { fontSize: 13, color: "#4b5563", marginBottom: 14 },
  promptBox: {
    backgroundColor: "#f0fdf4",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#bbf7d0"
  },
  promptLabel: { fontSize: 11, color: "#16a34a", fontWeight: "600", marginBottom: 4 },
  promptText: { fontSize: 14, color: "#166534" },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
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
    gap: 4
  },
  themeBtnActive: { borderWidth: 3 },
  themeName: { fontSize: 13, fontWeight: "600" },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" },
  generateBtn: {
    backgroundColor: "#6366f1",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999
  },
  generateBtnAi: {
    backgroundColor: "#7c3aed",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999
  },
  btnDisabled: { opacity: 0.35 },
  generateBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  switchBtn: {
    borderWidth: 1.5,
    borderColor: "#6366f1",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999
  },
  switchBtnText: { color: "#6366f1", fontWeight: "600", fontSize: 14 },
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
  // Save / Share
  saveRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
  saveBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center"
  },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  shareBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 2,
    backgroundColor: "#fff"
  },
  shareBtnText: { fontWeight: "700", fontSize: 15 },
  hintText: { fontSize: 12, color: "#9ca3af", textAlign: "center" }
});
