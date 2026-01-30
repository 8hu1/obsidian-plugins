/**
 * X投稿リンク バッチ処理スクリプト
 * Usage: tp.user.processPickLinks(tp)
 *
 * VXTwitter API を使用してツイート内容を取得（認証不要）
 */

async function processPickLinks(tp) {
    const app = tp.app;
    const vault = app.vault;

    // utils読み込み
    const utils = tp.user.utils(tp);

    // 設定読み込み
    let settings;
    try {
        settings = await utils.getSettings();
    } catch (e) {
        return `> [!error] 設定エラー\n> ${e.message}`;
    }

    // Inbox/x-posts/picks フォルダを取得
    const picksFolder = vault.getAbstractFileByPath("Inbox/x-posts/picks");
    if (!picksFolder) {
        return `> [!warning] フォルダが見つかりません\n> \`Inbox/x-posts/picks\` フォルダを作成してください。`;
    }

    // 未処理ファイルを収集
    const unprocessedFiles = [];
    for (const file of picksFolder.children || []) {
        if (file.extension !== "md") continue;

        const metadata = app.metadataCache.getFileCache(file);
        const frontmatter = metadata?.frontmatter;

        if (!frontmatter?.status || frontmatter.status === "unprocessed") {
            unprocessedFiles.push(file);
        }
    }

    if (unprocessedFiles.length === 0) {
        return "✅ 処理するリンクファイルがありません";
    }

    // 結果記録
    const results = {
        totalLinks: 0,
        success: [],
        errors: []
    };

    // 各ファイルを処理
    for (const file of unprocessedFiles) {
        try {
            const content = await vault.read(file);

            // URLを抽出
            const urls = extractURLs(content);

            if (urls.length === 0) {
                results.errors.push({
                    file: file.name,
                    error: "URLが見つかりません"
                });
                continue;
            }

            results.totalLinks += urls.length;
            console.log(`Processing ${file.name}: ${urls.length} URLs found`);

            // 各URLを処理
            for (let i = 0; i < urls.length; i++) {
                const url = urls[i];

                try {
                    // ツイート内容を取得
                    const tweet = await fetchTweetContent(url);

                    // AI分析
                    const analysis = await analyzeContent(tweet, utils, settings);

                    // 新ファイル作成
                    const timestamp = tp.date.now("YYYY-MM-DD-HHmmss");
                    const sanitizedTitle = sanitizeFileName(analysis.title);
                    const newFileName = `${timestamp}-${sanitizedTitle}.md`;

                    // カテゴリフォルダ確認・作成
                    const categoryFolder = analysis.category;
                    await ensureFolderExists(vault, categoryFolder);

                    // ノート内容を生成
                    const newContent = formatNote(tweet, analysis, url);

                    // 新ファイル作成
                    const newPath = `${categoryFolder}/${newFileName}`;
                    await vault.create(newPath, newContent);

                    results.success.push({
                        url: url,
                        author: tweet.authorHandle,
                        title: analysis.title,
                        category: categoryFolder
                    });

                    // API制限対策: 少し待機
                    await sleep(1000);

                } catch (e) {
                    console.error(`Error processing URL ${url}:`, e);
                    results.errors.push({
                        url: url,
                        error: e.message
                    });
                }
            }

            // 元ファイルは削除せず保持
            console.log(`Processed: ${file.name}`);

        } catch (e) {
            console.error(`Error processing file ${file.name}:`, e);
            results.errors.push({
                file: file.name,
                error: e.message
            });
        }
    }

    // 結果レポート生成
    return generateReport(results);
}

/**
 * コンテンツからXのURLを抽出
 */
function extractURLs(content) {
    const urlRegex = /https?:\/\/(?:twitter\.com|x\.com)\/\w+\/status\/\d+/g;
    const urls = content.match(urlRegex) || [];
    // 重複を削除
    return [...new Set(urls)];
}

/**
 * VXTwitter API でツイート内容を取得
 */
