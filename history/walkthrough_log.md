# Walkthrough Log

---
## [2026-10-26 11:18] Git Log Diff GUI 專案實作與驗證記錄

### 變更摘要 (Change Summary)
1. **專案建立與架構**：
   - 建立獨立目錄專案 [`c:\GitHub\ai\git-diff-viewer`](file:///c:/GitHub/ai/git-diff-viewer)。
   - 建立領域模型術語表 [`CONTEXT.md`](file:///c:/GitHub/ai/git-diff-viewer/CONTEXT.md)。
   - 建立架構決策 [`ADR-0001`](file:///c:/GitHub/ai/git-diff-viewer/docs/adr/0001-local-node-api-server.md) 與 [`ADR-0002`](file:///c:/GitHub/ai/git-diff-viewer/docs/adr/0002-sequential-comparison-and-interaction-model.md)。
2. **後端服務 (`src/server.ts`)**：
   - 原生 Node.js HTTP 伺服器，使用 `child_process.spawn` 執行 Git 指令。
   - 提供三組核心 API：
     - `GET /api/commits`: 執行 `git log --date=format:'%Y%m%d_%H%M' --format='%cd %h %s' --shortstat -- . <exclude>` 並轉由遠到近排序，內建記憶體快取加速。
     - `GET /api/diff`: 執行 `git diff --stat <from> <to> -- . <exclude>` 並解析變更檔案數、增刪行數。
     - `GET /api/show`: 執行 `git show --stat <commit> -- . <exclude>`。
     - 託管前端靜態資源。
3. **前端介面 (`public/index.html`, `public/styles.css`, `public/app.js`)**：
   - **頂部列**：Target Repo 路徑輸入框（預設 `c:\GitHub\ai\abcjs_663`）、Exclude Pattern 輸入框（預設 `':!bin/' ':!dist/' ':!node_modules/'`）、套用按鈕（Enter 觸發）。
   - **左側面板**：
     - 顯示所有提交節點（依時間遠到近排序，共 2879 筆）。
     - 格式精簡：`YYYYMMDD, <commitid>, <message>, <files>(files), <insertions>(+), <deletions>(-)`。
     - 提供「加入」與「移除」按鈕。
     - 點擊卡片主體彈出 Commit Inspector Modal。
     - 支援即時搜尋關鍵字過濾與虛擬/漸進式平滑滾動（Chunk Rendering）。
   - **右側面板**：
     - 首個節點標示 `[基準]`。
     - 後續節點與清單前一節點進行鏈式 Diff 比對，顯示格式：`YYYYMMDD, <commitid>, <files>(files), <insertions>(+), <deletions>(-)`。
     - 點擊右側卡片平滑滾動並高亮閃爍左側對應節點。
     - 每項提供「移除」按鈕，頂部提供「清空」按鈕。
   - **Commit Inspector Modal**：完整呈現 `git show --stat` 與複製 ID 功能。

### 驗證結果 (Verification)
- 透過瀏覽器子代理人（Browser Subagent）實測：
  - 成功載入 2879 筆提交節點。
  - 成功點擊「加入」節點至右側基準與鏈式比對清單。
  - 驗證左側卡片狀態同步切換為「移除」。
  - 驗證點擊節點開啟 Modal 顯示 `git show --stat` 輸出與關閉。
  - 截圖留存於 `working_gui_1792984535430.png`。

---
## [2026-10-26 11:38] JSON 檔案快取持久化實作與驗證記錄

### 變更摘要 (Change Summary)
1. **後端持久化快取 (`src/server.ts`)**：
   - 建立 `cache/` 目錄，透過 SHA256 計算 `repo` 與 `<exclude>` 之複合雜湊（如 `commits_6b5fc21d1189.json`）。
   - 請求 `/api/commits` 時優先檢查硬碟 JSON 快取檔案：
     - 若存在：直接以 `fs.readFileSync` 讀取並回傳，響應時間從原本 10 秒降至 50ms 內，附帶 `fromCache: true` 與檔名。
     - 若不存在：呼叫 `git log` 解析完成後，自動寫入 `cache/commits_<hash>.json`。
2. **前端 Toast 與互動精確化 (`public/app.js`)**：
   - Toast 提示精確標明來源（快取檔名或重新掃描生成）。
   - 優化卡片點擊範圍：只有點擊 `.node-body` 才會觸發 Commit Inspector Modal，點擊「加入」或按鈕週遭邊框不會誤開 Modal。

### 驗證結果 (Verification)
- 磁碟檔案檢驗：`git-diff-viewer/cache/commits_6b5fc21d1189.json` 成功生成（1,012,630 位元組，內含 2879 筆 commit）。
- 速度實測：PowerShell `Measure-Command` 測試快取命中耗時約 0.6 秒（包含 process 啟動與解析），前端 browser fetch 實測 40ms 完成。
- 瀏覽器端到端驗證：開啟頁面瞬間載入 2879 筆節點，加入節點比對運作流暢無阻塞。

---
## [2026-10-26 12:35] 右側比對清單未顯示問題除錯與修復 (Bug Fix)

### 故障原因 (Root Causes)
1. **DOM 節點未掛載**：`public/app.js` 的 `renderRightPanel()` 內遺漏了 `wrapper.appendChild(card)`，導致比較卡片 `card` 雖然在記憶體中建立，但未實際加入容器 `wrapper`，使右側清單留空。
2. **非同步阻塞問題**：原先 `for` 迴圈在 await `fetchDiff()` 完成前不會將 fragment 掛載至 `elRightNodeList`，若計算未完成會延遲甚至阻斷畫面渲染。
3. **瀏覽器靜態快取問題**：伺服器未設定 `Cache-Control` 標頭，導致前端頁面容易持續快取舊版腳本。

### 解決方案與修復 (Fix Applied)
1. **即時非同步渲染**：重構 `renderRightPanel()`，將卡片骨架即時（0ms）同步插入右側清單，第二筆及後續項目的 diff 計算則以 Promise 非同步填入，徹底避免畫面阻塞。
2. **修復 DOM 掛載與語法**：補全 `wrapper.appendChild(card)`，並確保所有代碼區塊正確閉合，通過 `node --check` 語法檢驗。
3. **快取防護**：伺服器靜態資源加入 `Cache-Control: no-cache, no-store, must-revalidate`，並在 `index.html` 的 script 標籤加入版本戳記 `app.js?v=2.0`。

### 驗證結果 (Verification)
- 透過瀏覽器代理人執行端到端實測，點擊第一筆與第二筆節點之「加入」按鈕，右側面板立即呈現：
  - `[基準] 20091214, 916bbc50, -(files), -(+), -(-)`
  - `↓ diff 20091215, b179164c, 5(files), 305(+), 254(-)`
- 驗證截圖留存於 `two_comparison_cards_1792989280914.png`。

---
## [2026-10-27 03:57] 左側清單作用中基準與 100 筆連續比對實作與驗證記錄

### 變更摘要 (Change Summary)
1. **樣式定義 (`public/styles.css`)**：
   - 新增 `.btn-action-base`：專屬琥珀金黃色邊框與 hover 光暈效果。
   - 新增 `.node-card.is-active-baseline`：金黃色背景漸層、高亮邊框與 `[基準]` 徽章。
   - 新增 `.node-card.is-range-compared`：冷紫色調漸層底色與高亮邊框，附帶序號徽章 `.range-order-badge`（#1, #2...）。
   - 新增 `.vs-baseline-tag`：醒目呈現與基準的累積 diff 統計（綠色新增、紅色刪除）。
2. **前端邏輯與批次並行比對 (`public/app.js`)**：
   - 擴充 `state` 支援 `activeBaselineCommit` 與 `rangeComparedMap`。
   - 在左側每個 commit card 新增 `<button data-action="set-base">` 按鈕。
   - 點擊基準按鈕即刻啟動 `setActiveBaseline()`，選取該節點後續最多 100 筆提交節點染上紫色。
   - 透過 `queueBatchDiffs()` 採用可控併發（6 worker）向 `/api/diff` 發送累積 diff 計算，即算即填入 DOM，不阻塞頁面。
   - 再次點擊已設定為基準的按鈕可立即呼叫 `clearBaseline()` 取消並還原預設樣式。
   - 右側比對清單完全保持原狀不動。
3. **版本防護 (`public/index.html`)**：
   - 更新前端 script 標籤為 `app.js?v=3.0`。
4. **領域與架構文檔**：
   - 更新 [CONTEXT.md](file:///c:/GitHub/ai/git-diff-viewer/CONTEXT.md)（新增 Active Baseline 與 Baseline Range Comparison 定義）。
   - 新增架構決策 [ADR-0004](file:///c:/GitHub/ai/git-diff-viewer/docs/adr/0004-active-baseline-range-comparison.md)。

### 驗證結果 (Verification)
- 透過瀏覽器子代理人（Browser Subagent）實測：
  - 開啟頁面後點擊第一筆提交之「基準」按鈕。
  - 第一筆卡片立即轉為金黃色高亮，顯示 `[基準]` 標記，按鈕切換為「取消基準」。
  - 後續節點全數染上冷紫色調，並依序呈現 `#2`, `#3`, `#4`... 等序號徽章。
  - 非同步累積 diff 迅速填入卡片（例如 `vs 基準: 4(files), 46(+), 5(-)`）。
  - 右側比對清單維持「尚未選取節點」，完全不受影響。
- 驗證截圖留存於 `baseline_activated_view_1793044653909.png`。

---
## [2026-10-27 04:33] 點擊「加入/移除」保留「基準」按鈕修復與驗證記錄

### 故障根因 (Root Cause)
- `addToCompare()` 與 `removeFromCompare()` 內部在切換左側卡片選取狀態時，直接將 `.node-actions` 的 `innerHTML` 覆寫為單一「加入」或「移除」按鈕，造成初始渲染的 `<button data-action="set-base">` 按鈕被沖刷遺失。

### 修復方案 (Fix Applied)
- 提取共用元件樣板函式 `renderCardActions(commitId, isSelected, isBaseline)`。
- 統一在 `renderNextChunk()`、`addToCompare()`、`removeFromCompare()` 調用，傳遞目前是否為基準節點狀態。
- 版本號更新至 `app.js?v=3.1`。

### 驗證結果 (Verification)
- 透過瀏覽器代理人實測驗證：
  1. 點擊「加入」：按鈕變換為「移除」，旁邊「基準」按鈕完整保留。
  2. 點擊「移除」：按鈕變換為「加入」，旁邊「基準」按鈕完整保留。
  3. 先點「基準」再點「加入/移除」：「取消基準」按鈕持續維持，不會被覆蓋。
- 驗證截圖留存於 `test_fix_button_preserved_1793046732078.png`。




