# Proposal vs 專案實作對照檢查清單

依據 **INT6071_Individual Project Proposal_YIP Tsun Sing (11579965)_final.pdf** 與目前專案程式碼比對，以下為「提案內有描述、但專案尚未做或未完全符合」的項目。

---

## 一、Module 1: AI Positive Mindset Coach (Meaning)

| 提案描述 | 專案現況 | 差距 |
|----------|----------|------|
| LLM-based Socratic coach，問「What can you learn from this situation regarding your personal values?」 | 已有 system prompt 強調 PERMA Meaning、Socratic、優勢；未明確加入「personal values」範例問句 | **可補**：在 server.js 的 system prompt 加一句引導「個人價值／意義」的範例，與提案 5.2.1 完全對齊 |
| OpenAI API or similar LLM with Growth Mindset system prompt | 使用 Poe API (GPT)，有 Socratic + 優勢，未顯式寫 "Growth Mindset" | **可補**：在 system prompt 加 "Growth Mindset" 關鍵字，方便審閱對照 |
| Signature strengths 融入對話 | ✅ 已做：strengths 傳入後端並寫入 prompt | 無 |

---

## 二、Module 2: Flow Focus Timer (Engagement & Accomplishment)

| 提案描述 | 專案現況 | 差距 |
|----------|----------|------|
| Pomodoro + RPG（XP、badges）、完成後 rewards 而非只有 buzzer | ✅ 已做：XP、徽章、稱號、慶祝動畫；無 buzzer | 無 |
| 任務命名（review or hobbies） | ✅ 已做：taskInput / taskName、sessionLog | 無 |
| **累積 XP / 獲得徽章（跨 session）** | XP、completedSessions、sessionLog、徽章皆為 **React state**，關閉 app 即歸零 | **未做**：需用 AsyncStorage（或 Firebase）持久化，才符合提案「accumulate」「obtain badges」的長期意義 |
| 完成時音效（可選） | 無完成音效 | 提案寫「instead of just the buzzer」已滿足（無 buzzer、有視覺獎勵）；若要更佳體驗可加短音效 |

---

## 三、Module 3: Somatic Venting Shredder (Positive Emotions & Health)

| 提案描述 | 專案現況 | 差距 |
|----------|----------|------|
| **Step 1：learner 用「語音」宣洩，再轉成文字顯示** | 目前為 **文字輸入**（TextInput），無語音輸入與語音轉文字 | **未做**：提案 5.2.3 明確寫 "stating their grievance or venting **by voice**, which is then **transcribed into text** on the screen"。需加入語音輸入 + 語音轉文字（e.g. expo-speech 僅 TTS；STT 需另用 API 或 expo 相容套件） |
| Step 2：搖動裝置、accelerometer、文字銷毀動畫 | ✅ 已做：Accelerometer、shake 觸發、碎片動畫、Web 備用按鈕 | 無 |
| Step 3：呼吸動畫開合 **三次**、模擬深呼吸、調節副交感神經 | ✅ 已做：4-7-8 呼吸、圓形動畫、**3 個 cycle**（breathCycles >= 3）後進入 done | 無 |

---

## 四、Module 4: Gratitude Card Maker (Relationships)

| 提案描述 | 專案現況 | 差距 |
|----------|----------|------|
| 輸入對象（e.g. Mom, Classmate）與 keyword | ✅ 已做：recipient、keyword、模板生成內文 | 無 |
| 生成 **visually appealing image card**，**meme 或 sincere image**，**Canvas API** | 目前為 **ViewShot** 截圖卡片視圖（文字+主題色+emoji），無獨立「Canvas API」繪圖；風格為 **sincere**，**無 meme 風格** | **部分未做**：提案寫 "could be a **meme** or a sincere image" 與 "using the **Canvas API**"。可選：(1) 在報告中說明以 ViewShot 達成「生成圖片卡」產出，並註明 Canvas 為實作方式之一；(2) 若要完全對齊，可增加一種「meme」風格模板或使用 Canvas 繪圖 |
| 社交腳手架、利於 Gen Z 表達感恩 | ✅ 已做：靈感提示、多主題、儲存/分享 | 無 |

---

## 五、技術與架構（Section 5.1）

| 提案描述 | 專案現況 | 差距 |
|----------|----------|------|
| **React Native**，跨平台 | ✅ 已做：Expo / React Native，支援 web / iOS / Android | 無 |
| **Python** backend，**NLP and analysis-focused libraries** | 後端為 **Node.js (Express)**，使用 **OpenAI/Poe API** 做 LLM 對話，無 Python | **不一致**：提案 5.1 寫 "Python with NLP and analysis-focused libraries"。實務上 LLM 透過 API 即可，不一定要 Python；若報告/口試會被問，建議在報告中說明改為 Node.js + 外部 LLM API 以加快開發與部署，並維持 NLP（LLM）功能 |
| Client-side、user privacy | ✅ 前端為主，敏感資料依賴 Firebase/後端設定 | 無 |

---

## 六、結論與文件（Section 9）

| 提案描述 | 專案現況 | 差距 |
|----------|----------|------|
| Conclusion 寫四模組為 "**Assessment**, AI Coaching, **Health Tracking**, and Accomplishment" | 實際四模組為：AI Coach, Flow Timer, Somatic Shredder, Gratitude Card（無獨立 Assessment / Health Tracking） | **必改**：Conclusion 的模組名稱與 5.2 / Table 1 不一致，易被扣分。應改為與 5.2 一致的四個模組名稱 |

---

## 七、評估與附錄（非實作，僅提醒）

- **Proxy users、SUS、ABC、PERMA 問卷、adversarial testing**：屬評估計畫，非 app 功能，無需在專案內「做」；確保訪談/問卷有依附錄執行即可。
- **Appendix I 訪談大綱**：與 app 實作無直接對應，不需在程式裡實現。

---

## 優先順序建議

| 優先 | 項目 | 說明 |
|------|------|------|
| **高** | Conclusion 模組名稱 | 改為與 5.2 / Table 1 一致，避免審閱混淆 |
| **高** | Flow Timer 持久化 | AsyncStorage 存 XP、completedSessions、sessionLog（及可選徽章），重開 app 不歸零 |
| **中** | Somatic：語音宣洩 → 轉文字 | 提案明確寫 by voice + transcribed；實作目前僅打字。可加語音輸入+STT，或於報告中說明先以文字輸入實作、語音列為後續 |
| **中** | 後端技術說明 | 報告中說明以 Node.js + LLM API 取代 Python，並保留 NLP（LLM）角色 |
| **低** | AI Coach：Growth Mindset / values 範例 | 在 system prompt 加一句關鍵字或範例即可 |
| **低** | Gratitude：meme 風格 / Canvas | 可選；或報告中說明以 ViewShot 達成圖片產出 |

---

*本清單生成日期：依專案與提案 PDF 內容對照。若提案有修訂版，請以最新版為準再對照一次。*
