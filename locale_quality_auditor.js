import fs from 'fs';
import path from 'path';
import os from 'os';
import { parseCfgText, getDefaultModsDir, compareVersions, parseModEntry } from './missing_keys_scanner.js';
import { readZipEntries } from './zip_reader.js';

/**
 * Whitelist of purely technical acronyms, hotkeys, file formats, and chemical formulas
 * that cannot be translated into Russian and should not be flagged.
 * All brand names, mod names, and English words are intentionally excluded
 * (e.g. 'factorio' -> 'факторио', 'eneas' -> 'энеас', 'tier' -> 'уровень').
 */
export const WHITELIST_WORDS = new Set([
    // Software & UI technical abbreviations
    'gui', 'ui', 'hud', 'api', 'id', 'fps', 'ups', 'lua', 'python', 'rgb', 'rgba', 'hex',
    'json', 'xml', 'csv', 'png', 'jpg', 'ogg', 'wav', 'zip', 'ram', 'vram', 'cpu', 'gpu',
    // Input & Hotkeys
    'shift', 'ctrl', 'alt', 'tab', 'enter', 'space', 'esc', 'wasd', 'lmb', 'rmb', 'mmb',
    // Electrical & frequency units of measurement
    'kw', 'mw', 'gw', 'tw', 'kj', 'mj', 'gj', 'tj', 'rpm',
    'mb', 'gb', 'tb', 'kb', 'hp', 'hz', 'khz', 'mhz', 'ghz',
    // Technical tier and version markers
    'mk', 'mk1', 'mk2', 'mk3', 'mk4', 'mk5', 'v1', 'v2', 'v3',
    // Chemistry symbols & common formulas
    'co', 'h2o', 'sio', 'casio', 'fecus', 'pu'
]);

/**
 * Strips Factorio tags, placeholders, code variables, and URLs from a localized text line.
 * @param {string} val
 * @returns {string}
 */
export function cleanFactorioText(val) {
    if (!val) return '';
    return val
        // URLs first (before tags strip breaks them)
        .replace(/https?:\/\/\S+/gi, ' ')
        // Replace escaped newlines
        .replace(/\\n/g, ' ')
        // Tags: [item=...], [fluid=...], [planet=...], [color=...], etc.
        .replace(/\[\/?([a-zA-Z0-9_-]+)(=[^\]]*)?\]/g, ' ')
        // Hex / color tags [color=1,0,0] and hex codes like #EA1100
        .replace(/\[color=[^\]]*\]|\[\/color\]|\[font=[^\]]*\]|\[\/font\]/gi, ' ')
        .replace(/#[0-9a-fA-F]{3,8}\b/g, ' ')
        // Pluralization tags: __plural_for_parameter__1__{...}__ or __plural_for_parameter_1_{...}__
        .replace(/__plural_for_parameter[0-9_]*\{([\s\S]*?)\}__/g, (_, p1) => {
            return ' ' + p1.replace(/\b(ends\s+in|rest|weight|other)\b/gi, ' ').replace(/[=|\d,]+/g, ' ') + ' ';
        })
        // Placeholders: __1__, __ENTITY__...__, __CONTROL__...__
        .replace(/__([A-Za-z0-9_-]+)__/g, ' ')
        .replace(/__([A-Za-z0-9_-]+)__([A-Za-z0-9_-]+)__/g, ' ')
        // Console commands like /fp-restart-translation, /f4m.exclude
        .replace(/[\/«"][a-zA-Z0-9_.-]+[\/»"]?/g, ' ')
        // Normalize subscript numbers (e.g. CO₂ -> CO2)
        .replace(/[₀-₉]/g, '')
        // Factorio internal prototype names with hyphens (e.g. nuclear-fuel, small-electric-pole)
        .replace(/\b[a-zA-Z0-9]+-[a-zA-Z0-9-]+\b/gi, ' ')
        // File paths / extensions (.lua, .png)
        .replace(/\b\w+\.(lua|png|cfg|json|ogg|wav)\b/gi, ' ')
        // Code / Lua identifiers with underscores (e.g. set_blueprint_entities)
        .replace(/\b[a-zA-Z0-9_]*_[a-zA-Z0-9_]+\b/g, ' ')
        // Numbers and units
        .replace(/\b\d+(\.\d+)?\s*(kw|mw|gw|tw|kj|mj|gj|tj|w|j|v|a|rpm|km\/h|m\/s|m|km|mm|cm|s|ms|min|h|fps|ups|%)\b/gi, ' ')
        // Versions like v1.0.4
        .replace(/\bv?\d+(\.\d+)+\b/gi, ' ')
        .trim();
}

