# Task Log

---
## [2026-10-26 10:25] Git Log Diff GUI 專案啟動與 Grilling 訪談

### 目標 (Objectives)
針對 `c:\GitHub\ai\abcjs_663` 開發一個 Git Log Diff 的 GUI 介面工具（HTML/Web App）。

### 需求 (Requirements)
1. **頂部 (Top)**:
   - 輸入 `<exclude>` 排除條件輸入框（預設如 `':!bin/' ':!dist/' ':!node_modules/'`）。
2. **左側 (Left)**:
   - 節點列表：以時間由遠到近排序，執行 `git log --date=format:'%Y%m%d_%H%M' --format='%cd %h %s' --shortstat -- . <exclude>`。
   - 格式精簡為：`YYYYMMDD, <commitid>, <message>, <files>(files), <insertions>(+), <deletions>(-)`。
   - 點擊單一節點：彈出/展示該節點內容 `git show --stat <commitid> <exclude>`。
   - 選擇節點：可加入右側進行比較。
3. **右側 (Right)**:
   - 顯示從左側選入的節點列表。
   - 每個節點與其上一節點（parent commit）進行比較：`git diff --stat <commitid> <parent_commitid> <exclude>`。
   - 格式精簡為：`YYYYMMDD, <commitid>, <files>(files), <insertions>(+), <deletions>(-)`（不含 commit message）。
   - 點擊右側項目可跳轉定位至左側對應節點。

### 驗收標準 (Acceptance Criteria)
- 透過 grilling-with-docs 逐步確定架構、領域模型（`CONTEXT.md`）、技術選型與目錄結構。
- 確認後建立獨立專案目錄與實作。

---
## [2026-10-26 11:23] Git Log 節點持久化存入 JSON 檔案快取

### 目標 (Objectives)
避免每次啟動或載入都重新執行耗時的 `git log`，將左側節點列表結果持久化寫入 `*.json` 檔案。只有在 `<exclude>` 條件變更或指定強制重整時才重新執行 `git log` 並覆蓋/更新 JSON。

### 需求 (Requirements)
1. 查詢的 `git log` 節點列表寫入本機 JSON 檔案快取。
2. 每次載入時，若該 `<exclude>` 對應的 JSON 檔案存在且有效，直接從 JSON 讀取（毫秒級載入）。
3. 只有當使用者修改 `<exclude>` 條件，或該條件無快取檔時，才重新執行 `git log` 並更新 JSON 快取檔。

---
## [2026-10-27 03:50] 左側清單基準按鈕與 100 筆連續比對 (Active Baseline & Range Diff)

### 目標 (Objectives)
在左側提交節點卡片上的「加入」按鈕旁新增「[基準]」按鈕，以選定的基準 commit 為主，對後續 100 個連續節點進行固定基準比對並標示專屬色彩，右側面板維持原樣不動。

### 需求 (Requirements)
1. **按鈕設置**：在左側卡片的 `<button data-action="add">` 後方加入 `<button data-action="set-base">基準</button>`。
2. **基準狀態交互**：
   - 點擊卡片「基準」：將該卡片設為當前基準（Active Baseline），卡片呈現琥珀金黃色專屬高亮樣式與標記。
   - 再次點擊已是基準的卡片：取消基準狀態，清除所有比對標記。
   - 點擊其他卡片的「基準」：切換為新基準。
3. **100 筆連續比對**：
   - 自動將該基準後續的 100 個節點納入比對群組（若不足 100 筆則取至最新一筆）。
   - 比對方式：固定基準 1 對 N 比對，各比對節點執行 `git diff <基準commitID> <目標commitID> -- . <exclude>`。
   - 卡片色彩：100 張比對卡片套用專屬冷紫色調（與普通灰色、基準金黃色區隔）。
   - 資訊呈現：在卡片原本資訊後方以醒目標籤額外呈現「vs 基準: X(files), Y(+), Z(-)」。
4. **面板獨立性**：右側比對面板與鏈式比對清單保持不動。

### 驗收標準 (Acceptance Criteria)
- 左側每張卡片皆有「基準」按鈕。
- 點擊「基準」後，卡片變為金黃色，後續 100 筆卡片染上紫色。
- 100 筆紫色卡片非同步顯示與該基準的累積 diff 統計（files, +, -）。
- 再次點擊基準按鈕可取消並還原樣式；點擊其他卡片基準按鈕可平順轉移。
- 右側清單完全不受影響。

