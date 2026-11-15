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
- Email／密碼註冊、登入與安全工作階段（PBKDF2 + HttpOnly cookie）
- 政大成績單 PDF／圖片 OCR、課程比對、人工確認與保存
- 課程、開課班次、主題與推薦地圖的 Drizzle schema/migrations

目前課程探索資料共 4,799 門：清大 2,353 門、政大 2,446 門。清大基本課表來自校方每日更新的開放 JSON，並以 NTHUMods 公開索引補充 1,872 門可取得的課程大綱；政大資料則包含歷年代表課程、簡介、目標與大綱連結。Dcard 資料已合併進 `data/dcard`（72 筆課程心得、30 筆教師心得），尚待接入正式課程頁與推薦模型。

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
- `POST /api/auth/register|login|logout`、`GET /api/auth/me`：帳號與登入工作階段
- `POST /api/ocr/transcript`：成績單 OCR 與政大課程比對
- `GET|POST /api/transcripts`：列出及保存使用者確認後的成績單課程

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

要啟用真正的成績單 OCR，請在 Cloudflare Worker secret 設定 `OPENAI_API_KEY`；可選擇以 `OPENAI_OCR_MODEL` 指定支援影像與 PDF 的模型。未設定金鑰時，前端仍可用範例辨識結果測試完整確認流程。原始成績單只傳送給 OCR API，不會寫入 D1；D1 僅保存使用者確認後的課程列。

更新清大資料：

```bash
node scripts/refresh-nthu-course-seed.mjs
node scripts/refresh-nthu-course-syllabi.mjs
```

第一步下載清大官方每日開放課程 JSON 並保留政大資料；第二步以可續傳快取補充公開課程大綱。清大官方查詢頁有圖片驗證碼，因此大綱更新使用 NTHUMods 所整理的公開索引，並在每筆課程保留來源標示。

## Build and verification

```bash
npm run lint
npm run build
npm run start
```

目前 TypeScript、lint 與 production build 均可成功完成。

## D1 migrations

產生 migration：

```bash
npm run db:generate
```

build 完成後，可依序將尚未套用的 migration 寫入本機 D1：

```bash
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_silly_apocalypse.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_lethal_gressill.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_sloppy_risque.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0003_fearless_unicorn.sql
```

不要重複執行已經套用的 migration。

## Current limitations

- 語意搜尋目前使用前端概念字典，尚未執行真正的 embedding/vector search。
- 推薦分數與精選地圖部分內容仍為原型示範值。
- 學習地圖目前使用精選關聯課程，尚未為全部 4,799 門課建立完整圖譜。
- 清大仍有 481 門課在公開大綱索引中沒有可用的簡介文字，介面會保留校方查詢入口。
- 收藏狀態尚未持久化。
- Dcard 心得目前是 CSV 資料，尚未建立匯入表、課程對應與前端顯示。
- 正式上線前仍需加入註冊／登入 rate limit、Email 驗證及忘記密碼流程。
- 真正 OCR 需部署環境提供 `OPENAI_API_KEY`，目前無金鑰時使用前端範例資料。
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
