#!/usr/bin/env python3
"""
タグ正規化スクリプト
重複・類似タグを統一して、Obsidianグラフビューを改善

Usage:
    python3 normalizeTags.py           # ドライラン（変更を確認）
    python3 normalizeTags.py --execute # 実際に変更を適用
"""

import os
import re
import sys
import yaml
from pathlib import Path

# タグ正規化マッピング
# キー: 変換前のタグ
# 値: 変換後のタグ (Noneの場合は削除)
TAG_MAPPING = {
    # ========================================
    # AI/LLM Core - AIに統一
    # ========================================
    "生成AI": "AI",
    "AI活用": "AI",
    "AI 活用": "AI",
    "AI 導入": "AI導入",
    "AI 研究": "AI研究",
    "AI 規制": "AI規制",
    "AI 設計": "AI設計",
    "AI 評価": "AI評価",
    "AI 開発": "AI開発",
    "AI ツール": "AIツール",
    "AI モデル": "AIモデル",
    "AI 収 益 性": "AI収益性",
    "AI 基本法": "AI規制",
    "AI 安全性": "AIセキュリティ",
    "AI ロボット": "AIロボット",
    "AI 字幕翻訳": "AI翻訳",
    "AI エンジニア": "AIエンジニア",
    "AI アシスタント": "AIアシスタント",
    "AI エージェント": "AIエージェント",
    "AI セキュリティ": "AIセキュリティ",
    "AI 旅行エージェント": "AIエージェント",
    "AI ペアプログラミング": "AIコーディング",

    # ========================================
    # LLM関連
    # ========================================
    "大規模言語モデル": "LLM",
    "言語モデル": "LLM",
    "Recursive Language Models": "LLM",
    "MobileLLM-Pro": "LLM",
    "dLLM": "LLM",

    # ========================================
    # エージェント関連 - AIエージェントに統一
    # ========================================
    "エージェント": "AIエージェント",
    "マルチエージェント": "AIエージェント",
    "自律型エージェント": "AIエージェント",
    "汎用AIエージェント": "AIエージェント",
    "Agent Skills": "AIエージェント",
    "AgentKit": "AIエージェント",
    "AgentsSDK": "AIエージェント",
    "the-agent": "AIエージェント",
    "Terminal agent": "AIエージェント",
    "ClaudeAgent": "Claude",

    # ========================================
    # 知識グラフ - KnowledgeGraphに統一
    # ========================================
    "知識グラフ": "KnowledgeGraph",
    "Knowledge Graph": "KnowledgeGraph",
    "ContextGraph": "KnowledgeGraph",
    "PropertyGraph": "KnowledgeGraph",
    "GraphDatabase": "KnowledgeGraph",
    "GraphQA": "KnowledgeGraph",
    "Graph探索": "KnowledgeGraph",
    "グラフ探索": "KnowledgeGraph",
    "グラフアルゴリズム": "KnowledgeGraph",

    # ========================================
    # 自動化 - 自動化に統一
    # ========================================
    "Automation": "自動化",
    "ワークフロー": "自動化",
    "Workflow": "自動化",
    "業務効率化": "自動化",
    "業務改善": "自動化",
    "効率化": "自動化",

    # ========================================
    # プロンプト関連
    # ========================================
    "プロンプト設計": "プロンプト",
    "プロンプト最適化": "プロンプト",
    "プロンプトインジェクション": "AIセキュリティ",
    "システムプロンプト": "プロンプト",

    # ========================================
    # OCR関連 - OCRに統一
    # ========================================
    "LightOnOCR": "OCR",
    "DeepSeek-OCR": "OCR",
    "高精度OCR": "OCR",

    # ========================================
    # ドキュメント処理
    # ========================================
    "Document AI": "ドキュメント処理",
    "DocumentParsing": "ドキュメント処理",
    "Agentic Document Extraction": "ドキュメント処理",
    "ドキュメント管理": "ドキュメント処理",
    "ドキュメント作成": "ドキュメント処理",
    "テキスト抽出": "ドキュメント処理",
    "データ抽出": "ドキュメント処理",
    "PDF検索": "PDF",
    "PDF変換": "PDF",
    "PDF編集": "PDF",

    # ========================================
    # 企業名の正規化
    # ========================================
    "NVidia": "NVIDIA",
    "openai": "OpenAI",
    "anthropic": "Anthropic",
    "ClaudeCode": "Claude",
    "Claude Code": "Claude",
    "ClaudeCowork": "Claude",
    "OpenClaudeCowork": "Claude",
    "ClawdBot": "Claude",
    "Opus4.5": "Claude",
    "Gemini CLI": "Gemini",
    "Gemini Flash": "Gemini",
    "GPT-5": "OpenAI",
    "GPT-5.2": "OpenAI",
    "GPT-4": "OpenAI",
    "o3-mini": "OpenAI",
    "ChatGPT": "OpenAI",
    "Llama4": "Llama",
    "LlamaParse": "Llama",
    "Qwenモデル": "Qwen",
    "GLM-4.7": "GLM",
    "glm-4.7": "GLM",

    # ========================================
    # 開発ツール
    # ========================================
    "オープンソース": "OpenSource",
    "開発環境": "開発",
    "開発ツール": "開発",
    "開発ガイドライン": "開発",
    "コード実行": "開発",
    "CI/CD": "DevOps",
    "デプロイ": "DevOps",
    "コンテナ": "DevOps",

    # ========================================
    # n8n関連
    # ========================================
    "n8n 2.0": "n8n",
    "n8n-2.0": "n8n",

    # ========================================
    # 不要なタグ（削除）
    # ========================================
    "記事": None,
    "リンク": None,
    "リンク共有": None,
    "情報提供": None,
    "情報共有": None,
    "不明": None,
    "記事紹介": None,
    "最新情報": None,
    "x-post": None,
    "summarized": None,
    "話題": None,

    # ========================================
    # ビジネス関連
    # ========================================
    "マーケティング": "ビジネス",
    "コンテンツマーケティング": "ビジネス",
    "ビジネス戦略": "ビジネス",
    "ビジネスモデル": "ビジネス",
    "ビジネス自動化": "ビジネス",
    "企業業務": "ビジネス",

    # ========================================
    # 学習関連
    # ========================================
    "無料講座": "学習",
    "学習動画": "学習",
    "マスタークラス": "学習",
    "図解": "学習",
    "技術解説": "学習",
    "ベストプラクティス": "学習",
}

