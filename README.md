# College Explorer — 課徑 Course Compass

一個以清華大學與政治大學課程為示範資料的跨校課程探索、比較與推薦地圖系統。學生可以用課名、課號或自然語言概念尋找課程，理解課程之間的主題關聯，並建立自己的跨領域學習地圖。

## Why this project

大學課程資訊通常分散在不同校系與選課系統中，學生也不一定知道該使用哪些正式課程名稱搜尋。College Explorer 希望解決以下問題：

- 將「我想做 APP」之類的學習目標延伸成相關學術領域與課程。
- 呈現基礎、進階及跨領域課程之間的關係。
- 集中探索不同學校與系所的課程資訊。
- 讓推薦結果附帶可理解的原因，而不只是一個分數。
- 保存個人推薦地圖，協助後續學習規劃。

## Current MVP

- 清大 × 政大課程探索介面
- 關鍵字及本機概念字典搜尋
- 學校、課程層級與授課語言篩選
- 課程詳情、推薦原因與適合度呈現
- 兩門相容課程比較
- 互動式課程關聯地圖
- 亮色／暗色主題與響應式版面
- Cloudflare D1 課程資料與分批 bootstrap
- ChatGPT 登入使用者的推薦地圖儲存、載入、改名及刪除
- 課程、開課班次、主題與推薦地圖的 Drizzle schema/migrations

目前 seed 包含 3,043 筆來源紀錄，整理成 2,357 門課程（清大 2,353 門、政大示範資料 4 門）。

## Architecture

- Next.js 16 / React 19 / TypeScript
- Vinext + Vite
- Tailwind CSS / shadcn UI
- Cloudflare Workers + D1
- Drizzle ORM
- ChatGPT sign-in identity headers for user-owned maps

主要 API：

- `GET /api/courses`：課程分頁、搜尋與條件篩選
- `GET|POST /api/courses/bootstrap`：查詢及分批匯入 seed
- `GET|POST /api/maps`：取得及建立個人推薦地圖
- `PATCH|DELETE /api/maps/:id`：改名及刪除個人推薦地圖
- `POST /api/semantic-search`：預留 server-side embedding 整合介面

## Local development

需求：Node.js `>=22.13.0`。

```bash
npm run install:ci
npm run dev
```

開發伺服器預設使用 `http://127.0.0.1:5173`。本機可開啟以下路徑模擬 ChatGPT 登入：

```text
/signin-with-chatgpt?return_to=/
```

## Build and verification

```bash
npm run lint
npm run build
npm run start
```

目前 production build 可成功完成。Lint 仍有兩個 `react-hooks/set-state-in-effect` 錯誤及一個 hook dependency 警告，集中在 `app/page.tsx`。

## D1 migrations

產生 migration：

```bash
npm run db:generate
```

build 完成後，可依序將尚未套用的 migration 寫入本機 D1：

```bash
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_silly_apocalypse.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_lethal_gressill.sql
```

不要重複執行已經套用的 migration。

## Current limitations

- 語意搜尋目前使用前端概念字典，尚未執行真正的 embedding/vector search。
- 推薦分數與精選地圖部分內容仍為原型示範值。
- 推薦地圖尚未涵蓋全部 2,357 門課程。
- 收藏狀態尚未持久化。
- 政大目前只有少量示範資料。
- 尚未建立自動化測試。
- 課程 bootstrap API 上線前仍需加入管理權限限制。

## Roadmap

1. 匯入並清理完整政大課程資料。
2. 建立 embedding/vector index 與真正的語意檢索。
3. 將 prerequisite、開課學期與時段衝突加入推薦模型。
4. 產生可執行的逐學期學習路徑。
5. 持久化收藏與個人偏好。
6. 補齊測試、權限保護與資料品質監控。

> 推薦相似度不等同校方正式學分抵免認定；正式等價仍需由校方或人工審核。
