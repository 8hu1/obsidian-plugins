---
type: system
created: <% tp.date.now("YYYY-MM-DD HH:mm") %>
---

# X投稿リンク処理

実行日時: <% tp.date.now("YYYY-MM-DD HH:mm:ss") %>

## 処理結果

<%*
const result = await tp.user.processPickLinks(tp);
tR += result;
%>

---

次回実行: Cmd + P → "Templater: Insert Template" → "Process Pick Links"
