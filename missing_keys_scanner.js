import fs from 'fs';
import path from 'path';
import os from 'os';
import { readZipEntries } from './zip_reader.js';

const SYSTEM_MODULES = new Set([
    'base',
    'space-age',
    'quality',
    'elevated-rails',
    'recycler',
    'core'
]);

/**
 * Parses Factorio .cfg INI-like content into an object of sections and key-value pairs.
 * @param {string} content
 * @returns {Record<string, Record<string, string>>}
 */
export function parseCfgText(content) {
    const sections = {};
    let currentSection = '';
    const lines = content.split(/\r?\n/);

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#') || line.startsWith(';')) continue;

        if (line.startsWith('[') && line.endsWith(']')) {
            currentSection = line.slice(1, -1).trim();
            if (!sections[currentSection]) sections[currentSection] = {};
            continue;
        }

        if (line.includes('=') && currentSection) {
            const eqIdx = line.indexOf('=');
            const key = line.slice(0, eqIdx).trim();
            const val = line.slice(eqIdx + 1).trim();
            if (key) {
                sections[currentSection][key] = val;
            }
        }
    }

    return sections;
}

/**
 * Formats a sections dictionary back into Factorio .cfg text.
 * @param {Record<string, Record<string, string>>} sections
 * @returns {string}
 */
export function formatCfgSections(sections) {
    let out = '';
    for (const [section, keys] of Object.entries(sections)) {
        const entries = Object.entries(keys);
        if (entries.length === 0) continue;

        out += `[${section}]\n`;
        for (const [k, v] of entries) {
            out += `${k}=${v}\n`;
        }
        out += '\n';
    }
    return out.trim();
}

/**
 * Merges missing keys into an existing .cfg string, preserving comments, blank lines,
 * and existing translations. Appends missing keys under their respective [sections]
 * or appends new sections at the end of the file.
 *
 * @param {string} existingContent
 * @param {Record<string, Record<string, string>>} missingSections
 * @returns {string}
 */
export function mergeMissingKeysIntoCfg(existingContent, missingSections) {
    if (!existingContent || !existingContent.trim()) {
        return formatCfgSections(missingSections) + '\n';
    }

    const hasCRLF = existingContent.includes('\r\n');
    const nl = hasCRLF ? '\r\n' : '\n';
    const lines = existingContent.split(/\r?\n/);

    // Identify sections and their ranges [startLine, endLine]
    const sections = [];
    let curSec = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('[') && line.endsWith(']')) {
            if (curSec) {
                curSec.endLine = i - 1;
            }
            curSec = {
                name: line.slice(1, -1).trim(),
                headerLine: i,
                endLine: lines.length - 1
            };
            sections.push(curSec);
        }
    }
    if (curSec) {
        curSec.endLine = lines.length - 1;
    }

    const sectionMap = new Map();
    for (const s of sections) {
        sectionMap.set(s.name, s);
    }

    const insertionsAfterLine = new Map();
    const newSectionsToAppend = [];

    for (const [secName, keys] of Object.entries(missingSections)) {
        if (!keys || Object.keys(keys).length === 0) continue;
        const keyLines = Object.entries(keys).map(([k, v]) => `${k}=${v}`);

        if (sectionMap.has(secName)) {
            const sec = sectionMap.get(secName);
            let insertLine = sec.headerLine;
            for (let j = sec.endLine; j >= sec.headerLine; j--) {
                if (lines[j].trim().length > 0) {
                    insertLine = j;
                    break;
                }
            }
            if (!insertionsAfterLine.has(insertLine)) {
                insertionsAfterLine.set(insertLine, []);
            }
            insertionsAfterLine.get(insertLine).push(...keyLines);
        } else {
            newSectionsToAppend.push({ name: secName, keyLines });
        }
    }

    const resultLines = [];
    for (let i = 0; i < lines.length; i++) {
        resultLines.push(lines[i]);
        if (insertionsAfterLine.has(i)) {
            resultLines.push(...insertionsAfterLine.get(i));
        }
    }

    for (const ns of newSectionsToAppend) {
        if (resultLines.length > 0 && resultLines[resultLines.length - 1].trim().length > 0) {
            resultLines.push('');
        }
        resultLines.push(`[${ns.name}]`);
        resultLines.push(...ns.keyLines);
        resultLines.push('');
    }

    return resultLines.join(nl).replace(/(\r?\n)+$/, '') + nl;
}

