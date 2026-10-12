import fs from 'fs';
import path from 'path';
import os from 'os';
import { readZipEntries } from './zip_reader.js';
import { normalizeSectionName } from './syntax_validator.js';
import { loadConfig, getDefaultModsDir } from './config_loader.js';

export { normalizeSectionName, getDefaultModsDir };

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
 * Normalizes misplaced section names by default (e.g. [remnant-name] -> [entity-name]).
 * @param {string} content
 * @param {object} [options]
 * @param {boolean} [options.normalize=true] - Whether to normalize section names to canonical Factorio sections.
 * @returns {Record<string, Record<string, string>>}
 */
export function parseCfgText(content, options = {}) {
    const normalize = options.normalize !== false;
    const sections = {};
    let currentSection = '';
    const lines = content.split(/\r?\n/);

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#') || line.startsWith(';')) continue;

        if (line.startsWith('[') && line.endsWith(']')) {
            const rawSec = line.slice(1, -1).trim();
            currentSection = normalize ? normalizeSectionName(rawSec) : rawSec;
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
 * and existing translations.
 * Strictly deduplicates section headers: each section is output exactly once,
 * consolidating multiple duplicate headers (preventing Factorio 2.1 ROOT crash).
 * Normalizes misplaced sections to canonical ones.
 *
 * @param {string} existingContent
 * @param {Record<string, Record<string, string>>} missingSections
 * @returns {string}
 */
export function mergeMissingKeysIntoCfg(existingContent, missingSections) {
    // Normalize missingSections
    const normalizedMissing = {};
    for (const [rawSec, keys] of Object.entries(missingSections || {})) {
        if (!keys || Object.keys(keys).length === 0) continue;
        const normSec = normalizeSectionName(rawSec);
        if (!normalizedMissing[normSec]) normalizedMissing[normSec] = {};
        Object.assign(normalizedMissing[normSec], keys);
    }

    if (!existingContent || !existingContent.trim()) {
        return formatCfgSections(normalizedMissing) + '\n';
    }

    const hasCRLF = existingContent.includes('\r\n');
    const nl = hasCRLF ? '\r\n' : '\n';
    const lines = existingContent.split(/\r?\n/);

    // Group existing content by normalized section while preserving header lines before first section
    const headerLines = [];
    const sectionOrder = []; // ordered list of unique normalized section names
    const sectionLines = new Map(); // normSec -> array of raw lines inside section
    const existingKeysBySection = new Map(); // normSec -> Set of keys already translated

    let curSection = null;

    for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i];
        const trimmed = rawLine.trim();

        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            const rawSec = trimmed.slice(1, -1).trim();
            if (!rawSec) continue; // Skip empty section header []
            const normSec = normalizeSectionName(rawSec);

            curSection = normSec;
            if (!sectionLines.has(normSec)) {
                sectionOrder.push(normSec);
                sectionLines.set(normSec, []);
                existingKeysBySection.set(normSec, new Set());
            }
            continue;
        }

        if (!curSection) {
            headerLines.push(rawLine);
            continue;
        }

        // Inside a section
        if (trimmed.includes('=') && !trimmed.startsWith('#') && !trimmed.startsWith(';')) {
            const eqIdx = trimmed.indexOf('=');
            const key = trimmed.slice(0, eqIdx).trim();
            if (key) {
                existingKeysBySection.get(curSection).add(key);
            }
        }
        sectionLines.get(curSection).push(rawLine);
    }

    // Append missing keys under their respective sections
    for (const [secName, keys] of Object.entries(normalizedMissing)) {
        if (!keys || Object.keys(keys).length === 0) continue;

        if (!sectionLines.has(secName)) {
            sectionOrder.push(secName);
            sectionLines.set(secName, []);
            existingKeysBySection.set(secName, new Set());
        }

        const existingKeys = existingKeysBySection.get(secName);
        const sLines = sectionLines.get(secName);

        for (const [k, v] of Object.entries(keys)) {
            if (!existingKeys.has(k)) {
                sLines.push(`${k}=${v}`);
                existingKeys.add(k);
            }
        }
    }

    // Construct final output
    const outLines = [];
    if (headerLines.length > 0) {
        outLines.push(...headerLines);
        if (outLines.length > 0 && outLines[outLines.length - 1].trim().length > 0) {
            outLines.push('');
        }
    }

    for (const secName of sectionOrder) {
        const sLines = sectionLines.get(secName);
        if (!sLines) continue;

        // Ensure single blank line before section header if needed
        if (outLines.length > 0 && outLines[outLines.length - 1].trim().length > 0) {
            outLines.push('');
        }

        // Output exactly ONE section header per section
        outLines.push(`[${secName}]`);

        for (const line of sLines) {
            outLines.push(line);
        }
    }

    let out = outLines.join(nl);
    if (!out.endsWith(nl)) {
        out += nl;
    }
    return out;
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
 * Batch scans active Factorio mods from mod-list.json, extracts their original
 * English locale (en/*.cfg), and compares against the target translation mod.
 *
 * @param {object} [options]
 * @param {string} [options.modsDir] - Directory where Factorio mods and mod-list.json reside.
 * @param {string} [options.targetMod] - Name of the translation pack mod (default from config).
 * @param {string} [options.lang] - Target language to compare (default from config).
 * @param {string} [options.modFilter] - Optional filter for a specific mod name.
 * @param {string} [options.writeDir] - Optional folder where diff .cfg files should be written.
 * @returns {object} Diff results structure.
 */
export function scanMissingKeys(options = {}) {
    const config = loadConfig();
    const modsDir = options.modsDir || config.modsDir;
    const targetMod = options.targetMod || config.targetMod;
    const lang = options.lang || config.targetLang;
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

        // Read existing target translations (e.g. <targetMod>/locale/<lang>/<modName>.cfg)
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
