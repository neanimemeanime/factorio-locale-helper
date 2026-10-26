// Shared analysis logic for Factorio Mod Localization Helper
// This file is used by both the browser React frontend and the Node.js CLI/Server.

// Entity types: all map to { name: 'entity-name', desc: 'entity-description' }
const ENTITY_SECTION = { name: 'entity-name', desc: 'entity-description' };
const ITEM_SECTION = { name: 'item-name', desc: 'item-description' };
const EQUIPMENT_SECTION = { name: 'equipment-name', desc: 'equipment-description' };

const ENTITY_TYPES = [
    'accumulator', 'agricultural-tower', 'ammo-turret', 'arithmetic-combinator',
    'arrow', 'artillery-flare', 'artillery-projectile', 'artillery-turret', 'artillery-wagon',
    'assembling-machine', 'asteroid', 'asteroid-collector', 'beacon', 'beam', 'boiler',
    'burner-generator', 'capture-robot', 'car', 'cargo-bay', 'cargo-landing-pad', 'cargo-pod',
    'cargo-wagon', 'character', 'character-corpse', 'cliff', 'combat-robot',
    'constant-combinator', 'construction-robot', 'container', 'corpse',
    'curved-rail-a', 'curved-rail-b', 'decider-combinator', 'deconstructible-tile-proxy',
    'display-panel', 'electric-energy-interface', 'electric-pole', 'electric-turret',
    'elevated-curved-rail-a', 'elevated-curved-rail-b', 'elevated-half-diagonal-rail',
    'elevated-straight-rail', 'entity-ghost', 'explosion', 'fire', 'fish', 'fluid-turret',
    'fluid-wagon', 'furnace', 'fusion-generator', 'fusion-reactor', 'gate', 'generator',
    'half-diagonal-rail', 'heat-interface', 'heat-pipe', 'highlight-box',
    'infinity-cargo-wagon', 'infinity-container', 'infinity-pipe', 'inserter',
    'item-entity', 'item-request-proxy', 'lab', 'lamp', 'land-mine', 'lane-splitter',
    'legacy-curved-rail', 'legacy-straight-rail', 'lightning', 'lightning-attractor',
    'linked-belt', 'linked-container', 'loader', 'loader-1x1', 'locomotive',
    'logistic-container', 'logistic-robot', 'market', 'mining-drill', 'offshore-pump',
    'pipe', 'pipe-to-ground', 'plant', 'power-switch', 'programmable-speaker',
    'projectile', 'proxy-container', 'pump', 'radar', 'rail-chain-signal',
    'rail-ramp', 'rail-remnants', 'rail-signal', 'rail-support', 'reactor', 'roboport',
    'rocket-silo', 'rocket-silo-rocket', 'rocket-silo-rocket-shadow', 'segment',
    'segmented-unit', 'selector-combinator', 'simple-entity', 'simple-entity-with-force',
    'simple-entity-with-owner', 'smoke-with-trigger', 'solar-panel', 'space-platform-hub',
    'speech-bubble', 'spider-leg', 'spider-unit', 'spider-vehicle', 'splitter',
    'sticker', 'storage-tank', 'straight-rail', 'stream', 'temporary-container',
    'thruster', 'tile-ghost', 'train-stop', 'transport-belt', 'tree', 'turret',
    'underground-belt', 'unit', 'unit-spawner', 'valve', 'wall', 'entity', 'remnant'
];

const ITEM_TYPES = [
    'item', 'ammo', 'armor', 'blueprint', 'blueprint-book', 'capsule',
    'copy-paste-tool', 'deconstruction-item', 'gun', 'item-with-entity-data',
    'module', 'rail-planner', 'repair-tool', 'selection-tool',
    'space-platform-starter-pack', 'spidertron-remote', 'tool', 'upgrade-item'
];

const EQUIPMENT_TYPES = [
    'equipment', 'active-defense-equipment', 'battery-equipment', 'belt-immunity-equipment',
    'energy-shield-equipment', 'generator-equipment', 'inventory-bonus-equipment',
    'movement-bonus-equipment', 'night-vision-equipment', 'roboport-equipment',
    'solar-panel-equipment'
];

