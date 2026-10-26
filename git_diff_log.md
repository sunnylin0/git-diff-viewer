
我要做一個 git log diff 的 gui 程式html, 
- 在top
    - 輸入 <exclude> textbox => ':!bin/' ':!dist/' ':!node_modules/'
- 在left側顯示所有結點
    - 列出所有結點的 commitid  git log --date=format:'%Y%m%d_%H%M' --format='%cd %h %s' --shortstat -- . <exclude>
      ex:
      `20260424_1315 5dc285c5 Prepare 6.6.3 release 8 files changed, 260 insertions(+), 38 deletions(-)`
      簡化 `20260424, 5dc285c5, Prepare 6.6.3 release, 8(files), 260(+), 38(-)` 
    - 以時間排序，由遠到近    
    - 點擊其中一個結點，就跳出該分支 `git show --stat <commitid> <exclude>`
    - 選擇其中一個結點，可加入 right 側做比較
- 在right側
    - 列出 left 側選擇的結點來 
    - 列出是所有結點的比較與上一個結點做比較 
      `git diff --stat <commitid> <parent_commitid> <exclude>`
      簡化 `20260424, 5dc285c5, 8(files), 260(+), 38(-)` //不要說明
    - 點擊，會跳到 left 的顯示該結點上









我要做一個 git log diff 的 gui 程式html, 
- 在top
    - 輸入 <exclude> textbox => ':!bin/' ':!dist/' ':!node_modules/'
- 在left側顯示所有結點
    - 列出所有結點的 commitid  git log --date=format:'%Y%m%d_%H%M' --format='%cd %h %s' --shortstat -- . <exclude>
      ex:
      `20260424_1315 5dc285c5 Prepare 6.6.3 release 8 files changed, 260 insertions(+), 38 deletions(-)`
      簡化 `20260424, 5dc285c5, Prepare 6.6.3 release, 8(files), 260(+), 38(-)` 
    - 以時間排序，由遠到近    
    - 選擇其中一個結點，可加入 right 側做比較
    - 
- 在right側列表
    - 會由 left 側選擇的結點來
    - 列出是所有結點的比較

