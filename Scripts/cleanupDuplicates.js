/**
 * 重複ファイル検出・削除スクリプト
 * Usage: node cleanupDuplicates.js (Node.js) または Templaterで実行
 *
 * source_urlが同じファイルを重複として検出し、古い方を残して削除
 */

const fs = require('fs');
const path = require('path');

const FOLDERS = ['Business', 'News', 'Other', 'Personal', 'Tech'];

/**
 * frontmatterからsource_urlを抽出
 */
function extractSourceUrl(content) {
    const match = content.match(/source_url:\s*(.+)/);
    return match ? match[1].trim() : null;
}

/**
 * ファイル名からタイムスタンプを抽出
 */
function extractTimestamp(filename) {
    const match = filename.match(/^(\d{4}-\d{2}-\d{2}-\d{6})/);
    return match ? match[1] : null;
}

/**
 * 重複を検出
 */
function findDuplicates(baseDir) {
    const urlToFiles = new Map();

    for (const folder of FOLDERS) {
        const folderPath = path.join(baseDir, folder);
        if (!fs.existsSync(folderPath)) continue;

        const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.md'));

        for (const file of files) {
            const filePath = path.join(folderPath, file);
            const content = fs.readFileSync(filePath, 'utf-8');
            const sourceUrl = extractSourceUrl(content);

            if (sourceUrl) {
                if (!urlToFiles.has(sourceUrl)) {
                    urlToFiles.set(sourceUrl, []);
                }
                urlToFiles.set(sourceUrl, [...urlToFiles.get(sourceUrl), {
                    path: filePath,
                    filename: file,
                    timestamp: extractTimestamp(file)
                }]);
            }
        }
    }

    // 重複のみ抽出（2つ以上のファイルがある場合）
    const duplicates = [];
    for (const [url, files] of urlToFiles) {
        if (files.length > 1) {
            // タイムスタンプでソート（古い順）
            files.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
            duplicates.push({
                url,
                keep: files[0],           // 最も古いファイルを保持
                delete: files.slice(1)    // 残りは削除対象
            });
        }
    }

    return duplicates;
}

/**
 * 重複レポートを出力
 */
function printReport(duplicates) {
    console.log('=== 重複ファイル検出レポート ===\n');
    console.log(`重複グループ数: ${duplicates.length}`);

    let totalToDelete = 0;
    for (const dup of duplicates) {
        totalToDelete += dup.delete.length;
    }
    console.log(`削除対象ファイル数: ${totalToDelete}\n`);

    for (const dup of duplicates) {
        console.log(`URL: ${dup.url}`);
        console.log(`  保持: ${dup.keep.path}`);
        for (const del of dup.delete) {
            console.log(`  削除: ${del.path}`);
        }
        console.log('');
    }
}

/**
 * 重複ファイルを削除
 */
function deleteDuplicates(duplicates, dryRun = true) {
    let deleted = 0;

    for (const dup of duplicates) {
        for (const file of dup.delete) {
            if (dryRun) {
                console.log(`[DRY RUN] Would delete: ${file.path}`);
            } else {
                try {
                    fs.unlinkSync(file.path);
                    console.log(`Deleted: ${file.path}`);
                    deleted++;
                } catch (e) {
                    console.error(`Error deleting ${file.path}: ${e.message}`);
                }
            }
        }
    }

    return deleted;
}

// メイン処理
function main() {
    const baseDir = process.cwd();
    const args = process.argv.slice(2);
    const dryRun = !args.includes('--execute');

    console.log(`Base directory: ${baseDir}`);
    console.log(`Mode: ${dryRun ? 'DRY RUN (use --execute to actually delete)' : 'EXECUTE'}\n`);

    const duplicates = findDuplicates(baseDir);
    printReport(duplicates);

    if (duplicates.length > 0) {
        const deleted = deleteDuplicates(duplicates, dryRun);
        if (!dryRun) {
            console.log(`\n合計 ${deleted} ファイルを削除しました`);
        }
    }
}

module.exports = { findDuplicates, deleteDuplicates };

if (require.main === module) {
    main();
}
