import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { analyzeModCore } from './analyzer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load internal names and prototype definitions
const internalNamesPath = path.join(__dirname, 'Internal_names.txt');
const prototypesPath = path.join(__dirname, 'Prototypes.txt');

const vanillaNamesText = fs.existsSync(internalNamesPath) ? fs.readFileSync(internalNamesPath, 'utf-8') : '';
const prototypesText = fs.existsSync(prototypesPath) ? fs.readFileSync(prototypesPath, 'utf-8') : '';

const vanillaNames = new Set(vanillaNamesText.split(/\r?\n/).filter(Boolean));
const prototypesDb = new Set(prototypesText.split(/\r?\n/).filter(Boolean));

const modsDir = 'c:\\Users\\Админ\\AppData\\Roaming\\Factorio\\mods';
const texturePackLocaleDir = path.join(modsDir, 'my-texture-pack', 'locale', 'ru');

// Parse mod filename to name and version
function parseModFilename(filename) {
    const match = filename.match(/^(.+)_(\d+(?:\.\d+)*)\.zip$/);
    if (match) {
        return {
            name: match[1],
            version: match[2]
        };
    }
    return null;
}

// Compare two version strings
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

// Recursively reads files from a directory and formats them for analyzeModCore.
// Extracts ZIP archives to OS temp directory to avoid workspace file locking by language server.
function readModDir(modPath) {
    let tempDirToDelete = null;
    let targetModPath = modPath;

    if (modPath.endsWith('.zip')) {
        // Write to OS temp directory to prevent file locking by language server / EPERM errors
        const tempDir = path.join(os.tmpdir(), '.temp_unzip_batch_' + Date.now() + '_' + Math.floor(Math.random() * 1000));
        fs.mkdirSync(tempDir, { recursive: true });
        tempDirToDelete = tempDir;

        try {
            const escapePath = (p) => p.replace(/'/g, "''");
            const cmd = `powershell -NoProfile -Command "Expand-Archive -Force -Path '${escapePath(modPath)}' -DestinationPath '${escapePath(tempDir)}'"`;
            execSync(cmd, { stdio: 'ignore' });
        } catch (err) {
            try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
            throw new Error(`Failed to unzip file: ${err.message}`);
        }

        const entries = fs.readdirSync(tempDir, { withFileTypes: true });
        const dirEntry = entries.find(e => e.isDirectory());
        if (dirEntry) {
            targetModPath = path.join(tempDir, dirEntry.name);
        } else {
            targetModPath = tempDir;
        }
    }

    if (!fs.existsSync(targetModPath)) {
        if (tempDirToDelete) {
            try { fs.rmSync(tempDirToDelete, { recursive: true, force: true }); } catch (_) {}
        }
        throw new Error(`Path does not exist: ${targetModPath}`);
    }

    const allFiles = [];
    function walk(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'dist') {
                    walk(fullPath);
                }
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
            try {
                info = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            } catch (err) {
                console.error(`Error parsing info.json at ${filePath}:`, err);
            }
        } else if (filePath.endsWith('.lua')) {
            const content = fs.readFileSync(filePath, 'utf-8');
            luaFiles.push({ path: relPath, content });
        } else if (relPath.startsWith('locale/') && relPath.endsWith('.cfg')) {
            const langMatch = relPath.match(/^locale\/([a-zA-Z-]+)\//);
            if (langMatch && langMatch[1]) {
                const lang = langMatch[1];
                const content = fs.readFileSync(filePath, 'utf-8');
                if (!localeFiles[lang]) localeFiles[lang] = [];
                localeFiles[lang].push(content);
            }
        }
    }

    if (tempDirToDelete) {
        try {
            fs.rmSync(tempDirToDelete, { recursive: true, force: true });
        } catch (err) {
            console.error(`Error deleting temp folder ${tempDirToDelete}:`, err);
        }
    }

    return { info, luaFiles, localeFiles };
}

function scanAll() {
    const files = fs.readdirSync(modsDir);
    const modGroups = {};

    console.log(`Scanning mods folder: ${modsDir}`);
    console.log(`Texture pack locale folder: ${texturePackLocaleDir}`);
    console.log('--------------------------------------------------');

    for (const file of files) {
        if (!file.endsWith('.zip')) continue;
        if (file.startsWith('my-texture-pack')) continue;
        if (file.includes('-graphics') || file.includes('_graphics') || file.includes('-assets') || file.includes('_assets')) continue;

        const parsed = parseModFilename(file);
        if (!parsed) {
            const name = file.replace(/\.zip$/, '');
            if (!modGroups[name]) modGroups[name] = [];
            modGroups[name].push({ file, version: '0.0.0' });
        } else {
            if (!modGroups[parsed.name]) {
                modGroups[parsed.name] = [];
            }
            modGroups[parsed.name].push({ file, version: parsed.version });
        }
    }

    // Pick only the latest version for each mod name
    const latestMods = [];
    for (const name in modGroups) {
        const group = modGroups[name];
        group.sort((a, b) => compareVersions(b.version, a.version)); // Descending: latest first
        latestMods.push(group[0]);
    }

    latestMods.sort((a, b) => a.file.localeCompare(b.file));

    const results = [];
    for (const item of latestMods) {
        const fullPath = path.join(modsDir, item.file);
        try {
            const data = readModDir(fullPath);
            const modName = data.info.name || item.file.replace(/_\d+(\.\d+)*\.zip$/, '');
            
            // Check if RU translation already exists
            const translationFileName = `${modName}.cfg`;
            const translationFilePath = path.join(texturePackLocaleDir, translationFileName);
            const exists = fs.existsSync(translationFilePath);

            // Run analysis to check for missing keys
            const analysis = analyzeModCore({
                info: data.info,
                luaFiles: data.luaFiles,
                localeFiles: data.localeFiles,
                prototypesDb,
                vanillaNames,
                removeUnusedKeys: false
            });

            // Count empty keys in the generated RU locale
            const cleanLines = analysis.cleanedCfg.split('\n');
            let emptyKeysCount = 0;
            cleanLines.forEach(line => {
                if (line.includes('=') && line.split('=')[1].trim() === '') {
                    emptyKeysCount++;
                }
            });

            results.push({
                file: item.file,
                modName,
                exists,
                emptyKeysCount,
                cleanedCfg: analysis.cleanedCfg
            });

            console.log(`[${exists ? '✔' : '❌'}] Mod: ${modName} (v${item.version}) | Exists: ${exists ? 'YES' : 'NO'} | Missing keys: ${emptyKeysCount}`);
        } catch (err) {
            console.error(`Error processing ${item.file}: ${err.message}`);
        }
    }

    console.log('--------------------------------------------------');
    console.log(`Scan completed. Found ${results.length} unique latest mods (excluding graphics/assets).`);
    const translated = results.filter(r => r.exists).length;
    console.log(`Translated: ${translated} / ${results.length} (${Math.round((translated / results.length) * 100)}%)`);
    const missingTranslation = results.filter(r => !r.exists);
    console.log(`Missing Russian translation: ${missingTranslation.length} mods.`);
}

scanAll();
