// Shared analysis logic for Factorio Mod Localization Helper
// This file is used by both the browser React frontend and the Node.js CLI/Server.

export const PROTOTYPE_SECTIONS = {
    item: { name: 'item-name', desc: 'item-description' },
    entity: { name: 'entity-name', desc: 'entity-description' },
    fluid: { name: 'fluid-name', desc: 'fluid-description' },
    recipe: { name: 'recipe-name', desc: 'recipe-description' },
    tile: { name: 'tile-name', desc: 'tile-description' },
    technology: { name: 'technology-name', desc: 'technology-description' },
    'item-group': { name: 'item-group-name' },
    'item-subgroup': { name: 'item-subgroup-name' },
    equipment: { name: 'equipment-name', desc: 'equipment-description' },
};

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

    const simpleFieldRegex = (fieldName) => new RegExp(`${fieldName}\\s*=\\s*"([^"]+)"`);

    const typeMatch = tableStr.match(simpleFieldRegex('type'));
    if (typeMatch) prototype.type = typeMatch[1];

    const nameValueMatch = tableStr.match(/name\s*=\s*("([^"]+)"|[^,{}]+)/);
    if (nameValueMatch) {
        if (nameValueMatch[2]) {
            prototype.name = nameValueMatch[2];
        } else {
            prototype.name = 'DYNAMICALLY_GENERATED';
        }
    }

    const placeResultMatch = tableStr.match(simpleFieldRegex('place_result'));
    if (placeResultMatch) prototype.place_result = placeResultMatch[1];

    const placedAsEquipmentResultMatch = tableStr.match(simpleFieldRegex('placed_as_equipment_result'));
    if (placedAsEquipmentResultMatch) prototype.placed_as_equipment_result = placedAsEquipmentResultMatch[1];

    const mainProductMatch = tableStr.match(simpleFieldRegex('main_product'));
    if (mainProductMatch) prototype.main_product = mainProductMatch[1];

    const categoryMatch = tableStr.match(simpleFieldRegex('category'));
    if (categoryMatch) prototype.category = categoryMatch[1];

    const arrayFieldRegex = (fieldName) => new RegExp(`${fieldName}\\s*=\\s*\\{([\\s\\S]*?)\\}`, 'm');

    const productsMatch = tableStr.match(arrayFieldRegex('products'));
    if (productsMatch) {
        prototype.products = productsMatch[1].match(/"([^"]+)"/g)?.map(s => s.replace(/"/g, '')) || [];
    }

    const allowedValuesMatch = tableStr.match(arrayFieldRegex('allowed_values'));
    if (allowedValuesMatch) {
        prototype.allowed_values = allowedValuesMatch[1].match(/"([^"]+)"/g)?.map(s => s.replace(/"/g, '')) || [];
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
    const allLangs = ['en', ...Object.keys(localeFiles).filter(l => l !== 'en')];

    for (const lang of allLangs) {
        if (!localeFiles[lang]) continue;
        for (const content of localeFiles[lang]) {
            let currentSection = '';
            content.split(/\r?\n/).forEach(line => {
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
                        }
                    }
                }
            });
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

    const addMissing = (section, key) => {
        if (vanillaNames.has(key)) return;
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
        dynamicPrefixes.add(concatMatch[2]);
    }

    prototypes.forEach(p => {
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

        const baseName = p.type.replace(/_/g, '-');
        const explicitSections = PROTOTYPE_SECTIONS[p.type];
        if (explicitSections) {
            markUsed(explicitSections.name, p.name);
            if (explicitSections.desc) markUsed(explicitSections.desc, p.name);
        } else {
            markUsed(`${baseName}-name`, p.name);
            if (prototypesDb.has(p.type)) markUsed(`${baseName}-description`, p.name);
        }

        let found = false;
        if (p.type === 'item') {
            if (p.place_result) markUsed('entity-name', p.place_result);
            if (p.placed_as_equipment_result) markUsed('equipment-name', p.placed_as_equipment_result);

            if (p.place_result && (existingLocale['entity-name']?.[p.place_result] || vanillaNames.has(p.place_result))) found = true;
            if (!found && p.placed_as_equipment_result && (existingLocale['equipment-name']?.[p.placed_as_equipment_result] || vanillaNames.has(p.placed_as_equipment_result))) found = true;
            if (!found) {
                addMissing('item-name', p.name);
                addMissing('item-description', p.name);
            }
        } else if (p.type === 'recipe') {
            if (p.main_product) {
                markUsed('item-name', p.main_product);
                markUsed('fluid-name', p.main_product);
            }
            if (p.products && p.products.length > 0) {
                markUsed('item-name', p.products[0]);
                markUsed('fluid-name', p.products[0]);
            }
            const checkProd = (prodName) => prodName && (existingLocale['item-name']?.[prodName] || existingLocale['fluid-name']?.[prodName] || vanillaNames.has(prodName));
            if (checkProd(p.main_product)) found = true;
            if (!found && p.products && p.products.length > 0 && checkProd(p.products[0])) found = true;
            if (!found) {
                addMissing('recipe-name', p.name);
                addMissing('recipe-description', p.name);
            }
        } else if (p.type.endsWith('-setting')) {
            addMissing('mod-setting-name', p.name);
            addMissing('mod-setting-description', p.name);
            if (p.type === 'string-setting' && p.allowed_values) {
                p.allowed_values.forEach(val => {
                    markUsed('string-mod-setting', `${p.name}-${val}`);
                    markUsed('string-mod-setting-description', `${p.name}-${val}`);
                    addMissing('string-mod-setting', `${p.name}-${val}`);
                    addMissing('string-mod-setting-description', `${p.name}-${val}`);
                });
            }
        } else {
            const sections = PROTOTYPE_SECTIONS[p.type];
            if (sections) {
                addMissing(sections.name, p.name);
                if (sections.desc) {
                    addMissing(sections.desc, p.name);
                }
            } else {
                const baseName = p.type.replace(/_/g, '-');
                addMissing(`${baseName}-name`, p.name);
                if (prototypesDb.has(p.type)) {
                    addMissing(`${baseName}-description`, p.name);
                }
            }
        }
    });

    const sectionOrder = [
        'mod-name', 'mod-description', 'mod-setting-name', 'mod-setting-description',
        'string-mod-setting', 'string-mod-setting-description', 'item-group-name',
        'item-subgroup-name', 'item-name', 'item-description', 'fluid-name', 'fluid-description',
        'recipe-name', 'recipe-description', 'entity-name', 'entity-description',
        'equipment-name', 'equipment-description', 'tile-name', 'tile-description', 'technology-name', 'technology-description'
    ];

    const allKnownSections = new Set([...Object.keys(existingLocale), ...Object.keys(missingKeys)]);
    const allSections = [...sectionOrder.filter(s => allKnownSections.has(s)), ...[...allKnownSections].sort().filter(s => !sectionOrder.includes(s))];

    let masterCfgContent = '';
    for (const section of allSections) {
        masterCfgContent += `[${section}]\n`;
        const existingKeys = Object.keys(existingLocale[section] || {}).sort();
        for (const key of existingKeys) {
            const dynamicComment = dynamicTemplateKeys.get(`${section}:${key}`);
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
            if (vanillaNames.has(key) && section !== 'mod-name' && section !== 'mod-description') {
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

                const isUsed = usedKeys.has(`${section}:${key}`) || explicitStrings.has(fullKeyStr) || knownPrototypeNames.has(key);
                if (!isUsed && existingLocale[section]?.[key] && section !== 'mod-name' && section !== 'mod-description') {
                    if (!unusedInSection[section]) unusedInSection[section] = [];
                    unusedInSection[section].push(key);

                    if (removeUnusedKeys) {
                        continue;
                    }
                }

                sectionHasModKeys = true;

                const dynamicComment = dynamicTemplateKeys.get(`${section}:${key}`);
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
