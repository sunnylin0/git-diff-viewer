# Releases

---
## [2026-10-26 10:25] 初始化 Git Log Diff GUI 需求規劃
- 建立專案紀錄與規格需求整理。
- 啟動 `/grill-with-docs` 訪談階段，釐清專案架構、目錄命名與執行機制。

---
## [2026-10-26 10:32] 完成 Grilling 訪談與架構領域模型建立
- 建立專案目錄 `c:\GitHub\ai\git-diff-viewer`。
- 建立領域模型術語表 [CONTEXT.md](file:///c:/GitHub/ai/git-diff-viewer/CONTEXT.md)。
- 建立架構決策 [ADR-0001](file:///c:/GitHub/ai/git-diff-viewer/docs/adr/0001-local-node-api-server.md)（Node.js 本地 API 服務器驅動）與 [ADR-0002](file:///c:/GitHub/ai/git-diff-viewer/docs/adr/0002-sequential-comparison-and-interaction-model.md)（序列鏈式比對與雙向聯動模型）。
- 確立實作計畫 [implementation_plan_log.md](file:///c:/GitHub/ai/history/implementation_plan_log.md)。

---
## [2026-10-26 11:20] v1.0.0 完成 Git Log Diff GUI 專案實作與驗證
- **新增專案**：在 `c:\GitHub\ai\git-diff-viewer` 建立極輕量 TypeScript + pnpm 專案。
- **後端 API (`src/server.ts`)**：提供 `/api/commits`、`/api/diff`、`/api/show` 端點，支援排除語法與記憶體快取。
- **前端介面 (`public/`)**：
  - 頂部支援 Target Repo 路徑與 `<exclude>` 排除模式輸入，按 Enter 或套用即刻重載。
  - 左側面板顯示所有節點（由遠到近排序），支援卡片點擊彈出 `git show --stat` Modal，每筆附帶「加入/移除」按鈕。
  - 右側面板支援鏈式比對，首筆為 `[基準]`，後續項目與前一項比對 `git diff --stat`；點擊右側卡片自動平滑滾動並高亮左側節點。
- **效能調優**：引入 Chunk Progressive Loading 與局部 DOM 更新，流暢支援近 3,000 筆提交歷史。
- **驗證成果**：透過瀏覽器代理人執行端到端互動測試，各項功能驗證通過並產出運行截圖。

---
## [2026-10-26 11:39] v1.1.0 支援 Git Log 提交節點 JSON 檔案持久化快取
- **後端快取持久化**：
  - 新增 `cache/` 目錄，針對 `targetRepo` 與 `<exclude>` 條件複合計算雜湊生成 `commits_<hash>.json`。
  - 當快取檔案存在時直接自硬碟讀取 JSON（響應從 ~10 秒降至 50ms 內）。
  - 當且僅當 `<exclude>` 條件變更或無對應快取檔時，才重新執行 `git log` 並持久化寫入檔案。
- **前端互動優化**：
  - Toast 標明載入來源為快取檔案。
  - 優化卡片點擊範圍判定，防止點擊按鈕邊界誤開 Inspector Modal。
- **領域與架構文檔**：新增 [ADR-0003](file:///c:/GitHub/ai/git-diff-viewer/docs/adr/0003-persistent-json-commit-cache.md)，更新 [CONTEXT.md](file:///c:/GitHub/ai/git-diff-viewer/CONTEXT.md)。

---
## [2026-10-26 12:36] v1.1.1 修復點擊「加入」後右側比對清單未顯示問題
- **修復 DOM 掛載**：修正 `renderRightPanel()` 中遺漏 `wrapper.appendChild(card)` 的問題，確保卡片正確放入容器。
- **即時非同步渲染**：改為點擊「加入」立即同步掛載右側卡片（0ms），後續相鄰節點的 diff 計算以 Promise 非同步填入，避免等待 network diff 造成畫面留空或卡死。
- **快取防護更新**：伺服器靜態資源加入 `Cache-Control: no-cache` 標頭，並於腳本加入版本標籤 `app.js?v=2.0` 防止載入過期腳本。