/**
 * Extracts Factorio placeholders, paired formatting tags, and standalone tags.
 * @param {string} str
 * @returns {{ placeholders: string[], pairedTags: string[], singleTags: string[], allTokens: string[] }}
 */
export function extractFactorioTokens(str) {
    if (!str) return { placeholders: [], pairedTags: [], singleTags: [], allTokens: [] };
    const placeholders = [];
    const pairedTags = [];
    const singleTags = [];

    // 1. Pluralization blocks: __plural_for_parameter__1__{...}__
    const pluralRegex = /__plural_for_parameter[0-9_]*\{[\s\S]*?\}__/g;
    let m;
    while ((m = pluralRegex.exec(str)) !== null) {
        placeholders.push(m[0]);
    }

    // 2. Placeholders: __1__, __2__, __ENTITY__...__, __CONTROL__...__
    const phRegex = /__([A-Za-z0-9_-]+)__/g;
    while ((m = phRegex.exec(str)) !== null) {
        if (!m[0].startsWith('__plural_for_parameter')) {
            placeholders.push(m[0]);
        }
    }

    // 3. Paired tags: [color=...][/color], [font=...][/font], [tooltip=...][/tooltip]
    function extractPairsRecursive(text) {
        const pairRegex = /\[(color|font|tooltip)=([^\]]+)\]([\s\S]*?)\[\/\1\]/gi;
        let match;
        while ((match = pairRegex.exec(text)) !== null) {
            const tag = match[1].toLowerCase();
            const param = match[2].trim().toLowerCase();
            const inner = match[3];
            pairedTags.push(`[${tag}=${param}][/${tag}]`);
            extractPairsRecursive(inner);
        }
    }
    extractPairsRecursive(str);

    // 4. Standalone tags: [item=...], [fluid=...], [entity=...], [virtual-signal=...], etc.
    const standaloneRegex = /\[([a-zA-Z0-9_-]+(?:=[^\]]+)?)\]/g;
    while ((m = standaloneRegex.exec(str)) !== null) {
        const fullTag = m[0].toLowerCase();
        if (/^\[\/?(color|font|tooltip)(=[^\]]+)?\]$/i.test(fullTag)) continue;
        singleTags.push(fullTag);
    }

    const allTokens = [...placeholders, ...pairedTags, ...singleTags];
    return { placeholders, pairedTags, singleTags, allTokens };
}

/**
 * Compares tags and placeholders between the original string and the translated string.
 * @param {string} origStr
 * @param {string} transStr
 * @returns {{ origTokens: string[], transTokens: string[], missing: string[], extra: string[], syntaxErrors: string[] }}
 */