/**
 * Compares two semantic version strings (e.g. "1.2.10" vs "1.2.9").
 */
export function compareVersions(v1, v2) {
    const parts1 = (v1 || '0').split('.').map(n => parseInt(n, 10) || 0);
    const parts2 = (v2 || '0').split('.').map(n => parseInt(n, 10) || 0);
    const len = Math.max(parts1.length, parts2.length);
    for (let i = 0; i < len; i++) {
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;
        if (p1 > p2) return 1;
        if (p1 < p2) return -1;
    }
    return 0;
}

/**
 * Extracts mod name and version from directory or zip filename.
 */
export function parseModEntry(entryName) {
    const cleanName = entryName.endsWith('.zip') ? entryName.slice(0, -4) : entryName;
    const match = cleanName.match(/^(.+)_(\d+(?:\.\d+)*)$/);
    if (match) {
        return { name: match[1], version: match[2], raw: entryName };
    }
    return { name: cleanName, version: '0.0.0', raw: entryName };
}

/**
 * Resolves the default Factorio mods folder in %APPDATA%/Factorio/mods.
 */
export function getDefaultModsDir() {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, 'Factorio', 'mods');
}

/**
 * Batch scans active Factorio mods from mod-list.json, extracts their original
 * English locale (en/*.cfg), and compares against the target translation mod (e.g. my-texture-pack).
 *
 * @param {object} [options]
 * @param {string} [options.modsDir] - Directory where Factorio mods and mod-list.json reside.
 * @param {string} [options.targetMod] - Name of the translation pack mod (default: 'my-texture-pack').
 * @param {string} [options.lang] - Target language to compare (default: 'ru').
 * @param {string} [options.modFilter] - Optional filter for a specific mod name.
 * @param {string} [options.writeDir] - Optional folder where diff .cfg files should be written.
 * @returns {object} Diff results structure.
 */
