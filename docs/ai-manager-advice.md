# AI 主管建議（Gemini）

依每日回顧內容，讓 Gemini 以「務實、具體、可執行的 AI 主管」角色產出總評與行動建議。

## 功能目的

- 對每日回顧提供管理視角建議（**已提交與未完成草稿皆可呼叫**）
- 未完成草稿會出現在回顧日誌列表，呈現方式與已提交紀錄相同
- 呼叫前必須確認本機累計 API 用量，避免無意重複請求
- 支援在設定頁加入自訂 Prompt，調整角色、語氣與分析重點
- 回傳內容使用 Markdown 顯示，方便閱讀標題、清單與重點

## 觸發方式

1. 進入左側選單「回顧日誌」
2. 選取某一天的完整回顧
3. 於「AI 主管建議」區塊點「產生 AI 主管建議」或「重新產生」
4. 確認對話框會顯示：
   - 本次將消耗 **1 次**成功呼叫
   - 目前本機累計成功次數
   - 最後呼叫時間與模型名稱
5. 按「確認呼叫」後才會向 Gemini 發送請求

不會在「完成提交」時自動呼叫。

產生期間，按鈕與內容區會顯示動態載入提示；同一時間不會重複發送請求。

## Prompt 與 Context 組成

每次呼叫 API 都是獨立的單次請求，不會自動帶入其他日期的日誌或先前對話。API 的 `systemInstruction` 固定要求模型扮演務實的 AI 主管並使用繁體中文；使用者訊息中的 context 再依序由以下內容組成：

1. **自訂 Prompt（選填）**
   - 在「設定 → AI 主管 Prompt」輸入並儲存
   - 會放在內建 Prompt 前方
   - 適合指定角色、語氣、分析角度或輸出重點
   - 留空時只使用內建 Prompt
2. **內建 AI 主管指示**
   - 使用繁體中文
   - 語氣專業但不指責
   - 著重具體、可執行的下一步
   - 要求以 Markdown 輸出「總評」與「行動建議」
3. **所選日期的每日回顧**
   - 早上
   - 下午 1 點至 3 點
   - 下午 3 點後
   - 當日總結

自訂 Prompt 儲存在 `localStorage` 的 `bullet-journal-ai-manager-prompt`。按「清除所有資料」時會一併清除。

### 自訂 Prompt 範例

```text
請特別分析時間分配與阻塞原因，以直接、精簡的語氣提出明日最重要的三項行動。
```

自訂 Prompt 是附加指示，不會取代每日回顧內容或內建的基本輸出格式。

## 環境變數設定

1. 到 [Google AI Studio](https://aistudio.google.com/) 建立 API Key  
2. 在專案根目錄複製範例檔：

```bash
cp .env.example .env
```

3. 編輯 `.env`：

```env
VITE_GEMINI_API_KEY=你的_API_Key
VITE_GEMINI_MODEL=gemini-3.5-flash
```

4. **必須重新啟動** `npm run dev`（Vite 只在啟動時讀取 env）

`VITE_GEMINI_MODEL` 可省略，預設為 `gemini-3.5-flash`。

目前產生設定：

- `temperature: 0.6`
- `maxOutputTokens: 4096`
- `thinkingLevel: low`

`maxOutputTokens` 同時包含模型思考與實際輸出。使用 `low` 思考等級可降低簡單分析任務的思考 token 消耗，避免實際文字因 `MAX_TOKENS` 過早截斷。

## 回傳內容處理

- Gemini 回傳 Markdown 原文，存入 `aiManagerAdvice`
- 儲存前會移除行尾空白，並將三個以上的連續換行縮減為兩個
- 顯示時使用 `marked` 解析 Markdown
- 解析後使用 `DOMPurify` 過濾 HTML，降低不安全內容注入風險
- 目前支援標題、段落、編號／項目清單、粗體、引用及行內程式碼樣式

## 用量確認機制

| 項目 | 說明 |
|------|------|
| 本機計數 | `localStorage` key：`bullet-journal-gemini-usage` |
| 計入時機 | **僅成功**取得建議文字時 +1 |
| 設定頁 | 「設定 → Gemini 本機呼叫用量」可查看累計與最近錯誤 |
| 非 Google 帳單 | 本機數字 ≠ Google AI Studio／Cloud Billing 真實用量與配額 |

Gemini Plus／Google AI 訂閱**不包含** Developer API；API 有獨立免費額度與付費規則。

## 資料欄位與儲存

回顧物件（`bullet-journal-daily-reflections`）新增：

- `aiManagerAdvice`：建議文字
- `aiGeneratedAt`：產生時間（ISO）

用量物件（`bullet-journal-gemini-usage`）：

- `totalSuccessCalls`
- `lastCalledAt`
- `lastError`

清除所有任務資料時**不會**重置本機 API 用量，避免誤以為沒消耗過配額。

## 注意事項

- Vite 的 `VITE_*` 會打包進前端 bundle。**勿把含真實 Key 的 build 公開部署到網際網路**。Side project 本機使用即可；若要公開上線，應改為後端代理。
- `.env` 已列入 `.gitignore`，請勿把 Key commit 進版控。
- API Key 暴露在瀏覽器 DevTools／Network 中，僅適合個人本機開發情境。

## 疑難排解

| 狀況 | 建議 |
|------|------|
| 提示尚未設定 Key | 檢查 `.env` 是否有 `VITE_GEMINI_API_KEY`，並重啟 dev server |
| HTTP 403 | Key 無效、專案未啟用 API，或權限不足 |
| HTTP 429 | 達到速率／配額限制，稍後再試或至 Google AI Studio 查看用量 |
| 未回傳內容 | 模型忙碌或被安全過濾擋下，可重試或更換模型 |
| 回覆被截斷且 `finishReason` 為 `MAX_TOKENS` | 確認使用目前的 `maxOutputTokens: 4096` 與 `thinkingLevel: low` 設定 |
| 自訂 Prompt 未生效 | 確認已在設定頁按下「儲存 Prompt」；不需要重啟開發伺服器 |

## 相關程式

- [`src/utils/gemini.ts`](../src/utils/gemini.ts)：組合 Prompt、呼叫 API 及清理回傳文字
- [`src/utils/storage.ts`](../src/utils/storage.ts)：用量與自訂 Prompt 的 localStorage key
- [`src/stores/taskStore.ts`](../src/stores/taskStore.ts)：管理自訂 Prompt、寫入建議及記錄用量
- [`src/views/ReflectionLogView.vue`](../src/views/ReflectionLogView.vue)：確認呼叫、載入狀態及安全渲染 Markdown
- [`src/views/SettingsView.vue`](../src/views/SettingsView.vue)：自訂 Prompt 與本機用量總覽