export const PROTOTYPE_SECTIONS = {
    // Basic types
    fluid: { name: 'fluid-name', desc: 'fluid-description' },
    recipe: { name: 'recipe-name', desc: 'recipe-description' },
    tile: { name: 'tile-name', desc: 'tile-description' },
    technology: { name: 'technology-name', desc: 'technology-description' },
    'item-group': { name: 'item-group-name' },
    'item-subgroup': { name: 'item-subgroup-name' },

    // Factorio 2.1+ Space Age / Quality special types
    quality: { name: 'quality-name', desc: 'quality-description' },
    'space-location': { name: 'space-location-name', desc: 'space-location-description' },
    planet: { name: 'space-location-name', desc: 'space-location-description' },
    'space-connection': { name: 'space-location-name', desc: 'space-location-description' },
    'surface-property': { name: 'surface-property-name', desc: 'surface-property-description' },
    surface: { name: 'surface-name' },
    'fuel-category': { name: 'fuel-category-name', desc: 'fuel-category-description' },
    'ammo-category': { name: 'ammo-category-name', desc: 'ammo-category-description' },
    'asteroid-chunk': { name: 'asteroid-chunk-name', desc: 'item-description' },
    'autoplace-control': { name: 'autoplace-control-names', desc: 'autoplace-control-description' },
    'damage-type': { name: 'damage-type-name', desc: 'damage-type-description' },
    decorative: { name: 'decorative-name' },
    'optimized-decorative': { name: 'decorative-name' },
    'virtual-signal': { name: 'virtual-signal-name', desc: 'virtual-signal-description' },
    'tips-and-tricks-item': { name: 'tips-and-tricks-item-name', desc: 'tips-and-tricks-item-description' },
    'tips-and-tricks-item-category': { name: 'tips-and-tricks-item-category-name' },
    'recipe-category': { name: 'recipe-category-name' },
    'resource-category': { name: 'resource-category-name' },
    'module-category': { name: 'module-category-name' },
    'equipment-category': { name: 'equipment-category-name' },
    'custom-input': { name: 'controls', desc: 'controls-description' },
    shortcut: { name: 'shortcut-name' },
    'map-gen-presets': { name: 'map-gen-preset-name', desc: 'map-gen-preset-description' },
    achievement: { name: 'achievement-name', desc: 'achievement-description' },
    'airborne-pollutant': { name: 'airborne-pollutant-name', desc: 'airborne-pollutant-description' },
    'burner-usage': { name: 'burner-usage-name' }
};

for (const t of ENTITY_TYPES) {
    PROTOTYPE_SECTIONS[t] = ENTITY_SECTION;
}

for (const t of ITEM_TYPES) {
    PROTOTYPE_SECTIONS[t] = ITEM_SECTION;
}

for (const t of EQUIPMENT_TYPES) {
    PROTOTYPE_SECTIONS[t] = EQUIPMENT_SECTION;
}

export const NON_LOCALIZABLE_PROTOTYPE_TYPES = new Set([
    'collision-layer',
    'mod-data',
    'noise-layer',
    'noise-expression',
    'ambient-sound',
    'sound',
    'font',
    'sprite',
    'animation',
    'utility-sprites',
    'utility-sounds',
    'gui-style',
    'editor-controller',
    'spectator-controller',
    'god-controller',
    'burner-usage-priority',
    'tile-effect',
    'procession',
    'procession-graphic-catalogue',
    'trivial-smoke',
    'particle',
    'optimized-particle',
    'mouse-cursor',
    'deliver-category',
    'thruster-plume'
]);

/**
 * Validates whether a string extracted from Lua is a legitimate locale key/section reference
 * rather than a file path (e.g. "__mod__/graphics/img.png").
 */
export function isValidLocaleKey(str) {
    if (!str || typeof str !== 'string') return false;
    if (str.includes('/') || str.includes('\\') || str.startsWith('__')) return false;
    if (/\.(png|ogg|wav|mp3|lua|json|csv|zip|dds|tga|bmp|jpg|jpeg)$/i.test(str)) return false;
    return /^[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)*$/.test(str);
}

/**
 * Returns canonical section mapping for a prototype type,
 * falling back safely to entity-name without creating invalid sections.
 * Returns null for non-localizable prototype types.
 */
export function getPrototypeSections(type) {
    if (!type) return ENTITY_SECTION;
    if (NON_LOCALIZABLE_PROTOTYPE_TYPES.has(type)) return null;
    if (PROTOTYPE_SECTIONS[type]) return PROTOTYPE_SECTIONS[type];
    if (type.endsWith('-achievement')) return { name: 'achievement-name', desc: 'achievement-description' };
    if (type.endsWith('-equipment')) return EQUIPMENT_SECTION;
    if (type.endsWith('-setting') || type === 'startup' || type === 'runtime-global' || type === 'runtime-per-user') {
        return { name: 'mod-setting-name', desc: 'mod-setting-description' };
    }

    console.warn(`[analyzer] Unknown prototype type "${type}", safely defaulting to entity-name`);
    return ENTITY_SECTION;
}