# 処理対象フォルダ
FOLDERS = ['Business', 'News', 'Other', 'Personal', 'Tech']


def normalize_tag(tag):
    """タグを正規化"""
    tag = str(tag).strip()
    if tag in TAG_MAPPING:
        return TAG_MAPPING[tag]
    return tag


def process_file(filepath, dry_run=True):
    """ファイルのタグを正規化"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # frontmatterを抽出
    match = re.match(r'^---\n(.*?)\n---\n', content, re.DOTALL)
    if not match:
        return None

    frontmatter_str = match.group(1)
    try:
        frontmatter = yaml.safe_load(frontmatter_str)
    except Exception:
        return None

    if not frontmatter or 'tags' not in frontmatter:
        return None

    original_tags = frontmatter['tags']
    if not isinstance(original_tags, list):
        return None

    # タグを正規化
    normalized_tags = []
    for tag in original_tags:
        new_tag = normalize_tag(tag)
        if new_tag is not None and new_tag not in normalized_tags:
            normalized_tags.append(new_tag)

    if normalized_tags == original_tags:
        return None

    changes = {
        'file': filepath,
        'before': original_tags,
        'after': normalized_tags
    }

    if not dry_run:
        # frontmatterを更新
        frontmatter['tags'] = normalized_tags
        new_frontmatter = yaml.dump(
            frontmatter,
            allow_unicode=True,
            default_flow_style=False,
            sort_keys=False
        )
        rest_of_content = content[match.end():]
        new_content = f"---\n{new_frontmatter}---\n{rest_of_content}"

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)

    return changes


def main():
    dry_run = '--execute' not in sys.argv
    base_dir = os.getcwd()

    print(f"Base directory: {base_dir}")
    print(f"Mode: {'DRY RUN (use --execute to apply changes)' if dry_run else 'EXECUTE'}")
    print()

    all_changes = []

    for folder in FOLDERS:
        folder_path = os.path.join(base_dir, folder)
        if not os.path.exists(folder_path):
            continue

        for filename in os.listdir(folder_path):
            if filename.endswith('.md'):
                filepath = os.path.join(folder_path, filename)
                changes = process_file(filepath, dry_run)
                if changes:
                    all_changes.append(changes)

    # レポート出力
    print(f"=== タグ正規化レポート ===")
    print(f"変更対象ファイル数: {len(all_changes)}")
    print()

    for change in all_changes:
        print(f"File: {change['file']}")
        print(f"  Before: {change['before']}")
        print(f"  After:  {change['after']}")
        print()

    if not dry_run and all_changes:
        print(f"合計 {len(all_changes)} ファイルを更新しました")


if __name__ == '__main__':
    main()
