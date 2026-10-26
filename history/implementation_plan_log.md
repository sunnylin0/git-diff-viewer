# Implementation Plan Log

---
## [2026-10-26 10:31] Git Diff Viewer 實作計畫

### 影響範圍與檔案 (Affected Files)
- `c:\GitHub\ai\git-diff-viewer\package.json`
- `c:\GitHub\ai\git-diff-viewer\tsconfig.json`
- `c:\GitHub\ai\git-diff-viewer\src\server.ts` (極輕量 Node.js API 伺服器，使用 `child_process.spawn` 執行 git)
- `c:\GitHub\ai\git-diff-viewer\public\index.html` (現代流暢雙欄 UI)
- `c:\GitHub\ai\git-diff-viewer\public\styles.css` (深色/簡約高質感現代設計)
- `c:\GitHub\ai\git-diff-viewer\public\app.ts` 或 `app.js` (前端互動邏輯、狀態管理、API 呼叫與 Modal)

### 實作步驟 (Step-by-Step Plan)
1. **專案初始化**:
   - 在 `c:\GitHub\ai\git-diff-viewer` 設定 `package.json`、`tsconfig.json`，使用 pnpm 安裝極少相依（例如 `tsx` 供快速啟動）。
2. **後端 API 伺服器 (`src/server.ts`)**:
   - 提供 API:
     - `GET /api/commits?repo=<path>&exclude=<patterns>`: 執行 `git log --date=format:'%Y%m%d_%H%M' --format='%cd %h %s' --shortstat -- . <exclude>` 並反向排序（由遠到近），解析為結構化 JSON。
     - `GET /api/show?repo=<path>&commit=<hash>&exclude=<patterns>`: 執行 `git show --stat <commit> <exclude>`。
     - `GET /api/diff?repo=<path>&from=<hash>&to=<hash>&exclude=<patterns>`: 執行 `git diff --stat <from> <to> <exclude>`。
   - 託管靜態檔案 (`public/`)。
3. **前端 UI 與樣式 (`public/index.html`, `public/styles.css`)**:
   - 頂部導航列：Repo Path、Exclude Pattern 輸入框、套用按鈕。
   - 左右雙欄佈局：
     - 左欄：提交節點列表（依時間由遠到近），格式 `YYYYMMDD, <commitid>, <message>, <files>(files), <insertions>(+), <deletions>(-)`，提供「加入」、「移除」按鈕，點擊彈出 Modal。
     - 右欄：已選節點清單，首項標註 `[基準]`，後續項顯示與前一節點之 `git diff` 統計，點擊跳轉定位至左側節點，提供「移除」按鈕。
   - Modal 檢視彈窗：展示完整 `git show --stat` 輸出與統計圖示。
4. **測試與驗證**:
   - 啟動伺服器，驗證對 `c:\GitHub\ai\abcjs_663` 的歷史日誌查詢、exclude 排除過濾、加入/移除節點、相鄰節點 diff 計算、以及點擊導航與 modal 彈窗。

---
## [2026-10-26 11:25] JSON 檔案快取持久化實作計畫

### 影響範圍與檔案 (Affected Files)
- `c:\GitHub\ai\git-diff-viewer\src\server.ts`
- 快取目錄：`c:\GitHub\ai\git-diff-viewer\cache/`

### 實作步驟 (Step-by-Step Plan)
1. **快取目錄與 Hash 機制**：
   - 確保 `git-diff-viewer/cache/` 目錄存在。
   - 使用 Node.js `node:crypto` 對 `repo` 與 `exclude` 計算 SHA256 生成短雜湊，產生檔案路徑 `cache/commits_<hash>.json`。
2. **查詢策略**：
   - 每次請求 `/api/commits` 時：
     1. 檢查對應快取檔是否存在。
     2. 若存在，讀取檔案內容並直接 JSON 回傳。
     3. 若不存在，執行 `git log`，取得輸出並解析為 `CommitNode[]`。
     4. 將結構化結果與元資料寫入 `cache/commits_<hash>.json`。