export const STANDARD_VANILLA_SECTIONS = new Set([
    'entity-name', 'entity-description',
    'item-name', 'item-description',
    'equipment-name', 'equipment-description',
    'tile-name', 'tile-description',
    'recipe-name', 'recipe-description',
    'technology-name', 'technology-description',
    'fluid-name', 'fluid-description',
    'item-group-name', 'item-subgroup-name',
    'quality-name', 'quality-description',
    'space-location-name', 'space-location-description',
    'surface-property-name', 'surface-property-description',
    'surface-name',
    'fuel-category-name', 'fuel-category-description',
    'ammo-category-name', 'ammo-category-description',
    'achievement-name', 'achievement-description',
    'airborne-pollutant-name', 'airborne-pollutant-name-with-amount',
    'asteroid-chunk-name',
    'autoplace-control-names',
    'damage-type-name', 'damage-type-description',
    'decorative-name',
    'virtual-signal-name', 'virtual-signal-description',
    'tips-and-tricks-item-name', 'tips-and-tricks-item-description',
    'tips-and-tricks-item-category-name',
    'recipe-category-name',
    'resource-category-name',
    'module-category-name',
    'equipment-category-name',
    'controls', 'controls-description',
    'shortcut-name',
    'map-gen-preset-name', 'map-gen-preset-description'
]);

export function isStandardVanillaSection(section) {
    if (!section) return false;
    return STANDARD_VANILLA_SECTIONS.has(section);
}

export function isProtectedKey(lines, idx) {
    if (!lines || idx < 0 || idx >= lines.length) return false;
    const currLine = lines[idx].toUpperCase();
    if (currLine.includes('MOD OVERRIDE')) {
        return true;
    }

    for (let j = idx - 1; j >= 0; j--) {
        const prevLine = lines[j].trim();
        if (!prevLine) continue;
        if (prevLine.startsWith('#') || prevLine.startsWith(';')) {
            const upper = prevLine.toUpperCase();
            if (
                upper.includes('MOD OVERRIDE') ||
                upper.includes('FOUND IN LUA') ||
                upper.includes('DYNAMIC LOCALIZATION') ||
                upper.includes('MISSING IN LOCALE')
            ) {
                return true;
            }
            continue;
        } else {
            break;
        }
    }
    return false;
}

export function extractPrecedingComment(lines, idx) {
    if (!lines || idx < 0 || idx >= lines.length) return null;
    for (let j = idx - 1; j >= 0; j--) {
        const prevLine = lines[j].trim();
        if (!prevLine) continue;
        if (prevLine.startsWith('#') || prevLine.startsWith(';')) {
            const upper = prevLine.toUpperCase();
            if (upper.includes('MOD OVERRIDE')) {
                return prevLine;
            }
            continue;
        } else {
            break;
        }
    }
    return null;
}

export function extractLuaTables(str) {
    const tables = [];
    let depth = 0;
    let start = -1;
    let inString = false;
    let escape = false;
    let quoteChar = '';

    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        if (inString) {
            if (escape) escape = false;
            else if (char === '\\') escape = true;
            else if (char === quoteChar) inString = false;
            continue;
        }
        if (char === '"' || char === "'") {
            inString = true;
            quoteChar = char;
            continue;
        }
        if (char === '{') {
            if (depth === 0) start = i;
            depth++;
        } else if (char === '}') {
            depth--;
            if (depth === 0 && start !== -1) {
                tables.push(str.substring(start, i + 1));
                start = -1;
            }
        }
    }
    return tables;
}

