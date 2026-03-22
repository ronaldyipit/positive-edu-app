import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Animated
} from "react-native";
import { doc, getDoc } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { AppBackground } from "../components/AppBackground";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../config/firebase";
import { getGamificationState, getLevelName, LEVEL_XP } from "../utils/gamification";

const MODULES = [
  {
    id: "正向教練",
    title: "正向教練",
    desc: "善用性格優勢對話，建立正向心態",
    emoji: "🌱",
    accent: "#16a34a",
    bg: "#f0fdf4",
    border: "#bbf7d0"
  },
  {
    id: "離線深潛",
    title: "離線深潛",
    desc: "深潛模式、報平安簡訊、長按 5 秒結束，專注當下",
    emoji: "🌊",
    accent: "#2563eb",
    bg: "#eff6ff",
    border: "#bfdbfe"
  },
  {
    id: "紓壓",
    title: "紓壓碎紙",
    desc: "寫下壓力、搖動粉碎，再以呼吸平靜下來",
    emoji: "📱",
    accent: "#ea580c",
    bg: "#fff7ed",
    border: "#fed7aa"
  },
  {
    id: "感恩",
    title: "火炬傳暖",
    desc: "用三種方式回應善意：答謝、默默報答、傳揚開去",
    emoji: "🔥",
    accent: "#c026d3",
    bg: "#fdf4ff",
    border: "#f5d0fe"
  }
];

const DAILY_QUOTES = [
  "今天也要好好照顧自己 ✨",
  "每一步都是成長 🌱",
  "你比你想像中更棒 💪",
  "休息一下，再繼續發光 🌟",
  "感恩小事，日子更明亮 ☀️"
];

function getDailyQuote() {
  const day = new Date().getDate();
  return DAILY_QUOTES[day % DAILY_QUOTES.length];
}

export default function HomeScreen({
  navigation
}: {
  navigation: { navigate: (name: string) => void };
}) {
  const { user } = useAuth();
  const [displayNameFromFirestore, setDisplayNameFromFirestore] = useState<string | null>(null);
  const displayName =
    user?.displayName?.trim() ||
    displayNameFromFirestore?.trim() ||
    null;
  const quote = getDailyQuote();
  const animValues = useRef(MODULES.map(() => new Animated.Value(0))).current;
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);

  useEffect(() => {
    if (!user?.uid || !db) return;
    getDoc(doc(db, "users", user.uid))
      .then((snap) => {
        const name = snap.data()?.displayName;
        if (typeof name === "string") setDisplayNameFromFirestore(name);
      })
      .catch(() => {});
  }, [user?.uid]);

  useFocusEffect(
    React.useCallback(() => {
      getGamificationState()
        .then((g) => {
          setLevel(g.level);
          setXp(g.xp);
        })
        .catch(() => {});
    }, [])
  );

  useEffect(() => {
    Animated.parallel(
      animValues.map((val, i) =>
        Animated.timing(val, {
          toValue: 1,
          duration: 420,
          delay: 70 * i,
          useNativeDriver: true
        })
      )
    ).start();
  }, []);

  return (
    <AppBackground>
      <View style={styles.outerWrap}>
        <View style={styles.whiteCard}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Image
              source={require("../../assets/img/AppLogo.png")}
              style={styles.appLogo}
              resizeMode="contain"
            />
            <Text style={styles.title}>正發光</Text>
            <Text style={styles.welcome}>
              {displayName ? `你好，${displayName}！` : "你好！"}
            </Text>
            <View style={styles.quoteWrap}>
              <Text style={styles.quote}>{quote}</Text>
            </View>
            <View style={styles.levelWrap}>
              <Text style={styles.levelTitle}>目前等級：Lv.{level}・{getLevelName(level)}</Text>
              <View style={styles.levelBar}>
                <View style={[styles.levelFill, { width: `${Math.max(0, Math.min(100, (xp / LEVEL_XP) * 100))}%` }]} />
              </View>
              <Text style={styles.levelSub}>距離下一級尚餘 {LEVEL_XP - xp} XP</Text>
            </View>
            <Text style={styles.subtitle}>選擇一個功能開始吧</Text>

            <View style={styles.grid}>
              {MODULES.map((m, i) => (
                <Animated.View
                  key={m.id}
                  style={[
                    styles.gridItem,
                    {
                      opacity: animValues[i],
                      transform: [
                        {
                          translateY: animValues[i].interpolate({
                            inputRange: [0, 1],
                            outputRange: [16, 0]
                          })
                        }
                      ]
                    }
                  ]}
                >
                  <TouchableOpacity
                    style={[
                      styles.card,
                      {
                        backgroundColor: m.bg,
                        borderColor: m.border,
                        borderLeftWidth: 4,
                        borderLeftColor: m.accent
                      }
                    ]}
                    onPress={() => navigation.navigate(m.id)}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.cardIconWrap, { backgroundColor: m.bg }]}>
                      <View style={[styles.cardIconInner, { backgroundColor: m.accent }]}>
                        <Text style={styles.cardEmoji}>{m.emoji}</Text>
                      </View>
                    </View>
                    <Text style={[styles.cardTitle, { color: m.accent }]} numberOfLines={1}>{m.title}</Text>
                    <Text style={styles.cardDesc} numberOfLines={3}>{m.desc}</Text>
                    <View style={styles.chevronRow}>
                      <View style={[styles.chevronWrap, { backgroundColor: m.accent }]}>
                        <Ionicons name="chevron-forward" size={14} color="#fff" />
                      </View>
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </View>
          </ScrollView>
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
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 32 },
  appLogo: { width: 120, height: 120, alignSelf: "center", marginBottom: 12 },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1c1917",
    textAlign: "center",
    marginBottom: 4
  },
  welcome: {
    fontSize: 15,
    color: "#78716c",
    textAlign: "center",
    marginBottom: 12
  },
  quoteWrap: {
    backgroundColor: "#fffbeb",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#fde68a"
  },
  quote: {
    fontSize: 14,
    color: "#92400e",
    textAlign: "center",
    fontWeight: "600"
  },
  levelWrap: {
    backgroundColor: "#eff6ff",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#bfdbfe"
  },
  levelTitle: { fontSize: 13, color: "#1e40af", fontWeight: "700", marginBottom: 6, textAlign: "center" },
  levelBar: { height: 8, borderRadius: 999, backgroundColor: "#dbeafe", overflow: "hidden", marginBottom: 6 },
  levelFill: { height: "100%", backgroundColor: "#2563eb" },
  levelSub: { fontSize: 11, color: "#1d4ed8", textAlign: "center" },
  subtitle: {
    fontSize: 13,
    color: "#78716c",
    textAlign: "center",
    marginBottom: 20
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between"
  },
  gridItem: {
    width: "48%",
    marginBottom: 12
  },
  card: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    alignItems: "center",
    width: "100%",
    height: 182,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2
  },
  cardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8
  },
  cardIconInner: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  cardEmoji: { fontSize: 20 },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
    textAlign: "center"
  },
  cardDesc: {
    fontSize: 11,
    color: "#64748b",
    lineHeight: 15,
    textAlign: "center",
    marginBottom: 6,
    minHeight: 45,
    width: "100%"
  },
  chevronRow: {
    width: "100%",
    alignItems: "flex-end",
    marginTop: "auto"
  },
  chevronWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center"
  }
});
