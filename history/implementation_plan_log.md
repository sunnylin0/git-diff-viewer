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
