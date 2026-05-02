/**
 * 客戶端危機關鍵字偵測（須與 backend/server.js 之邏輯大致一致）。
 * 觸發時不呼叫 LLM，改為本地固定回覆 + 危機 Modal。
 */

const CRISIS_REGEXES: RegExp[] = [
  /自殺/,
  /自殘/,
  /想死/,
  /唔想活/,
  /不想活/,
  /尋死/,
  /輕生/,
  /了結(自己|生命)?/,
  /結束生命/,
  /割腕/,
  /跳樓/,
  /燒炭/,
  /吃藥死/,
  /一死了之/,
  /suicide/i,
  /self[-\s]?harm/i,
  /kill\s+myself/i,
  /end\s+my\s+life/i,
  /want\s+to\s+die/i
];

export function detectCrisisInUserText(text: string): boolean {
  const s = String(text || "").trim();
  if (s.length < 2) return false;
  return CRISIS_REGEXES.some((re) => re.test(s));
}

/** 與後端 /api/coach 危機回覆一致（繁體中文） */
export const CRISIS_COACH_REPLY =
  "我哋好關心你嘅安全。呢個 App 唔能夠代替即時危機支援。\n\n" +
  "請你而家：\n" +
  "• 搵一位你信任嘅大人（例如家人或老師）當面傾下\n" +
  "• 或致電撒瑪利亞會 24 小時熱線：2389 2222\n\n" +
  "你唔係一個人，有人願意聽你講。";