3. **驗證**：
   - 首次載入觸發寫入 JSON。
   - 重啟伺服器後再次請求，驗證直接讀取 JSON 檔案，響應時間在 10ms 內完成。

---
## [2026-10-27 03:52] 左側基準按鈕與 100 筆比對實作計畫

### 影響範圍與檔案 (Affected Files)
- `c:\GitHub\ai\git-diff-viewer\public\index.html`
- `c:\GitHub\ai\git-diff-viewer\public\styles.css`
- `c:\GitHub\ai\git-diff-viewer\public\app.js`

### 實作步驟 (Step-by-Step Plan)
1. **樣式定義 (`styles.css`)**：
   - 增加按鈕樣式 `.btn-baseline`（預設琥珀金黃色調邊框）。
   - 增加卡片狀態樣式：
     - `.node-item.is-active-baseline`：琥珀金黃背景漸層、高亮邊框與「基準」徽章。
     - `.node-item.is-range-compared`：冷紫/藍紫邊框、漸層底色與微光效果。
     - `.vs-baseline-tag`：卡片資訊列中的醒目累積 diff 標籤（綠色新增/紅色刪除）。
2. **前端邏輯與狀態 (`app.js`)**：
   - 狀態管理：新增 `activeBaselineCommit = null` 與 `rangeComparedCommits = new Set()`。
   - DOM 生成：在 `renderCommitItem()` 的「加入」按鈕旁新增 `<button class="btn-baseline" data-action="set-base">基準</button>`。
   - 點擊事件處理：
     - 若點擊已是基準的節點，呼叫 `clearBaseline()` 清除狀態與樣式。
     - 若點擊其他節點，呼叫 `setActiveBaseline(commitId)`：
       1. 找出該節點在 `allCommits` 中的索引 `idx`。
       2. 取出 `allCommits.slice(idx + 1, idx + 101)` 作為比對目標。
       3. 更新 DOM 卡片樣式（基準卡設為金黃、100 筆設為紫色）。
       4. 非同步發送 `fetchDiff(baselineCommit, targetCommit)`，並動態將結果填入卡片上的 `.vs-baseline-tag`。
       5. 透過記憶體快取避免重複查詢相同組合。
   - 虛擬/分頁滾動支援：確保當使用者向下滾動時，`appendChunk()` 能依照目前的 `activeBaselineCommit` 正確為後續 100 筆渲染紫色樣式與標籤。
3. **驗證與測試**：
   - 重新整理頁面，點擊某一 commit（例如 `7f5b8df` 或歷史節點）的「基準」按鈕。
   - 驗證該卡片轉為金黃色，後續 100 筆卡片染上紫色並陸續顯示 `vs 基準: X(files), Y(+), Z(-)`。
   - 驗證右側清單完全不受影響。
   - 驗證再次點擊可取消基準；點擊新節點可順暢切換。

---
## [2026-10-27 04:31] 按鈕保留修復實作計畫

### 影響範圍與檔案 (Affected Files)
- `c:\GitHub\ai\git-diff-viewer\public\app.js`
- `c:\GitHub\ai\git-diff-viewer\public\index.html` (更新版本號 app.js?v=3.1)

### 實作步驟 (Step-by-Step Plan)
1. **問題根因診斷**：
   - `addToCompare()` 與 `removeFromCompare()` 中，直接以 `actions.innerHTML = <button ...>移除</button>` 覆蓋了整個 `.node-actions` 容器，導致原本渲染在內的 `<button data-action="set-base">` 被抹除。
2. **重構與修復**：
   - 提取共用函式 `renderCardActions(commitId, isSelected, isBaseline)`。
   - 在 `renderNextChunk()`、`addToCompare()`、`removeFromCompare()` 統一使用此共用函式產生操作按鈕。
   - 保留基準當前狀態（判斷 `state.activeBaselineCommit === commitId`）。
3. **驗證**：
   - 透過瀏覽器實測點擊「加入」->「移除」->「設為基準」->「加入/移除」，確認「[基準]」與「[取消基準]」按鈕全程保留不消失。


