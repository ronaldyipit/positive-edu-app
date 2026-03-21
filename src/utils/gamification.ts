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