export function compareTokens(origStr, transStr) {
    const origTokens = extractFactorioTokens(origStr);
    const transTokens = extractFactorioTokens(transStr);

    const missing = [];
    const extra = [];

    // Count tokens in translation
    const transCounts = new Map();
    for (const t of transTokens.allTokens) {
        const key = t.toLowerCase();
        transCounts.set(key, (transCounts.get(key) || 0) + 1);
    }

    for (const t of origTokens.allTokens) {
        const key = t.toLowerCase();
        const count = transCounts.get(key) || 0;
        if (count <= 0) {
            missing.push(t);
        } else {
            transCounts.set(key, count - 1);
        }
    }

    // Count tokens in original
    const origCounts = new Map();
    for (const t of origTokens.allTokens) {
        const key = t.toLowerCase();
        origCounts.set(key, (origCounts.get(key) || 0) + 1);
    }

    for (const t of transTokens.allTokens) {
        const key = t.toLowerCase();
        const count = origCounts.get(key) || 0;
        if (count <= 0) {
            extra.push(t);
        } else {
            origCounts.set(key, count - 1);
        }
    }

    // Check syntax errors in translated string (e.g. unclosed color or font tags)
    const syntaxErrors = [];
    const openColorMatches = (transStr || '').match(/\[color=[^\]]+\]/gi) || [];
    const closeColorMatches = (transStr || '').match(/\[\/color\]/gi) || [];
    if (openColorMatches.length > closeColorMatches.length) {
        syntaxErrors.push(`Не закрыт тег [color=...] (открыто: ${openColorMatches.length}, закрыто: ${closeColorMatches.length})`);
    } else if (closeColorMatches.length > openColorMatches.length) {
        syntaxErrors.push(`Лишний закрывающий тег [/color] (открыто: ${openColorMatches.length}, закрыто: ${closeColorMatches.length})`);
    }

    const openFontMatches = (transStr || '').match(/\[font=[^\]]+\]/gi) || [];
    const closeFontMatches = (transStr || '').match(/\[\/font\]/gi) || [];
    if (openFontMatches.length > closeFontMatches.length) {
        syntaxErrors.push(`Не закрыт тег [font=...] (открыто: ${openFontMatches.length}, закрыто: ${closeFontMatches.length})`);
    } else if (closeFontMatches.length > openFontMatches.length) {
        syntaxErrors.push(`Лишний закрывающий тег [/font] (открыто: ${openFontMatches.length}, закрыто: ${closeFontMatches.length})`);
    }

    return {
        origTokens: origTokens.allTokens,
        transTokens: transTokens.allTokens,
        missing,
        extra,
        syntaxErrors
    };
}

/**
 * Detects characters from foreign languages (en, jp, cn, kr, etc.) in a localized string.
 * @param {string} val
 * @returns {object|null}
 */
export function detectForeignCharacters(val) {
    if (!val) return null;
    const cleaned = cleanFactorioText(val);
    if (!cleaned) return null;

    const detected = {
        hasCyrillic: /\p{Script=Cyrillic}/u.test(cleaned),
        cjk: [],
        latin: [],
        other: [],
        languages: new Set()
    };

    // 1. CJK / Asian scripts (Chinese, Japanese, Korean) & full-width CJK punctuation
    const cjkMatches = cleaned.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\u3000-\u303F\uFF00-\uFFEF]+/gu);
    if (cjkMatches && cjkMatches.length > 0) {
        detected.cjk = cjkMatches;
        const hasKana = /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(cleaned);
        const hasHangul = /\p{Script=Hangul}/u.test(cleaned);
        const hasHan = /\p{Script=Han}/u.test(cleaned);

        if (hasKana) detected.languages.add('jp');
        if (hasHangul) detected.languages.add('kr');
        if (hasHan && !hasKana) detected.languages.add('cn');
        if (hasHan && hasKana) detected.languages.add('jp');
    }

    // 2. Latin / English words
    const rawLatinWords = cleaned.match(/[a-zA-Z]{2,}/g) || [];
    const suspiciousLatin = rawLatinWords
        .map(w => w.toLowerCase())
        .filter(w => !WHITELIST_WORDS.has(w));

    if (suspiciousLatin.length > 0) {
        detected.latin = suspiciousLatin;
        detected.languages.add('en');
    }

    // 3. Other foreign scripts (Arabic, Thai, Hebrew, etc.)
    const allLetterWords = cleaned.match(/\p{L}+/gu) || [];
    for (const word of allLetterWords) {
        if (/\p{Script=Cyrillic}/u.test(word)) continue;
        if (/\p{Script=Latin}/u.test(word)) continue;
        if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(word)) continue;
        detected.other.push(word);
        detected.languages.add('other');
    }

    const hasForeign = detected.cjk.length > 0 || detected.latin.length > 0 || detected.other.length > 0;
    if (!hasForeign) return null;

    return {
        hasCyrillic: detected.hasCyrillic,
        languages: Array.from(detected.languages),
        cjkWords: detected.cjk,
        suspiciousLatin: detected.latin,
        otherChars: detected.other
    };
}

