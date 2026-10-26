# 2. 比對節點序列鏈式比對與雙向聯動模型

Date: 2026-10-26

## Status
Accepted

## Context
在比對檢視（Right Panel）中，使用者選取多個提交節點時，需決定統計比對的基準對象。
同時需在左側列表（Left Panel）與右側比對清單（Right Panel）間建立直覺的操作引導（加入/移除、點擊聯動導航、Modal 查看）。

## Decision
1. **比較基準**：
   - 右側比對清單採**鏈式比對**（Sequential Chain Comparison）：第一個節點為 `[基準]`，後續每個節點與右側清單的前一個節點比對（`git diff --stat prev curr <exclude>`）。
2. **操作模型**：
   - 左側節點提供獨立的「加入」與「移除」按鈕；點擊節點文字區域彈出 Modal 檢視 `git show --stat`。
   - 右側節點點擊時，左側平滑滾動並高亮該節點；右側提供「移除」按鈕。
3. **頂部控制**：
   - 提供 Target Repo 輸入框（預設 `c:\GitHub\ai\abcjs_663`）與 Exclude Pattern 輸入框（預設 `':!bin/' ':!dist/' ':!node_modules/'`）。
   - 按下 Enter 或「套用」按鈕觸發重新查詢，右側選取清單保留並重新計算 diff。

## Consequences
- 優點：操作直觀，能清晰呈現自訂演進軌跡之累積變化；兩側面板聯動體驗流暢。