export function parseSinglePrototype(tableStr) {
    const prototype = {};

    const simpleFieldRegex = (fieldName) => new RegExp(`\\b${fieldName}\\s*=\\s*["']([^"']+)["']`);

    const typeMatch = tableStr.match(simpleFieldRegex('type'));
    if (typeMatch) prototype.type = typeMatch[1];

    const nameValueMatch = tableStr.match(/\bname\s*=\s*(?:["']([^"']+)["']|([^,{}]+))/);
    if (nameValueMatch) {
        if (nameValueMatch[1]) {
            prototype.name = nameValueMatch[1].trim();
        } else if (nameValueMatch[2]) {
            prototype.name = 'DYNAMICALLY_GENERATED';
        }
    }

    prototype.has_localised_name = /\blocalised_name\s*=/.test(tableStr);
    prototype.has_localised_description = /\blocalised_description\s*=/.test(tableStr);

    const placeResultMatch = tableStr.match(simpleFieldRegex('place_result'));
    if (placeResultMatch) prototype.place_result = placeResultMatch[1];

    const placedAsEquipmentResultMatch = tableStr.match(simpleFieldRegex('placed_as_equipment_result'));
    if (placedAsEquipmentResultMatch) prototype.placed_as_equipment_result = placedAsEquipmentResultMatch[1];

    // Factorio 2.0+ Space Age plant_result (seeds, agriculture)
    const plantResultMatch = tableStr.match(simpleFieldRegex('plant_result'));
    if (plantResultMatch) prototype.plant_result = plantResultMatch[1];

    // Factorio 2.0+ place_as_tile = { result = "..." } or place_as_tile = "..."
    const placeAsTileComplex = tableStr.match(/\bplace_as_tile\s*=\s*\{[^\}]*\bresult\s*=\s*["']([^"']+)["']/);
    const placeAsTileSimple = tableStr.match(simpleFieldRegex('place_as_tile'));
    if (placeAsTileComplex) {
        prototype.place_as_tile_result = placeAsTileComplex[1];
    } else if (placeAsTileSimple) {
        prototype.place_as_tile_result = placeAsTileSimple[1];
    }

    const mainProductMatch = tableStr.match(simpleFieldRegex('main_product'));
    if (mainProductMatch) prototype.main_product = mainProductMatch[1];

    const resultMatch = tableStr.match(simpleFieldRegex('result'));
    if (resultMatch) prototype.result = resultMatch[1];

    const categoryMatch = tableStr.match(simpleFieldRegex('category'));
    if (categoryMatch) prototype.category = categoryMatch[1];

    const arrayFieldRegex = (fieldName) => new RegExp(`\\b${fieldName}\\s*=\\s*\\{([\\s\\S]*?)\\}`, 'm');

    // Factorio 2.0+ results array: results = { {type = "item", name = "...", amount = 1}, ... } or { {"...", 1} }
    const resultsMatch = tableStr.match(arrayFieldRegex('results'));
    if (resultsMatch) {
        const resContent = resultsMatch[1];
        const resNames = [];
        const nameMatches = resContent.matchAll(/\bname\s*=\s*["']([^"']+)["']/g);
        for (const nm of nameMatches) {
            resNames.push(nm[1]);
        }
        const positionalMatches = resContent.matchAll(/\{\s*["']([^"']+)["']\s*,\s*\d+/g);
        for (const pm of positionalMatches) {
            if (!resNames.includes(pm[1])) {
                resNames.push(pm[1]);
            }
        }
        prototype.results = resNames;
    }

    const productsMatch = tableStr.match(arrayFieldRegex('products'));
    if (productsMatch) {
        prototype.products = productsMatch[1].match(/["']([^"']+)["']/g)?.map(s => s.replace(/["']/g, '')) || [];
    }

    const allowedValuesMatch = tableStr.match(arrayFieldRegex('allowed_values'));
    if (allowedValuesMatch) {
        prototype.allowed_values = allowedValuesMatch[1].match(/["']([^"']+)["']/g)?.map(s => s.replace(/["']/g, '')) || [];
    }

    return prototype;
}

export function parsePrototypes(luaCode) {
    const code = luaCode.replace(/--\[\[[\s\S]*?\]\]/g, '').replace(/--.*/g, '');
    const extendRegex = /data:extend\s*\(\s*\{([\s\S]*?)\}\s*\)/g;
    const prototypes = [];
    let match;
    while ((match = extendRegex.exec(code)) !== null) {
        const extendContent = match[1];
        const tables = extractLuaTables(extendContent);
        for (const tableStr of tables) {
            const parsed = parseSinglePrototype(tableStr);
            if (parsed.type && parsed.name) {
                prototypes.push(parsed);
            }
        }
    }
    return prototypes;
}

export function analyzeModCore({
    info,
    luaFiles,       // Array of { path, content }
    localeFiles,    // Object: { [langCode]: string[] } (array of file contents)
    prototypesDb,   // Set of strings
    vanillaNames,   // Set of strings
    vanillaCompositeKeys = null, // Set of strings ("section:key" from live Factorio data)
    removeUnusedKeys // boolean
}) {
    let luaCode = '';
    const foundIssues = [];

    // Analyze Lua files
    for (const file of luaFiles) {
        const content = file.content;
        luaCode += content + '\n';

        const lines = content.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim().startsWith('--')) continue;

            let expression = '';
            let hasPrint = false;
            let uiProp = '';

            const printParenMatch = line.match(/\bprint\s*\((.*)\)/);
            const printNoParenMatch = line.match(/\bprint\s+(['"{].*)/);

            if (printParenMatch) {
                expression = printParenMatch[1].trim();
                hasPrint = true;
            } else if (printNoParenMatch) {
                expression = printNoParenMatch[1].trim();
                hasPrint = true;
            } else {
                const uiMatch = line.match(/\b(caption|tooltip|text|localised_name|localised_description)\s*=\s*(.*)$/);
                if (uiMatch) {
                    uiProp = uiMatch[1];
                    expression = uiMatch[2].trim();
                }
            }

            if (expression) {
                let strippedExpression = '';
                let braceDepth = 0;
                for (let char of expression) {
                    if (char === '{') braceDepth++;
                    else if (char === '}') braceDepth = Math.max(0, braceDepth - 1);
                    else if (braceDepth === 0) strippedExpression += char;
                }

                if (strippedExpression.trim().length > 0) {
                    let isIssue = false;
                    let issueType = 'hardcoded';
                    let message = '';

                    if (strippedExpression.includes('string.format')) {
                        isIssue = true;
                        issueType = 'untranslatable';
                        message = 'string.format() used for UI/tag/print (Factorio requires {"", var1, var2} for localization)';
                    } else if (strippedExpression.includes('..') && /['"]/.test(strippedExpression)) {
                        isIssue = true;
                        issueType = 'untranslatable';
                        message = 'String concatenation (..) used (Factorio requires {"", var1, var2} format for localization)';
                    } else {
                        const strRegex = /(['"])(.*?)\1/g;
                        let strMatch;
                        while ((strMatch = strRegex.exec(strippedExpression)) !== null) {
                            const strContent = strMatch[2];
                            if (/[a-zA-Zа-яА-Я]{2,}/.test(strContent) && !/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/.test(strContent)) {
                                const textWithoutTags = strContent.replace(/\[\/?.*?\]/g, '').trim();
                                if (/[a-zA-Zа-яА-Я]{2,}/.test(textWithoutTags)) {
                                    isIssue = true;
                                    issueType = 'hardcoded';
                                    if (hasPrint) {
                                        message = 'Hardcoded string in print() call';
                                    } else if (uiProp === 'text') {
                                        message = 'Hardcoded map tag text (cannot be localized, use icons instead)';
                                    } else {
                                        message = `Hardcoded string in ${uiProp}`;
                                    }
                                    break;
                                }
                            }
                        }
                    }

                    if (isIssue) {
                        foundIssues.push({ file: file.path, line: i + 1, code: line.trim(), type: issueType, message });
                    }
                }
            }
        }
    }

    const modName = info.name || 'mod';
    const existingLocale = {};
    const overrideProtectedKeys = new Set();
    const keyComments = new Map();

    // Normalize localeFiles into { [lang: string]: string[] }
    const normalizedLocaleFiles = {};
    if (Array.isArray(localeFiles)) {
        normalizedLocaleFiles['en'] = [];
        for (const item of localeFiles) {
            if (typeof item === 'string') {
                normalizedLocaleFiles['en'].push(item);
            } else if (item && typeof item.content === 'string') {
                normalizedLocaleFiles['en'].push(item.content);
            }
        }
    } else if (localeFiles && typeof localeFiles === 'object') {
        for (const [lang, val] of Object.entries(localeFiles)) {
            if (Array.isArray(val)) {
                normalizedLocaleFiles[lang] = val.map(v => typeof v === 'string' ? v : (v?.content || ''));
            } else if (typeof val === 'string') {
                normalizedLocaleFiles[lang] = [val];
            } else if (val && typeof val.content === 'string') {
                normalizedLocaleFiles[lang] = [val.content];
            }
        }
    }

    const allLangs = ['en', ...Object.keys(normalizedLocaleFiles).filter(l => l !== 'en')];

    for (const lang of allLangs) {
        if (!normalizedLocaleFiles[lang]) continue;
        for (const content of normalizedLocaleFiles[lang]) {
            let currentSection = '';
            const lines = content.split(/\r?\n/);
            for (let idx = 0; idx < lines.length; idx++) {
                const line = lines[idx];
                const trimmedLine = line.trim();
                if (trimmedLine.startsWith('[') && trimmedLine.endsWith(']')) {
                    currentSection = trimmedLine.substring(1, trimmedLine.length - 1);
                    if (!existingLocale[currentSection]) existingLocale[currentSection] = {};
                } else if (!trimmedLine.startsWith('#') && !trimmedLine.startsWith(';')) {
                    const match = line.match(/^\s*([^=]+?)\s*=\s*(.*)\s*$/);
                    if (match && currentSection) {
                        const key = match[1];
                        const value = match[2];
                        if (key && /^[a-zA-Z0-9_\-\.\[\]]+$/.test(key)) {
                            if (!existingLocale[currentSection][key] || lang === 'en') {
                                existingLocale[currentSection][key] = value;
                            }
                            const compKey = `${currentSection}:${key}`;
                            if (isProtectedKey(lines, idx)) {
                                overrideProtectedKeys.add(compKey);
                                const precComment = extractPrecedingComment(lines, idx);
                                if (precComment) {
                                    keyComments.set(compKey, precComment);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (!existingLocale['mod-name']) existingLocale['mod-name'] = {};
    if (info.name && !existingLocale['mod-name'][info.name]) existingLocale['mod-name'][info.name] = info.title || '';
    if (!existingLocale['mod-description']) existingLocale['mod-description'] = {};
    if (info.name && !existingLocale['mod-description'][info.name]) existingLocale['mod-description'][info.name] = info.description || '';

    const prototypes = parsePrototypes(luaCode);
    const missingKeys = {};
    const usedKeys = new Set();
    const knownPrototypeNames = new Set();

    const markUsed = (section, key) => {
        usedKeys.add(`${section}:${key}`);
    };

    const isVanilla = (section, key) => {
        if (vanillaCompositeKeys && vanillaCompositeKeys.size > 0) {
            return vanillaCompositeKeys.has(`${section}:${key}`);
        }
        return Boolean(vanillaNames && vanillaNames.has(key) && isStandardVanillaSection(section));
    };

    const addMissing = (section, key) => {
        if (isVanilla(section, key)) return;
        if (!existingLocale[section] || !existingLocale[section][key]) {
            if (!missingKeys[section]) missingKeys[section] = new Set();
            missingKeys[section].add(key);
        }
    };

    if (info.name) {
        markUsed('mod-name', info.name);
        markUsed('mod-description', info.name);
    }

    const dynamicTemplateKeys = new Map();
    const explicitStrings = new Set();
    const dynamicPrefixes = new Set();

    const explicitStringRegex = /\{\s*(['"])([^'"]+\.[^'"]+)\1\s*[,}]/g;
    let explicitMatch;
    while ((explicitMatch = explicitStringRegex.exec(luaCode)) !== null) {
        const fullStr = explicitMatch[2];
        if (!isValidLocaleKey(fullStr)) continue;
        explicitStrings.add(fullStr);

        let foundSection = false;
        for (const possibleSection of Object.keys(existingLocale)) {
            if (fullStr.startsWith(possibleSection + ".")) {
                const k = fullStr.substring(possibleSection.length + 1);
                markUsed(possibleSection, k);
                addMissing(possibleSection, k);
                foundSection = true;
                break;
            }
        }
        if (!foundSection) {
            const dotIdx = fullStr.indexOf('.');
            if (dotIdx !== -1) {
                const s = fullStr.substring(0, dotIdx);
                const k = fullStr.substring(dotIdx + 1);
                markUsed(s, k);
                addMissing(s, k);
            }
        }
    }

    const dynamicConcatRegex = /\{\s*(['"])([^'"]+\.[^'"]*)\1\s*\.\./g;
    let concatMatch;
    while ((concatMatch = dynamicConcatRegex.exec(luaCode)) !== null) {
        const prefix = concatMatch[2];
        if (prefix.includes('/') || prefix.includes('\\') || prefix.startsWith('__')) continue;
        if (/\.(png|ogg|wav|mp3|lua|json|csv|zip|dds|tga|bmp|jpg|jpeg)$/i.test(prefix)) continue;
        dynamicPrefixes.add(prefix);
    }

    prototypes.forEach(p => {
        if (NON_LOCALIZABLE_PROTOTYPE_TYPES.has(p.type)) {
            return;
        }

        if (p.name && p.name !== 'DYNAMICALLY_GENERATED') {
            knownPrototypeNames.add(p.name);
        }

        if (p.name === 'DYNAMICALLY_GENERATED') {
            if (p.type === 'recipe' && p.category) {
                const section = 'recipe-category-name';
                const key = p.category;
                const comment = `# DYNAMIC LOCALIZATION: This key ("${key}") is likely used as a template for dynamically generated recipes. It may require parameters like __1__.`;
                dynamicTemplateKeys.set(`${section}:${key}`, comment);
            }
            return;
        }

        const explicitSections = getPrototypeSections(p.type);
        if (!explicitSections) return;
        markUsed(explicitSections.name, p.name);
        if (explicitSections.desc) markUsed(explicitSections.desc, p.name);

        let found = false;
        if (p.type === 'item') {
            if (p.place_result) markUsed('entity-name', p.place_result);
            if (p.placed_as_equipment_result) markUsed('equipment-name', p.placed_as_equipment_result);
            if (p.place_as_tile_result) markUsed('tile-name', p.place_as_tile_result);
            if (p.plant_result) markUsed('entity-name', p.plant_result);

            if (p.place_result && (existingLocale['entity-name']?.[p.place_result] || isVanilla('entity-name', p.place_result))) found = true;
            if (!found && p.placed_as_equipment_result && (existingLocale['equipment-name']?.[p.placed_as_equipment_result] || isVanilla('equipment-name', p.placed_as_equipment_result))) found = true;
            if (!found && p.place_as_tile_result && (existingLocale['tile-name']?.[p.place_as_tile_result] || isVanilla('tile-name', p.place_as_tile_result))) found = true;
            if (!found && p.plant_result && (existingLocale['entity-name']?.[p.plant_result] || isVanilla('entity-name', p.plant_result))) found = true;
            if (!found) {
                if (!p.has_localised_name) addMissing('item-name', p.name);
                if (!p.has_localised_description) addMissing('item-description', p.name);
            }
        } else if (p.type === 'recipe') {
            const allProducts = [];
            if (p.main_product) allProducts.push(p.main_product);
            if (p.result) allProducts.push(p.result);
            if (p.results && p.results.length > 0) allProducts.push(...p.results);
            if (p.products && p.products.length > 0) allProducts.push(...p.products);

            for (const prod of allProducts) {
                markUsed('item-name', prod);
                markUsed('fluid-name', prod);
            }

            const checkItemOrFluidOrEntity = (prodName) => prodName && (
                existingLocale['item-name']?.[prodName] ||
                existingLocale['fluid-name']?.[prodName] ||
                existingLocale['entity-name']?.[prodName] ||
                isVanilla('item-name', prodName) ||
                isVanilla('fluid-name', prodName) ||
                isVanilla('entity-name', prodName)
            );

            // Factorio 2.0/2.1 implicit recipe name inheritance:
            // Single-product recipes or recipes with explicit main_product inherit the product's localised name
            if (p.main_product && checkItemOrFluidOrEntity(p.main_product)) {
                found = true;
            } else if (p.result && checkItemOrFluidOrEntity(p.result)) {
                found = true;
            } else if (p.results && p.results.length === 1 && checkItemOrFluidOrEntity(p.results[0])) {
                found = true;
            } else if (p.products && p.products.length === 1 && checkItemOrFluidOrEntity(p.products[0])) {
                found = true;
            } else if (checkItemOrFluidOrEntity(p.name)) {
                found = true;
            }

            if (!found) {
                if (!p.has_localised_name) addMissing('recipe-name', p.name);
                if (!p.has_localised_description) addMissing('recipe-description', p.name);
            }
        } else if (p.type.endsWith('-setting') || p.type === 'startup' || p.type === 'runtime-global' || p.type === 'runtime-per-user') {
            if (!p.has_localised_name) addMissing('mod-setting-name', p.name);
            if (!p.has_localised_name && !p.has_localised_description) addMissing('mod-setting-description', p.name);
            if (p.type === 'string-setting' && p.allowed_values) {
                p.allowed_values.forEach(val => {
                    markUsed('string-mod-setting', `${p.name}-${val}`);
                    markUsed('string-mod-setting-description', `${p.name}-${val}`);
                    addMissing('string-mod-setting', `${p.name}-${val}`);
                    addMissing('string-mod-setting-description', `${p.name}-${val}`);
                });
            }
        } else {
            const sections = getPrototypeSections(p.type);
            if (sections) {
                if (!p.has_localised_name) {
                    addMissing(sections.name, p.name);
                }
                if (sections.desc && !p.has_localised_description) {
                    addMissing(sections.desc, p.name);
                }
            }
        }
    });

    const sectionOrder = [
        'mod-name', 'mod-description', 'mod-setting-name', 'mod-setting-description',
        'string-mod-setting', 'string-mod-setting-description', 'item-group-name',
        'item-subgroup-name', 'item-name', 'item-description', 'fluid-name', 'fluid-description',
        'recipe-name', 'recipe-description', 'entity-name', 'entity-description',
        'equipment-name', 'equipment-description', 'tile-name', 'tile-description',
        'technology-name', 'technology-description', 'quality-name', 'quality-description',
        'space-location-name', 'space-location-description', 'surface-property-name', 'surface-property-description',
        'surface-name', 'fuel-category-name', 'fuel-category-description',
        'ammo-category-name', 'ammo-category-description',
        'achievement-name', 'achievement-description', 'asteroid-chunk-name',
        'autoplace-control-names', 'damage-type-name', 'decorative-name',
        'virtual-signal-name', 'virtual-signal-description',
        'tips-and-tricks-item-name', 'tips-and-tricks-item-description',
        'controls', 'controls-description'
    ];

    const allKnownSections = new Set([...Object.keys(existingLocale), ...Object.keys(missingKeys)]);
    const allSections = [...sectionOrder.filter(s => allKnownSections.has(s)), ...[...allKnownSections].sort().filter(s => !sectionOrder.includes(s))];

    let masterCfgContent = '';
    for (const section of allSections) {
        masterCfgContent += `[${section}]\n`;
        const existingKeys = Object.keys(existingLocale[section] || {}).sort();
        for (const key of existingKeys) {
            const compKey = `${section}:${key}`;
            const preservedComment = keyComments.get(compKey);
            if (preservedComment && !existingLocale[section][key].toUpperCase().includes('MOD OVERRIDE')) {
                masterCfgContent += `${preservedComment}\n`;
            }
            const dynamicComment = dynamicTemplateKeys.get(compKey);
            if (dynamicComment) {
                masterCfgContent += `${dynamicComment}\n`;
            }
            masterCfgContent += `${key}=${existingLocale[section][key]}\n`;
        }

        if (missingKeys[section] && missingKeys[section].size > 0) {
            const sortedMissing = [...missingKeys[section]]
                .filter(key => !existingLocale[section]?.[key])
                .sort();

            if (sortedMissing.length > 0) {
                masterCfgContent += `\n`;
                for (const key of sortedMissing) {
                    const dynamicComment = dynamicTemplateKeys.get(`${section}:${key}`);
                    if (dynamicComment) {
                        masterCfgContent += `${dynamicComment}\n`;
                    }
                    masterCfgContent += `# FOUND IN LUA, MISSING IN LOCALE\n`;
                    masterCfgContent += `${key}=\n`;
                }
            }
        }
        masterCfgContent += '\n';
    }

    let cleanedCfgContent = '';
    let removedKeysContent = '# This file lists all vanilla Factorio keys that were removed from your mod\'s localization file.\n\n';
    let unusedKeysContentStr = '# This file lists all UNUSED references that were removed because they were not found in any .lua script or prototype.\n\n';
    const log = [];
    const removedInSection = {};
    const unusedInSection = {};

    for (const section of allSections) {
        let sectionHasModKeys = false;
        let sectionContent = '';
        const keys = new Set([...Object.keys(existingLocale[section] || {}), ...(missingKeys[section] || [])]);
        const sortedKeys = [...keys].sort();

        for (const key of sortedKeys) {
            const compositeKey = `${section}:${key}`;
            const isProtected = overrideProtectedKeys.has(compositeKey);
            const isVanillaDuplicate = !isProtected && isVanilla(section, key);

            if (isVanillaDuplicate && section !== 'mod-name' && section !== 'mod-description') {
                if (!removedInSection[section]) removedInSection[section] = [];
                removedInSection[section].push(key);
            } else {
                const fullKeyStr = `${section}.${key}`;
                let isDynamicMatch = false;
                for (const prefix of dynamicPrefixes) {
                    if (fullKeyStr.startsWith(prefix)) {
                        isDynamicMatch = true;
                        break;
                    }
                }

                if (isDynamicMatch) {
                    markUsed(section, key);
                }

                const isUsed = isProtected || usedKeys.has(compositeKey) || explicitStrings.has(fullKeyStr) || knownPrototypeNames.has(key);
                if (!isUsed && existingLocale[section]?.[key] && section !== 'mod-name' && section !== 'mod-description') {
                    if (!unusedInSection[section]) unusedInSection[section] = [];
                    unusedInSection[section].push(key);

                    if (removeUnusedKeys) {
                        continue;
                    }
                }

                sectionHasModKeys = true;

                const preservedComment = keyComments.get(compositeKey);
                if (preservedComment && existingLocale[section]?.[key] && !existingLocale[section][key].toUpperCase().includes('MOD OVERRIDE')) {
                    sectionContent += `${preservedComment}\n`;
                }

                const dynamicComment = dynamicTemplateKeys.get(compositeKey);
                if (dynamicComment) {
                    sectionContent += `${dynamicComment}\n`;
                }

                if (existingLocale[section]?.[key]) {
                    sectionContent += `${key}=${existingLocale[section][key]}\n`;
                } else {
                    sectionContent += `# FOUND IN LUA, MISSING IN LOCALE\n`;
                    sectionContent += `${key}=\n`;
                }
            }
        }

        if (sectionHasModKeys) {
            cleanedCfgContent += `[${section}]\n`;
            cleanedCfgContent += sectionContent + '\n';
        }
    }

    const removedKeysArray = [];
    Object.keys(removedInSection).sort().forEach(section => {
        log.push(`From [${section}], removed vanilla: ${removedInSection[section].length} keys`);
        removedKeysContent += `[${section}]\n`;
        removedKeysContent += removedInSection[section].sort().join('\n') + '\n\n';
        removedInSection[section].forEach(key => removedKeysArray.push({ section, key }));
    });

    const unusedKeysArray = [];
    Object.keys(unusedInSection).sort().forEach(section => {
        log.push(`From [${section}], found unused: ${unusedInSection[section].length} keys`);
        unusedKeysContentStr += `[${section}]\n`;
        unusedKeysContentStr += unusedInSection[section].sort().join('\n') + '\n\n';
        unusedInSection[section].forEach(key => unusedKeysArray.push({ section, key }));
    });

    return {
        modName,
        generatedCfg: masterCfgContent.trim(),
        cleanedCfg: cleanedCfgContent.trim(),
        removedKeysCfg: removedKeysContent.trim(),
        unusedKeysCfg: unusedKeysContentStr.trim(),
        analysisLog: log.length > 0 ? log.join('\n') : "No vanilla or unused keys found to log.",
        hardcodedIssues: foundIssues,
        removedVanillaKeys: removedKeysArray,
        unusedKeysList: unusedKeysArray
    };
}
