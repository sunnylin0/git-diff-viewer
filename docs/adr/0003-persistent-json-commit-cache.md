# 3. 基於 Exclude 條件的本地 JSON 提交快取持久化

Date: 2026-10-26

## Status
Accepted

## Context
在大型專案（例如 15 年歷史、近 3,000 筆提交紀錄）中，執行 `git log --shortstat` 耗時約需 8~10 秒。每次啟動伺服器或重新開啟頁面時若重複執行此指令，會大幅影響使用體驗。

## Decision
1. **持久化檔案快取**：
   - 伺服器在 `git-diff-viewer/cache/` 目錄下持久化儲存 `commits_<hash>.json` 檔案。
   - Hash 依據 `targetRepo` 與 `excludePattern` 計算。
2. **零介入透明載入**：
   - 使用者不需手動點選重整或清空快取。
   - 若對應的 JSON 快取檔案已存在，直接讀取檔案回傳（毫秒級）。
   - 當使用者修改 `<exclude>` 或更換 `<repo>`，且該組合尚無快取檔時，自動執行本機 `git log`，解析後自動寫入新的快取 JSON 檔案。

## Consequences
- 優點：初次掃描後，後續所有存取皆為 0ms 載入；即使重啟 Node 伺服器，快取依然存在。
- 權衡：若本地倉庫有新 commit，需變更 exclude 條件或刪除快取檔以觸發重新掃描。
