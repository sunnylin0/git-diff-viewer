# 1. 使用輕量 Node.js 本地 API 服務驅動 Git 指令

Date: 2026-10-26

## Status
Accepted

## Context
使用者需要一個 Git log 與 diff 的 HTML GUI 工具，對目標倉庫（如 `c:\GitHub\ai\abcjs_663`）進行視覺化檢視與比對。工具必須支援：
1. 動態輸入 `<exclude>` 排除條件並即時重新查詢。
2. 點擊提交節點即時彈出 `git show --stat <commitid> <exclude>`。
3. 選取節點加入右側進行與上一節點的 `git diff --stat <commitid> <parent_commitid> <exclude>` 比對。

純瀏覽器靜態頁面（`file://`）受限於瀏覽器安全沙盒無法直接呼叫本機 shell/git；而預先轉出靜態資料則無法支援動態輸入 exclude 與即時 diff 計算。

## Decision
我們決定在 `git-diff-viewer` 專案中建立輕量 Node.js (TypeScript + pnpm) 後端服務：
- 提供 REST API 端點執行本機 `git log`、`git show`、`git diff` 指令並回傳結構化 JSON 資料。
- 同時託管（Serve）前端 HTML/CSS/JS 介面。

## Consequences
- 優點：前端具有完全動態與即時查詢能力，無打包重量負擔，啟動速度極快。
- 缺點：使用者使用此工具前需要執行本機服務（例如 `pnpm dev`）。