/**
 * Loads the original English locale sections for a mod from disk or zip archive.
 * @param {string} modName
 * @param {string} modsDir
 * @param {string} [targetLocaleDir]
 * @param {Map<string, Record<string, Record<string, string>>>} [cache]
 * @returns {Record<string, Record<string, string>>}
 */
export function loadModEnSections(modName, modsDir, targetLocaleDir, cache = new Map()) {
    if (cache.has(modName)) {
        return cache.get(modName);
    }

    const enSections = {};

    // 1. Check sibling locale/en if auditing inside a specific mod directory
    if (targetLocaleDir) {
        const parentDir = path.dirname(targetLocaleDir);
        const siblingEnDir = path.join(parentDir, 'en');
        if (fs.existsSync(siblingEnDir) && fs.statSync(siblingEnDir).isDirectory()) {
            const files = fs.readdirSync(siblingEnDir).filter(f => f.endsWith('.cfg'));
            for (const f of files) {
                const content = fs.readFileSync(path.join(siblingEnDir, f), 'utf-8');
                const parsed = parseCfgText(content);
                for (const [sec, keys] of Object.entries(parsed)) {
                    if (!enSections[sec]) enSections[sec] = {};
                    Object.assign(enSections[sec], keys);
                }
            }
            if (Object.keys(enSections).length > 0) {
                cache.set(modName, enSections);
                return enSections;
            }
        }
    }

    // 2. Check Factorio modsDir for folder or highest version .zip
    if (modsDir && fs.existsSync(modsDir)) {
        const fsEntries = fs.readdirSync(modsDir);
        const candidates = [];
        for (const entry of fsEntries) {
            const parsed = parseModEntry(entry);
            if (parsed.name.toLowerCase() === modName.toLowerCase()) {
                candidates.push({
                    entry,
                    version: parsed.version,
                    isZip: entry.endsWith('.zip')
                });
            }
        }

        if (candidates.length > 0) {
            candidates.sort((a, b) => compareVersions(b.version, a.version));
            const selected = candidates[0];
            const fullPath = path.join(modsDir, selected.entry);

            if (selected.isZip) {
                const zipEntries = readZipEntries(fullPath, (name) => {
                    const norm = name.replace(/\\/g, '/');
                    return norm.includes('/locale/en/') && norm.endsWith('.cfg');
                });
                for (const ze of zipEntries) {
                    const parsed = parseCfgText(ze.content);
                    for (const [sec, keys] of Object.entries(parsed)) {
                        if (!enSections[sec]) enSections[sec] = {};
                        Object.assign(enSections[sec], keys);
                    }
                }
            } else {
                const enDir = path.join(fullPath, 'locale', 'en');
                if (fs.existsSync(enDir) && fs.statSync(enDir).isDirectory()) {
                    const cfgFiles = fs.readdirSync(enDir).filter(f => f.endsWith('.cfg'));
                    for (const cfgFile of cfgFiles) {
                        const content = fs.readFileSync(path.join(enDir, cfgFile), 'utf-8');
                        const parsed = parseCfgText(content);
                        for (const [sec, keys] of Object.entries(parsed)) {
                            if (!enSections[sec]) enSections[sec] = {};
                            Object.assign(enSections[sec], keys);
                        }
                    }
                }
            }
        }
    }

    cache.set(modName, enSections);
    return enSections;
}