async function fetchTweetContent(xUrl) {
    const match = xUrl.match(/(?:twitter\.com|x\.com)\/(\w+)\/status\/(\d+)/);
    if (!match) {
        throw new Error("Invalid URL format");
    }

    const [, username, tweetId] = match;
    const apiUrl = `https://api.vxtwitter.com/${username}/status/${tweetId}`;

    const response = await requestUrl({
        url: apiUrl,
        method: 'GET'
    });

    const data = response.json;

    return {
        text: data.text || "",
        authorName: data.user_name || username,
        authorHandle: data.user_screen_name || username,
        likes: data.likes || 0,
        retweets: data.retweets || 0,
        date: data.date || "",
        media: data.media_extended || []
    };
}

/**
 * ツイート内容を分析
 */
async function analyzeContent(tweet, utils, settings) {
    const prompt = `以下のXポストを分析して、以下の形式のJSONで返してください。JSONのみを返し、他の説明文は不要です：

{
  "title": "ノートのタイトル（30文字以内、簡潔に）",
  "summary": "3-5文程度の要約",
  "category": "Tech/Business/Personal/News/Other のいずれか",
  "tags": ["関連するタグを3-5個"],
  "priority": "high/medium/low",
  "keyPoints": ["重要なポイント1", "重要なポイント2", "..."]
}

カテゴリの判定基準：
- Tech: 技術、プログラミング、AI、IT関連
- Business: ビジネス、経済、マーケティング
- Personal: 個人的な考え、ライフスタイル
- News: ニュース、時事問題
- Other: その他

投稿者: ${tweet.authorName} (@${tweet.authorHandle})
投稿日時: ${tweet.date}
いいね: ${tweet.likes} / RT: ${tweet.retweets}

投稿内容：
${tweet.text}`;

    const response = await utils.callOpenAI(prompt, settings);
    return utils.extractJSON(response);
}

/**
 * ノートをフォーマット
 */
function formatNote(tweet, analysis, originalUrl) {
    const created = new Date().toISOString();
    const tagsYaml = analysis.tags.map(t => `  - ${t}`).join("\n");
    const keyPointsList = analysis.keyPoints.map((p, i) => `${i + 1}. ${p}`).join("\n");

    return `---
created: ${created}
source_url: ${originalUrl}
author: ${tweet.authorName}
author_handle: "@${tweet.authorHandle}"
posted_at: "${tweet.date}"
category: ${analysis.category}
priority: ${analysis.priority}
status: processed
tags:
${tagsYaml}
---

# ${analysis.title}

> **投稿者**: [${tweet.authorName}](https://x.com/${tweet.authorHandle}) (@${tweet.authorHandle})
> **投稿日時**: ${tweet.date}
> **URL**: [リンク](${originalUrl})

## 📝 要約
${analysis.summary}

## 🔑 重要なポイント
${keyPointsList}

## 📊 統計
- ❤️ いいね: ${tweet.likes.toLocaleString()}
- 🔁 リツイート: ${tweet.retweets.toLocaleString()}

---

## 📄 元のツイート

${tweet.text}

---

#x-post #summarized
`;
}

function sanitizeFileName(name) {
    return name
        .replace(/[\/\\:*?"<>|]/g, "")
        .replace(/\s+/g, "-")
        .substring(0, 50);
}

async function ensureFolderExists(vault, folderPath) {
    const folder = vault.getAbstractFileByPath(folderPath);
    if (!folder) {
        try {
            await vault.createFolder(folderPath);
        } catch (e) {
            if (!e.message.includes("Folder already exists")) {
                throw e;
            }
        }
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function generateReport(results) {
    const lines = ["# 処理完了\n"];

    lines.push(`## サマリー`);
    lines.push(`- **総リンク数**: ${results.totalLinks}件`);
    lines.push(`- **成功**: ${results.success.length}件`);
    lines.push(`- **エラー**: ${results.errors.length}件`);
    lines.push("\n## 詳細\n");

    if (results.success.length > 0) {
        lines.push("### ✅ 成功");
        for (const s of results.success) {
            lines.push(`- @${s.author}: ${s.title} → \`${s.category}/\``);
        }
        lines.push("");
    }

    if (results.errors.length > 0) {
        lines.push("### ❌ エラー");
        for (const e of results.errors) {
            const target = e.url || e.file;
            lines.push(`- ${target}: ${e.error}`);
        }
    }

    return lines.join("\n");
}

module.exports = processPickLinks;
