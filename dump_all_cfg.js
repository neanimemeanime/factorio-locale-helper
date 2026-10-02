import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { analyzeModCore } from './analyzer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const internalNamesPath = path.join(__dirname, 'Internal_names.txt');
const prototypesPath = path.join(__dirname, 'Prototypes.txt');

const vanillaNamesText = fs.existsSync(internalNamesPath) ? fs.readFileSync(internalNamesPath, 'utf-8') : '';
const prototypesText = fs.existsSync(prototypesPath) ? fs.readFileSync(prototypesPath, 'utf-8') : '';

const vanillaNames = new Set(vanillaNamesText.split(/\r?\n/).filter(Boolean));
const prototypesDb = new Set(prototypesText.split(/\r?\n/).filter(Boolean));

const modsDir = 'c:\\Users\\Админ\\AppData\\Roaming\\Factorio\\mods';
const outputDir = 'c:\\Users\\Админ\\Desktop\\Программирование и Проекты\\For soft\\raw_cfg_output';

function parseModFilename(filename) {
    const match = filename.match(/^(.+?)_(\d+(?:\.\d+)*)\.zip$/);
    if (match) return { name: match[1], version: match[2] };
    return null;
}

function compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    const length = Math.max(parts1.length, parts2.length);
    for (let i = 0; i < length; i++) {
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;
        if (p1 > p2) return 1;
        if (p1 < p2) return -1;
    }
    return 0;
}

function readModDir(modPath) {
    let tempDirToDelete = null;
    let targetModPath = modPath;

    if (modPath.endsWith('.zip')) {
        const tempDir = path.join(os.tmpdir(), '.temp_dump_' + Date.now() + '_' + Math.floor(Math.random() * 1000));
        fs.mkdirSync(tempDir, { recursive: true });
        tempDirToDelete = tempDir;

        try {
            const escapePath = (p) => p.replace(/'/g, "''");
            const cmd = `powershell -NoProfile -Command "Expand-Archive -Force -Path '${escapePath(modPath)}' -DestinationPath '${escapePath(tempDir)}'"`;
            execSync(cmd, { stdio: 'ignore' });
        } catch (err) {
            try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
            throw new Error(`Failed to unzip: ${err.message}`);
        }

        const entries = fs.readdirSync(tempDir, { withFileTypes: true });
        const dirEntry = entries.find(e => e.isDirectory());
        targetModPath = dirEntry ? path.join(tempDir, dirEntry.name) : tempDir;
    }

    if (!fs.existsSync(targetModPath)) {
        if (tempDirToDelete) try { fs.rmSync(tempDirToDelete, { recursive: true, force: true }); } catch (_) {}
        throw new Error(`Path does not exist: ${targetModPath}`);
    }

    const allFiles = [];
    function walk(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (!['node_modules', '.git', 'dist'].includes(entry.name)) walk(fullPath);
            } else {
                allFiles.push(fullPath);
            }
        }
    }
    walk(targetModPath);

    let info = {};
    const luaFiles = [];
    const localeFiles = {};

    for (const filePath of allFiles) {
        const relPath = path.relative(targetModPath, filePath).replace(/\\/g, '/');
        if (relPath === 'info.json') {
            try { info = JSON.parse(fs.readFileSync(filePath, 'utf-8')); } catch (_) {}
        } else if (filePath.endsWith('.lua')) {
            luaFiles.push({ path: relPath, content: fs.readFileSync(filePath, 'utf-8') });
        } else if (relPath.startsWith('locale/') && relPath.endsWith('.cfg')) {
            const langMatch = relPath.match(/^locale\/([a-zA-Z-]+)\//);
            if (langMatch) {
                const lang = langMatch[1];
                if (!localeFiles[lang]) localeFiles[lang] = [];
                localeFiles[lang].push(fs.readFileSync(filePath, 'utf-8'));
            }
        }
    }

    if (tempDirToDelete) {
        try { fs.rmSync(tempDirToDelete, { recursive: true, force: true }); } catch (_) {}
    }

    return { info, luaFiles, localeFiles };
}

// --- Main ---
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const files = fs.readdirSync(modsDir);
const modGroups = {};

for (const file of files) {
    if (!file.endsWith('.zip')) continue;
    const parsed = parseModFilename(file);
    if (!parsed) continue;
    if (!modGroups[parsed.name]) modGroups[parsed.name] = [];
    modGroups[parsed.name].push({ file, version: parsed.version });
}

// Keep only latest version of each mod
const latestMods = [];
for (const name in modGroups) {
    const group = modGroups[name];
    group.sort((a, b) => compareVersions(b.version, a.version));
    latestMods.push(group[0]);
}

latestMods.sort((a, b) => a.file.localeCompare(b.file));

console.log(`Found ${latestMods.length} unique latest mods. Writing raw .cfg files to:\n${outputDir}\n`);

let ok = 0, fail = 0;
for (const item of latestMods) {
    const fullPath = path.join(modsDir, item.file);
    try {
        const data = readModDir(fullPath);
        const modName = data.info.name || item.file.replace(/_\d+(\.\d+)*\.zip$/, '');

        const result = analyzeModCore({
            info: data.info,
            luaFiles: data.luaFiles,
            localeFiles: data.localeFiles,
            prototypesDb,
            vanillaNames,
            removeUnusedKeys: false
        });

        const outPath = path.join(outputDir, `${modName}.cfg`);
        fs.writeFileSync(outPath, result.cleanedCfg, 'utf-8');
        console.log(`  OK: ${modName}.cfg`);
        ok++;
    } catch (err) {
        console.error(`  FAIL: ${item.file} -> ${err.message}`);
        fail++;
    }
}

console.log(`\nDone! ${ok} succeeded, ${fail} failed.`);
