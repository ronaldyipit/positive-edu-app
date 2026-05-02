import AsyncStorage from "@react-native-async-storage/async-storage";

export const LEVEL_XP = 100;
const GAMIFICATION_KEY = "@gamification_v1";

export const LEVEL_NAMES = [
  "初心發光",
  "穩步前行",
  "暖意成炬",
  "持續精進",
  "同路之光",
  "善意連結",
  "明亮領航",
  "心流引路",
  "群星同行",
  "正向燈塔"
] as const;

export type GamificationState = {
  xp: number;
  level: number;
  totalXp: number;
};

const DEFAULT_STATE: GamificationState = {
  xp: 0,
  level: 1,
  totalXp: 0
};

export function getLevelName(level: number): string {
  if (level <= 0) return LEVEL_NAMES[0];
  if (level <= LEVEL_NAMES.length) return LEVEL_NAMES[level - 1];
  return `發光大師`;
}

/** 成就徽章：依累積 EXP（totalXp）解鎖，於主頁展示 */
export const BADGE_DEFINITIONS = [
  { id: "spark", title: "初燃微光", emoji: "✨", minTotalXp: 50, desc: "累積 50 EXP" },
  { id: "steady", title: "步履不停", emoji: "🌿", minTotalXp: 200, desc: "累積 200 EXP" },
  { id: "torch", title: "暖意成炬", emoji: "🔥", minTotalXp: 500, desc: "累積 500 EXP" },
  { id: "beacon", title: "正向燈塔", emoji: "🏮", minTotalXp: 900, desc: "累積 900 EXP" }
] as const;

export function getUnlockedBadges(totalXp: number) {
  return BADGE_DEFINITIONS.filter((b) => totalXp >= b.minTotalXp);
}

/** 等級對應虛擬角色主造型（非精準科學，僅增趣味） */
export function getAvatarPresentation(level: number): { face: string; accessory: string | null } {
  if (level <= 2) return { face: "🌱", accessory: null };
  if (level <= 4) return { face: "🌿", accessory: "🎀" };
  if (level <= 6) return { face: "🌳", accessory: "⭐" };
  if (level <= 8) return { face: "✨", accessory: "👑" };
  return { face: "🏮", accessory: "🌟" };
}

export async function getGamificationState(): Promise<GamificationState> {
  try {
    const raw = await AsyncStorage.getItem(GAMIFICATION_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.xp === "number" &&
      typeof parsed?.level === "number" &&
      typeof parsed?.totalXp === "number"
    ) {
      return parsed;
    }
  } catch {}
  return DEFAULT_STATE;
}

export async function awardXp(amount: number): Promise<GamificationState> {
  const current = await getGamificationState();
  const nextTotal = current.totalXp + Math.max(0, amount);
  const levelGain = Math.floor((current.xp + amount) / LEVEL_XP);
  const nextLevel = current.level + Math.max(0, levelGain);
  const nextXp = (current.xp + amount) % LEVEL_XP;
  const next: GamificationState = {
    xp: nextXp,
    level: nextLevel,
    totalXp: nextTotal
  };
  await AsyncStorage.setItem(GAMIFICATION_KEY, JSON.stringify(next));
  return next;
}