/**
 * Resolves the default target locale directory (my-texture-pack/locale/ru).
 */
export function getDefaultTargetLocaleDir() {
    const modsDir = getDefaultModsDir();
    return path.join(modsDir, 'my-texture-pack', 'locale', 'ru');
}

/**
 * Audits Russian localization files in the target mod for:
 * 1. Tag & placeholder mismatches against original English (missing [color=green][/color], __2__, etc.)
 * 2. Foreign characters from other languages (cn, jp, kr, other scripts)
 * 3. Mixed language strings (Latin words inside Russian sentences)
 * 4. Completely untranslated English strings
 *
 * @param {object} [options]
 * @param {string} [options.targetLocaleDir] - Directory containing .cfg files to audit.
 * @param {string} [options.modsDir] - Directory where Factorio mods reside (for original EN locales).
 * @param {string} [options.modFilter] - Optional filter for specific mod or filename.
 * @param {string} [options.issueType] - 'all' | 'tags' | 'foreign' | 'mixed' | 'untranslated' (default: 'all').
 * @param {number} [options.limit] - Max issues to return (default: 100, 0 = unlimited).
 * @returns {object} Audit report structure.
 */
export function auditLocaleQuality(options = {}) {
    const targetLocaleDir = options.targetLocaleDir || getDefaultTargetLocaleDir();
    const modsDir = options.modsDir || getDefaultModsDir();
    const modFilter = options.modFilter ? options.modFilter.trim().toLowerCase() : null;
    const rawIssueType = (options.issueType || 'all').toLowerCase();
    const limit = typeof options.limit === 'number' ? options.limit : 100;

    if (!fs.existsSync(targetLocaleDir)) {
        throw new Error(`Target locale directory not found: ${targetLocaleDir}`);
    }

    const cfgFiles = fs.readdirSync(targetLocaleDir)
        .filter(f => f.endsWith('.cfg'))
        .filter(f => !modFilter || f.toLowerCase().includes(modFilter));

    const issues = [];
    let tagMismatchCount = 0;
    let foreignCharactersCount = 0;
    let mixedCount = 0;
    let untranslatedCount = 0;

    const modEnCache = new Map();

    for (const filename of cfgFiles) {
        const filePath = path.join(targetLocaleDir, filename);
        const modName = filename.replace(/\.cfg$/, '');
        const content = fs.readFileSync(filePath, 'utf-8');
        const sections = parseCfgText(content);

        // Load original EN sections for tag & placeholder verification
        const enSections = loadModEnSections(modName, modsDir, targetLocaleDir, modEnCache);

        for (const [section, keys] of Object.entries(sections)) {
            for (const [key, val] of Object.entries(keys)) {
                if (!val || !val.trim()) continue;

                // 1. Tag & placeholder consistency check against original EN
                const enVal = enSections[section]?.[key];
                if (enVal) {
                    const tokenCmp = compareTokens(enVal, val);
                    if (tokenCmp.missing.length > 0 || tokenCmp.syntaxErrors.length > 0) {
                        tagMismatchCount++;
                        if (rawIssueType === 'all' || rawIssueType === 'tags' || rawIssueType === 'tag_mismatch') {
                            const descParts = [];
                            if (tokenCmp.missing.length > 0) {
                                descParts.push(`Отсутствуют в переводе: ${tokenCmp.missing.join(', ')}`);
                            }
                            if (tokenCmp.syntaxErrors.length > 0) {
                                descParts.push(`Синтаксис: ${tokenCmp.syntaxErrors.join('; ')}`);
                            }
                            issues.push({
                                type: 'tag_mismatch',
                                file: filename,
                                modName,
                                section,
                                key,
                                text: val,
                                originalText: enVal,
                                missingTags: tokenCmp.missing,
                                extraTags: tokenCmp.extra,
                                syntaxErrors: tokenCmp.syntaxErrors,
                                description: descParts.join(' | ')
                            });
                        }
                    }
                } else {
                    // Even without original EN, check internal tag syntax errors
                    const tokenCmp = compareTokens('', val);
                    if (tokenCmp.syntaxErrors.length > 0) {
                        tagMismatchCount++;
                        if (rawIssueType === 'all' || rawIssueType === 'tags' || rawIssueType === 'tag_mismatch') {
                            issues.push({
                                type: 'tag_mismatch',
                                file: filename,
                                modName,
                                section,
                                key,
                                text: val,
                                originalText: null,
                                missingTags: [],
                                extraTags: [],
                                syntaxErrors: tokenCmp.syntaxErrors,
                                description: `Синтаксис тегов: ${tokenCmp.syntaxErrors.join('; ')}`
                            });
                        }
                    }
                }

                // 2. Foreign characters & language audit
                const foreign = detectForeignCharacters(val);
                if (foreign) {
                    // Check for CJK or other non-Latin foreign scripts (cn, jp, kr, other)
                    if (foreign.cjkWords.length > 0 || foreign.otherChars.length > 0) {
                        foreignCharactersCount++;
                        if (rawIssueType === 'all' || rawIssueType === 'foreign' || rawIssueType === 'foreign_characters') {
                            const nonLatinLangs = foreign.languages.filter(l => l !== 'en');
                            const foreignChars = [...foreign.cjkWords, ...foreign.otherChars];
                            issues.push({
                                type: 'foreign_characters',
                                file: filename,
                                modName,
                                section,
                                key,
                                text: val,
                                languages: nonLatinLangs,
                                foreignCharacters: foreignChars,
                                description: `В строке обнаружены символы других языков (${nonLatinLangs.join(', ')}): ${foreignChars.join(', ')}`
                            });
                        }
                    }

                    // Check for untranslated Latin / English words
                    if (foreign.suspiciousLatin.length > 0) {
                        if (!foreign.hasCyrillic) {
                            // Entirely non-Cyrillic string in a Russian file
                            if (foreign.suspiciousLatin.length >= 2 || (foreign.suspiciousLatin.length === 1 && foreign.suspiciousLatin[0].length >= 4)) {
                                untranslatedCount++;
                                if (rawIssueType === 'all' || rawIssueType === 'untranslated' || rawIssueType === 'untranslated_english' || rawIssueType === 'foreign') {
                                    issues.push({
                                        type: 'untranslated_english',
                                        file: filename,
                                        modName,
                                        section,
                                        key,
                                        text: val,
                                        languages: ['en'],
                                        suspiciousWords: foreign.suspiciousLatin,
                                        description: `Строка не переведена на русский (найдены английские слова: ${foreign.suspiciousLatin.join(', ')})`
                                    });
                                }
                            }
                        } else {
                            // Cyrillic mixed with untranslated Latin words
                            mixedCount++;
                            if (rawIssueType === 'all' || rawIssueType === 'mixed' || rawIssueType === 'mixed_language' || rawIssueType === 'foreign') {
                                issues.push({
                                    type: 'mixed_language',
                                    file: filename,
                                    modName,
                                    section,
                                    key,
                                    text: val,
                                    languages: ['en'],
                                    suspiciousWords: foreign.suspiciousLatin,
                                    description: `Смесь русского и английского языков (непереведённые слова: ${foreign.suspiciousLatin.join(', ')})`
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    const totalIssuesFound = tagMismatchCount + foreignCharactersCount + mixedCount + untranslatedCount;
    const returnedIssues = limit > 0 ? issues.slice(0, limit) : issues;

    return {
        summary: {
            targetLocaleDir,
            modsDir,
            totalFilesScanned: cfgFiles.length,
            totalIssuesFound,
            tagMismatchCount,
            foreignCharactersCount,
            mixedCount,
            untranslatedCount,
            returnedCount: returnedIssues.length,
            hasMore: limit > 0 && totalIssuesFound > returnedIssues.length
        },
        issues: returnedIssues
    };
}
