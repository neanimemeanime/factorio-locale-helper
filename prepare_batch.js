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
const outputJsonPath = 'C:\\Users\\Админ\\.gemini\\antigravity-ide\\brain\\e32f049b-ca1a-491e-be5d-360c349d3824\\scratch\\untranslated_all.json';

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

function prepare() {
    const files = fs.readdirSync(modsDir);
    const modGroups = {};

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

    const latestMods = [];
    for (const name in modGroups) {
        const group = modGroups[name];
        group.sort((a, b) => compareVersions(b.version, a.version));
        latestMods.push(group[0]);
    }

    const outputData = [];

    for (const item of latestMods) {
        const fullPath = path.join(modsDir, item.file);
        try {
            const data = readModDir(fullPath);
            const modName = data.info.name || item.file.replace(/_\d+(\.\d+)*\.zip$/, '');
            
            // Check if RU translation already exists
            const translationFileName = `${modName}.cfg`;
            const translationFilePath = path.join(texturePackLocaleDir, translationFileName);
            const exists = fs.existsSync(translationFilePath);

            if (exists) continue; // Only process missing mods

            const analysis = analyzeModCore({
                info: data.info,
                luaFiles: data.luaFiles,
                localeFiles: data.localeFiles,
                prototypesDb,
                vanillaNames,
                removeUnusedKeys: false
            });

            // Parse cleanedCfg into JSON structure
            const lines = analysis.cleanedCfg.split('\n');
            const modContent = {
                modName: modName,
                version: item.version,
                sections: []
            };

            let currentSection = null;
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                if (trimmed.startsWith('#')) continue; // Skip comments like FOUND IN LUA
                
                if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                    currentSection = {
                        name: trimmed.substring(1, trimmed.length - 1),
                        keys: {}
                    };
                    modContent.sections.push(currentSection);
                } else if (trimmed.includes('=')) {
                    const eqIndex = trimmed.indexOf('=');
                    const key = trimmed.substring(0, eqIndex).trim();
                    const val = trimmed.substring(eqIndex + 1).trim();
                    if (currentSection) {
                        currentSection.keys[key] = val;
                    }
                }
            }

            // Only add if there are sections and keys to translate
            const hasKeys = modContent.sections.some(s => Object.keys(s.keys).length > 0);
            if (hasKeys) {
                outputData.push(modContent);
                console.log(`Prepared mod: ${modName}`);
            }
        } catch (err) {
            console.error(`Error preparing ${item.file}: ${err.message}`);
        }
    }

    fs.writeFileSync(outputJsonPath, JSON.stringify(outputData, null, 2), 'utf-8');
    console.log(`Saved batch JSON to: ${outputJsonPath}`);
}

prepare();
