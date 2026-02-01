#!/bin/bash
#
# Obsidian Vault クリーンアップスクリプト
# 重複ファイルの削除とタグの正規化を実行
#
# Usage:
#   ./cleanup.sh          # ドライラン（変更を確認のみ）
#   ./cleanup.sh --execute # 実際に変更を適用
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BASE_DIR="$(dirname "$SCRIPT_DIR")"

cd "$BASE_DIR"

echo "========================================"
echo "Obsidian Vault クリーンアップ"
echo "========================================"
echo "Base directory: $BASE_DIR"
echo ""

# 引数チェック
if [ "$1" = "--execute" ]; then
    MODE="EXECUTE"
    EXEC_FLAG="--execute"
else
    MODE="DRY RUN"
    EXEC_FLAG=""
fi

echo "Mode: $MODE"
echo ""

# Step 1: 重複ファイル検出・削除
echo "========================================"
echo "Step 1: 重複ファイル検出"
echo "========================================"

if command -v node &> /dev/null; then
    node "$SCRIPT_DIR/cleanupDuplicates.js" $EXEC_FLAG
else
    echo "Warning: Node.js not found. Skipping duplicate detection."
fi

echo ""

# Step 2: タグ正規化
echo "========================================"
echo "Step 2: タグ正規化"
echo "========================================"

if command -v python3 &> /dev/null; then
    python3 "$SCRIPT_DIR/normalizeTags.py" $EXEC_FLAG
else
    echo "Warning: Python3 not found. Skipping tag normalization."
fi

echo ""
echo "========================================"
echo "完了"
echo "========================================"

if [ "$MODE" = "DRY RUN" ]; then
    echo ""
    echo "これはドライランです。実際に変更を適用するには:"
    echo "  $0 --execute"
fi
