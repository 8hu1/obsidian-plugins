/**
 * 共通ユーティリティ関数
 * Usage: const utils = tp.user.utils(tp);
 */

async function getSettings() {
    const app = this.app;
    const settingsFile = app.vault.getAbstractFileByPath("Settings.json");

    if (!settingsFile) {
        throw new Error("Settings.json が見つかりません。Vaultルートに作成してください。");
    }

    try {
        const content = await app.vault.read(settingsFile);
        const settings = JSON.parse(content);

        if (!settings.openai_api_key) {
            throw new Error("Settings.json に openai_api_key が設定されていません。");
        }

        return {
            openai_api_key: settings.openai_api_key,
            // GPT-5系(gpt-5, gpt-5-mini, gpt-5-nano)またはGPT-4系に対応
            openai_model: settings.openai_model || "gpt-5-nano",
            max_tokens: settings.max_tokens || 2000
        };
    } catch (e) {
        if (e.message.includes("openai_api_key")) {
            throw e;
        }
        throw new Error("Settings.json の読み込みに失敗しました: " + e.message);
    }
}

/**
 * GPT-5系モデルかどうかを判定
 */
function isGPT5Model(model) {
    return model.startsWith("gpt-5");
}

/**
 * Responses API を使用してOpenAIを呼び出す (GPT-5系モデル用)
 */
async function callResponsesAPI(prompt, settings) {
    const response = await requestUrl({
        url: "https://api.openai.com/v1/responses",
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${settings.openai_api_key}`
        },
        body: JSON.stringify({
            model: settings.openai_model,
            instructions: "あなたは優秀な要約アシスタントです。日本語のX投稿を分析し、指定されたJSON形式で結果を返します。",
            input: prompt
        })
    });

    if (response.status !== 200) {
        console.error("OpenAI Responses API Error:", response.status, response.text);
        throw new Error(`API Error: ${response.status}`);
    }

    const data = response.json;
    // Responses APIのレスポンス形式に対応
    return data.output_text || data.output?.[0]?.content?.[0]?.text || "";
}

/**
 * Chat Completions API を使用してOpenAIを呼び出す (GPT-4系モデル用)
 */
async function callChatCompletionsAPI(prompt, settings) {
    const response = await requestUrl({
        url: "https://api.openai.com/v1/chat/completions",
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${settings.openai_api_key}`
        },
        body: JSON.stringify({
            model: settings.openai_model,
            messages: [
                {
                    role: "system",
                    content: "あなたは優秀な要約アシスタントです。日本語のX投稿を分析し、指定されたJSON形式で結果を返します。"
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0.3,
            max_tokens: settings.max_tokens
        })
    });

    if (response.status !== 200) {
        console.error("OpenAI Chat API Error:", response.status, response.text);
        throw new Error(`API Error: ${response.status}`);
    }

    const data = response.json;
    return data.choices[0].message.content;
}

/**
 * OpenAI API を呼び出す（モデルに応じて適切なAPIを選択）
 * - GPT-5系: Responses API
 * - GPT-4系: Chat Completions API
 */
async function callOpenAI(prompt, settings) {
    try {
        if (isGPT5Model(settings.openai_model)) {
            return await callResponsesAPI(prompt, settings);
        } else {
            return await callChatCompletionsAPI(prompt, settings);
        }
    } catch (e) {
        console.error("OpenAI API call failed:", e);
        throw new Error("OpenAI API呼び出しに失敗しました: " + e.message);
    }
}

function extractJSON(text) {
    // パターン1: ```json ... ``` で囲まれたコードブロック
    const codeBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
        try {
            return JSON.parse(codeBlockMatch[1]);
        } catch (e) {
            console.error("JSON parse error (code block):", e);
        }
    }

    // パターン2: {...} のJSONオブジェクト
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        try {
            return JSON.parse(jsonMatch[0]);
        } catch (e) {
            console.error("JSON parse error (object):", e);
        }
    }

    throw new Error("JSONの抽出に失敗しました: " + text.substring(0, 100));
}

function getMetadata(file) {
    return this.app.metadataCache.getFileCache(file);
}

function utils(tp) {
    return {
        app: tp.app,
        getSettings: getSettings,
        callOpenAI: callOpenAI,
        extractJSON: extractJSON,
        getMetadata: getMetadata
    };
}

module.exports = utils;
