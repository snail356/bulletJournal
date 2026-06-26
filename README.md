# Bullet Journal 工作狀態紀錄

Vue 3 + Vite + TypeScript 前端專案，用於每日工作任務追蹤。

## 技術棧

- Vue 3 (Composition API)
- Vite
- TypeScript
- Pinia
- Vue Router
- SCSS

## 快速開始

```bash
npm install
npm run dev
```

## 頁面

| 路由 | 說明 |
|------|------|
| `/today` | 今日任務（完整互動） |
| `/tasks` | 所有任務，可依狀態篩選 |
| `/tasks/:id` | 任務詳情 |
| `/labels` | 標籤管理 |
| `/stats` | 統計分析 |
| `/settings` | 設定 |

## 資料儲存

所有資料儲存於瀏覽器 `localStorage`，首次載入使用 mock 假資料。未完成任務會在隔天自動延續至新日期。

## 功能亮點

- 主任務 / 子任務 / 備註管理
- 圖片上傳、Ctrl+V 貼上、右鍵選單貼圖
- 完成任務自動排序至清單底部
- 左側小日曆與今日進度圓環
- 刪除任務支援復原 Toast