export function scanMissingKeys(options = {}) {
    const modsDir = options.modsDir || getDefaultModsDir();
    const targetMod = options.targetMod || 'my-texture-pack';
    const lang = options.lang || 'ru';
    const modFilter = options.modFilter ? options.modFilter.trim().toLowerCase() : null;
    const writeDir = options.writeDir ? path.resolve(options.writeDir) : null;

    if (!fs.existsSync(modsDir)) {
        throw new Error(`Factorio mods directory not found: ${modsDir}`);
    }

    const modListPath = path.join(modsDir, 'mod-list.json');
    if (!fs.existsSync(modListPath)) {
        throw new Error(`mod-list.json not found at: ${modListPath}`);
    }

    const modListData = JSON.parse(fs.readFileSync(modListPath, 'utf-8'));
    const targetPackLocaleDir = path.join(modsDir, targetMod, 'locale', lang);

    // Filter enabled user mods (excluding vanilla/system modules and the target translation pack)
    const activeMods = (modListData.mods || []).filter(m => {
        if (!m.enabled) return false;
        if (SYSTEM_MODULES.has(m.name)) return false;
        if (m.name === targetMod) return false;
        if (modFilter && !m.name.toLowerCase().includes(modFilter)) return false;
        return true;
    });

    // Group filesystem entries by mod name and select the highest version
    const fsEntries = fs.readdirSync(modsDir);
    const modFileCandidates = {};

    for (const entry of fsEntries) {
        if (entry === targetMod || SYSTEM_MODULES.has(entry)) continue;
        const parsed = parseModEntry(entry);
        if (!modFileCandidates[parsed.name]) {
            modFileCandidates[parsed.name] = [];
        }
        modFileCandidates[parsed.name].push({
            entry,
            version: parsed.version,
            isZip: entry.endsWith('.zip')
        });
    }

    let totalMissingKeys = 0;
    let modsWithMissingKeys = 0;
    const diffsByMod = {};

    const writeToTarget = options.writeToTarget !== false; // Default: true (automatically merge into target .cfg)
    const updatedTargetFiles = [];

    for (const mod of activeMods) {
        const modName = mod.name;
        const candidates = modFileCandidates[modName];
        if (!candidates || candidates.length === 0) continue;

        // Sort descending by version, pick the latest
        candidates.sort((a, b) => compareVersions(b.version, a.version));
        const selected = candidates[0];
        const fullPath = path.join(modsDir, selected.entry);

        // Read all en/*.cfg from mod (zip or folder)
        let enCfgTexts = [];
        if (selected.isZip) {
            const zipEntries = readZipEntries(fullPath, (name) => {
                const norm = name.replace(/\\/g, '/');
                return norm.includes('/locale/en/') && norm.endsWith('.cfg');
            });
            enCfgTexts = zipEntries.map(e => e.content);
        } else {
            const enDir = path.join(fullPath, 'locale', 'en');
            if (fs.existsSync(enDir)) {
                const cfgFiles = fs.readdirSync(enDir).filter(f => f.endsWith('.cfg'));
                for (const cfgFile of cfgFiles) {
                    enCfgTexts.push(fs.readFileSync(path.join(enDir, cfgFile), 'utf-8'));
                }
            }
        }

        if (enCfgTexts.length === 0) continue;

        // Merge original EN sections
        const enSections = {};
        for (const text of enCfgTexts) {
            const parsed = parseCfgText(text);
            for (const [sec, keys] of Object.entries(parsed)) {
                if (!enSections[sec]) enSections[sec] = {};
                Object.assign(enSections[sec], keys);
            }
        }

        // Read existing target translations (e.g. my-texture-pack/locale/ru/<modName>.cfg)
        const targetCfgPath = path.join(targetPackLocaleDir, `${modName}.cfg`);
        const ruFileExists = fs.existsSync(targetCfgPath);
        const existingRuSections = ruFileExists ? parseCfgText(fs.readFileSync(targetCfgPath, 'utf-8')) : {};

        // Find missing keys
        const missingSections = {};
        let modMissingCount = 0;

        for (const [sec, enKeys] of Object.entries(enSections)) {
            for (const [k, val] of Object.entries(enKeys)) {
                const ruVal = existingRuSections[sec]?.[k];
                if (ruVal === undefined) {
                    if (!missingSections[sec]) missingSections[sec] = {};
                    missingSections[sec][k] = val;
                    modMissingCount++;
                }
            }
        }

        if (modMissingCount > 0) {
            modsWithMissingKeys++;
            totalMissingKeys += modMissingCount;
            diffsByMod[modName] = {
                ruFileExists,
                missingCount: modMissingCount,
                matchedFile: selected.entry,
                sections: missingSections
            };

            // Automatically inject/merge missing keys into target mod's .cfg file
            if (writeToTarget) {
                fs.mkdirSync(targetPackLocaleDir, { recursive: true });
                const currentFileContent = ruFileExists ? fs.readFileSync(targetCfgPath, 'utf-8') : '';
                const updatedContent = mergeMissingKeysIntoCfg(currentFileContent, missingSections);
                fs.writeFileSync(targetCfgPath, updatedContent, 'utf-8');
                updatedTargetFiles.push({
                    modName,
                    path: targetCfgPath,
                    keysAdded: modMissingCount,
                    created: !ruFileExists
                });
            }

            // Optionally write separate diff file
            if (writeDir) {
                fs.mkdirSync(writeDir, { recursive: true });
                const outPath = path.join(writeDir, `${modName}.cfg`);
                const formatted = formatCfgSections(missingSections);
                fs.writeFileSync(outPath, formatted, 'utf-8');
            }
        }
    }

    return {
        summary: {
            modsDir,
            targetMod,
            targetLang: lang,
            totalActiveMods: activeMods.length,
            modsWithMissingKeys,
            totalMissingKeys,
            writeToTarget,
            updatedFilesCount: updatedTargetFiles.length,
            writtenToDir: writeDir || null
        },
        updatedFiles: updatedTargetFiles,
        mods: diffsByMod
    };
}
