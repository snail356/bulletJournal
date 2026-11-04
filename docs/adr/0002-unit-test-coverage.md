# 單元測試與 Coverage

狀態：已接受  
日期：2026-11-03

## 背景

專案已用 Vitest 跑 `tests/**/*.spec.ts`，但沒有 Coverage 報表，也尚未覆蓋本機儲存、Gemini 前端呼叫、狀態正規化、導覽功能與備份排程等核心純邏輯。

## 決定

- 繼續使用 **Vitest**（含 happy-dom、`@vue/test-utils`），不改 Jest。
- 安裝 `@vitest/coverage-v8`，以 `npm run test:coverage` 產出文字與 HTML 報表。
- **不設 Coverage 百分比門檻**；報表用來找缺口，測試失敗只因斷言失敗。
- 第一批補測：`storage`、`gemini`（mock `fetch`）、`status`、`navFeatures`、`backupPrefs`。
- 暫不把 `taskStore`、備份 ZIP、IndexedDB 實作納入這一輪。

## 後果

執行測試：`npm test`  
監看模式：`npm run test:watch`  
Coverage：`npm run test:coverage`（HTML 在 `coverage/index.html`）

之後 AI 應依 `.cursor/rules/unit-tests.mdc` 在改邏輯時補測並跑 `npm test`。
