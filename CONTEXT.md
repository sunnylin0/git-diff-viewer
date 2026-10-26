# Domain Context: Git Diff Viewer

## Terms

### Target Repo (目標倉庫)
被檢視與比較的本機 Git 專案目錄路徑（預設帶入 `c:\GitHub\ai\abcjs_663`）。
- 介面：頂部路徑輸入框，可手動輸入切換檢視不同的本地 Git 倉庫。

### Exclude Pattern (排除模式, `<exclude>`)
Git pathspec 排除規則字串（例如 `':!bin/' ':!dist/' ':!node_modules/'`），用於在查詢歷史與比較差異時過濾建置產物或相依套件。
- 介面與觸發：頂部文字輸入框，支援按下 Enter 鍵或點擊「套用 (Apply)」按鈕更新。
- 關聯響應：套用新規則後，左側提交節點列表重新查詢；右側已加入的比對節點保留，並依新規則自動重新發送 `git diff` 計算更新統計數據。

### Commit Node (提交節點)
Git 歷史歷程中的單一 commit 紀錄項目。
- 特性：包含日期時間（格式為 `YYYYMMDD_HHmm` 顯示為 `YYYYMMDD`）、Commit ID、訊息摘要（Subject）、異動檔案數（files）、新增行數（+）、刪除行數（-）。
- 排序：在左側面板中依時間由遠到近（Oldest to Newest）排序。
- 操作：
  - 點擊節點本體：開啟 **Node Inspector** 檢視該節點的 `git show --stat` 詳細內容。
  - **加入按鈕**：將此節點加入右側比對清單。
  - **移除按鈕**：若此節點已在右側清單，將其自比對清單中移除。

### Comparison Node (比較節點)
從左側「提交節點」清單加入至右側比對面板的目標節點。
- 特性：
  - **首個節點（Baseline）**：標示為 `[基準]`，不計算 diff（異動統計顯示 `-` 或 `0 files`）。
  - **後續節點**：計算與「右側清單中其前一個節點」的 diff 統計（即 `git diff --stat <prev_node_commit> <current_node_commit> <exclude>`）。
  - 項目顯示精簡資訊：`YYYYMMDD, <commitid>, <files>(files), <insertions>(+), <deletions>(-)`（不含 commit 訊息摘要）。
  - 點擊右側項目可高亮並滾動定位回左側對應的「提交節點」。
  - 每個項目亦提供「移除」按鈕可將其從比對面板移除。

### Node Inspector (節點檢查檢視)
點擊單一提交節點時彈出的詳細檢視（Modal 對話框），展示該 commit 的 `git show --stat <commitid> <exclude>` 完整統計與檔案變更差異。

### Commit Cache File (提交快取檔)
將提交節點列表持久化儲存於硬碟的 JSON 檔案（位於 `git-diff-viewer/cache/commits_<hash>.json`）。
- 鍵值產生：依據 Target Repo 路徑與 Exclude Pattern 共同計算雜湊值（例如 `commits_a1b2c3d4.json`）。
- 命中判定：檔案存在時直接載入回傳，避免重複執行耗時的 `git log`；檔案不存在或使用者點擊「強制重整」時才重新調用 git 並刷新 JSON。
- 檔案內含元資料：包含產生時間戳記（timestamp）、repo 路徑、exclude 規則字串、節點數量及完整節點資料。

### Active Baseline (作用中基準節點)
在左側提交節點清單中，透過卡片上的「基準」按鈕選定的單一基準 commit。
- 視覺：套用專屬金黃/琥珀色高亮樣式與「基準」徽章。
- 操作：點擊未設定為基準的卡片時立即將其設為當前基準；點擊已是基準的卡片則取消基準狀態並清除範圍比對標記。

### Baseline Range Comparison (基準範圍連續比對)
當 Active Baseline 確立後，左側列表中時間緊隨其後的 100 個提交節點所構成的比對群組。
- 比對模型：固定 1 對 N 比對（每筆均執行 `git diff <base_commit> <current_commit> -- . <exclude>`），觀察自基準節點以來的累積差異。
- 視覺：100 張卡片統一套用專屬冷紫色/藍紫色高亮邊框與標記，與普通暗灰卡片及金黃基準卡清晰區隔。
- 資訊呈現：在原有卡片資訊後方，額外標註「vs 基準: X(files), Y(+), Z(-)」標籤，透過非同步機制計算填入。
- 獨立性：此操作完全在左側面板呈現，右側面板維持既有狀態不動。

