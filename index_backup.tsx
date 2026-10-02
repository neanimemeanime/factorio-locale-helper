import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom/client';

declare const JSZip: any;

type Prototype = {
    type: string;
    name: string;
    place_result?: string;
    placed_as_equipment_result?: string;
    main_product?: string;
    products?: string[];
    allowed_values?: string[];
    category?: string;
};

type LocalizationData = { [section: string]: { [key: string]: string } };
type MissingKeys = { [section: string]: Set<string> };

export type HardcodedStringIssue = {
    file: string;
    line: number;
    code: string;
    type: 'hardcoded' | 'untranslatable';
    message: string;
};

const PROTOTYPE_SECTIONS: { [type: string]: { name: string, desc?: string } } = {
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

const App: React.FC = () => {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [modName, setModName] = useState('mod');
    const [generatedCfg, setGeneratedCfg] = useState('');
    const [cleanedCfg, setCleanedCfg] = useState('');
    const [removedKeysCfg, setRemovedKeysCfg] = useState('');
    const [analysisLog, setAnalysisLog] = useState('');
    const [prototypesDb, setPrototypesDb] = useState<Set<string>>(new Set());

    const [removeUnusedKeys, setRemoveUnusedKeys] = useState(false);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [unusedKeysCfg, setUnusedKeysCfg] = useState('');
    const [hardcodedIssues, setHardcodedIssues] = useState<HardcodedStringIssue[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const fetchPrototypes = async () => {
            try {
                const response = await fetch('Prototypes.txt');
                const text = await response.text();
                const names = new Set(text.split(/\r?\n/).filter(Boolean));
                setPrototypesDb(names);
            } catch (e) {
                console.error("Could not load Prototypes.txt", e);
                // Можно установить ошибку, если этот файл критичен
            }
        };
        fetchPrototypes();
    }, []);

    const handleFileSelect = (files: FileList | null) => {
        if (files && files.length > 0) {
            setUploadedFile(files[0]);
        } else {
            setError('No file selected.');
        }
    };

    useEffect(() => {
        if (uploadedFile) {
            analyzeMod(uploadedFile);
        }
    }, [uploadedFile, removeUnusedKeys]);

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        handleFileSelect(e.dataTransfer.files);
    };

    const handleDragEvents = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setIsDragOver(true);
        } else if (e.type === 'dragleave') {
            setIsDragOver(false);
        }
    };

    const extractLuaTables = (str: string): string[] => {
        const tables: string[] = [];
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
    };

    const parseSinglePrototype = (tableStr: string): Partial<Prototype> => {
        const prototype: Partial<Prototype> = {};

        const simpleFieldRegex = (fieldName: string) => new RegExp(`${fieldName}\\s*=\\s*"([^"]+)"`);

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
        if (categoryMatch) (prototype as any).category = categoryMatch[1];

        const arrayFieldRegex = (fieldName: string) => new RegExp(`${fieldName}\\s*=\\s*\\{([\\s\\S]*?)\\}`, 'm');

        const productsMatch = tableStr.match(arrayFieldRegex('products'));
        if (productsMatch) {
            prototype.products = productsMatch[1].match(/"([^"]+)"/g)?.map(s => s.replace(/"/g, '')) || [];
        }

        const allowedValuesMatch = tableStr.match(arrayFieldRegex('allowed_values'));
        if (allowedValuesMatch) {
            prototype.allowed_values = allowedValuesMatch[1].match(/"([^"]+)"/g)?.map(s => s.replace(/"/g, '')) || [];
        }

        return prototype;
    };

    const parsePrototypes = (luaCode: string): Prototype[] => {
        const code = luaCode.replace(/--\[\[[\s\S]*?\]\]/g, '').replace(/--.*/g, '');
        const extendRegex = /data:extend\s*\(\s*\{([\s\S]*?)\}\s*\)/g;
        const prototypes: Prototype[] = [];
        let match;
        while ((match = extendRegex.exec(code)) !== null) {
            const extendContent = match[1];
            const tables = extractLuaTables(extendContent);
            for (const tableStr of tables) {
                const parsed = parseSinglePrototype(tableStr);
                if (parsed.type && parsed.name) {
                    prototypes.push(parsed as Prototype);
                }
            }
        }
        return prototypes;
    };

    const analyzeMod = useCallback(async (file: File) => {
        if (!file.name.endsWith('.zip')) {
            setError('Please upload a valid .zip file.');
            return;
        }

        setIsAnalyzing(true);
        setError(null);
        setGeneratedCfg('');
        setCleanedCfg('');
        setRemovedKeysCfg('');
        setAnalysisLog('');
        setHardcodedIssues([]);

        try {
            const zip = await JSZip.loadAsync(file);
            let info: any = {};
            let luaCode = '';
            const localeFiles: { [lang: string]: string[] } = { en: [] };

            const vanillaNames = new Set(await (await fetch('Internal_names.txt')).text().then(t => t.split(/\r?\n/)));

            const foundIssues: HardcodedStringIssue[] = [];

            for (const path in zip.files) {
                if (/[^/]+\/info\.json$/.test(path)) {
                    info = JSON.parse(await zip.files[path].async('string'));
                }
                else if (path.endsWith('.lua') && !zip.files[path].dir) {
                    const content = await zip.files[path].async('string');
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
                            // Helper to remove all `{...}` blocks (valid localization tables) from the expression
                            // This prevents false positives when a valid table is used in an expression like `var or {"key"}`
                            let strippedExpression = '';
                            let braceDepth = 0;
                            for (let char of expression) {
                                if (char === '{') braceDepth++;
                                else if (char === '}') braceDepth = Math.max(0, braceDepth - 1);
                                else if (braceDepth === 0) strippedExpression += char;
                            }

                            // If there is still code left outside of {...} tables, analyze it
                            if (strippedExpression.trim().length > 0) {
                                let isIssue = false;
                                let issueType: 'hardcoded' | 'untranslatable' = 'hardcoded';
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
                                    foundIssues.push({ file: path, line: i + 1, code: line.trim(), type: issueType, message });
                                }
                            }
                        }
                    }
                }
                else if (/\/locale\/([a-zA-Z-]+)\/.*\.cfg$/.test(path) && !zip.files[path].dir) {
                    const langMatch = path.match(/\/locale\/([a-zA-Z-]+)\//);
                    if (langMatch && langMatch[1]) {
                        const lang = langMatch[1];
                        if (!localeFiles[lang]) localeFiles[lang] = [];
                        localeFiles[lang].push(await zip.files[path].async('string'));
                    }
                }
            }
            setModName(info.name || 'mod');

            const existingLocale: LocalizationData = {};
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

            const missingKeys: MissingKeys = {};
            const usedKeys = new Set<string>();
            const knownPrototypeNames = new Set<string>();

            const markUsed = (section: string, key: string) => {
                usedKeys.add(`${section}:${key}`);
            };

            const addMissing = (section: string, key: string) => {
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

            const dynamicTemplateKeys = new Map<string, string>(); // <'section:key', comment>
            const explicitStrings = new Set<string>();
            const dynamicPrefixes = new Set<string>();

            // 1. Strict explicit strings: {"category.key"}
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

            // 2. Dynamic concatenation prefixes: {"category.prefix" .. variable}
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
                    const checkProd = (prodName?: string) => prodName && (existingLocale['item-name']?.[prodName] || existingLocale['fluid-name']?.[prodName] || vanillaNames.has(prodName));
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
                    // ИСПРАВЛЕННЫЙ КОД
                } else {
                    const sections = PROTOTYPE_SECTIONS[p.type];
                    if (sections) {
                        // Используем явное правило, если оно есть
                        addMissing(sections.name, p.name);
                        if (sections.desc) {
                            addMissing(sections.desc, p.name);
                        }
                    } else {
                        // Если явного правила нет, используем базу данных из Prototypes.txt
                        const baseName = p.type.replace(/_/g, '-');
                        addMissing(`${baseName}-name`, p.name);

                        // ИЩЕМ ОПИСАНИЕ, ТОЛЬКО ЕСЛИ ЭТО ОФИЦИАЛЬНЫЙ ТИП ПРОТОТИПА
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
            setGeneratedCfg(masterCfgContent.trim());

            let cleanedCfgContent = '';
            let removedKeysContent = '# This file lists all vanilla Factorio keys that were removed from your mod\'s localization file.\n\n';
            let unusedKeysContentStr = '# This file lists all UNUSED references that were removed because they were not found in any .lua script or prototype.\n\n';
            const log: string[] = [];
            const removedInSection: { [section: string]: string[] } = {};
            const unusedInSection: { [section: string]: string[] } = {};

            for (const section of allSections) {
                let sectionHasModKeys = false;
                let sectionContent = '';
                const keys = new Set([...Object.keys(existingLocale[section] || {}), ...(missingKeys[section] || [])]);
                const sortedKeys = [...keys].sort();

                // ИСПРАВЛЕННЫЙ, ПРАВИЛЬНЫЙ КОД
                for (const key of sortedKeys) {
                    if (vanillaNames.has(key) && section !== 'mod-name' && section !== 'mod-description') {
                        if (!removedInSection[section]) removedInSection[section] = [];
                        removedInSection[section].push(key);
                    } else {

                        // Check if it matches any dynamic concatenation prefix
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

                        // --- НОВАЯ ЛОГИКА ---
                        // 1. Проверяем, есть ли для этого ключа динамический комментарий
                        const dynamicComment = dynamicTemplateKeys.get(`${section}:${key}`);
                        if (dynamicComment) {
                            // Если есть, добавляем его
                            sectionContent += `${dynamicComment}\n`;
                        }

                        // 2. Добавляем сам ключ=значение
                        if (existingLocale[section]?.[key]) {
                            // Если ключ уже существовал
                            sectionContent += `${key}=${existingLocale[section][key]}\n`;
                        } else {
                            // Если это новый, отсутствующий ключ, добавляем и его стандартный комментарий
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

            Object.keys(removedInSection).sort().forEach(section => {
                log.push(`From [${section}], removed vanilla: ${removedInSection[section].length} keys`);
                removedKeysContent += `[${section}]\n`;
                removedKeysContent += removedInSection[section].sort().join('\n') + '\n\n';
            });

            Object.keys(unusedInSection).sort().forEach(section => {
                log.push(`From [${section}], found unused: ${unusedInSection[section].length} keys`);
                unusedKeysContentStr += `[${section}]\n`;
                unusedKeysContentStr += unusedInSection[section].sort().join('\n') + '\n\n';
            });

            setCleanedCfg(cleanedCfgContent.trim());
            setAnalysisLog(log.length > 0 ? log.join('\n') : "No vanilla or unused keys found to log.");
            setRemovedKeysCfg(removedKeysContent.trim());
            setUnusedKeysCfg(unusedKeysContentStr.trim());
            setHardcodedIssues(foundIssues);

        } catch (e) {
            console.error(e);
            setError(`An error occurred during analysis: ${(e as Error).message}`);
        } finally {
            setIsAnalyzing(false);
        }
    }, [removeUnusedKeys, prototypesDb]);

    const downloadFile = (content: string, filename: string) => {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const copyToClipboard = (content: string) => {
        navigator.clipboard.writeText(content);
    };

    return (
        <div className="app-container">
            <header>
                <h1>Factorio Mod Localization Helper</h1>
                <p>Upload your mod's <code>.zip</code> file. The tool will analyze your prototypes, find all missing localization keys, and generate a complete <code>.cfg</code> file for you.</p>
                <div className="options-panel panel" style={{ marginTop: '1rem', display: 'inline-block' }}>
                    <label className="checkbox-label">
                        <input
                            type="checkbox"
                            checked={removeUnusedKeys}
                            onChange={(e) => setRemoveUnusedKeys(e.target.checked)}
                        />
                        <span className="checkbox"></span>
                        <div>Remove unused keys from Cleaned .cfg <em>(Warning: May delete dynamically generated keys!)</em></div>
                    </label>
                </div>
            </header>

            <div
                className={`drop-zone panel-inset ${isDragOver ? 'drag-over' : ''}`}
                onDrop={handleDrop}
                onDragOver={handleDragEvents}
                onDragEnter={handleDragEvents}
                onDragLeave={handleDragEvents}
                onClick={() => fileInputRef.current?.click()}
            >
                <input
                    type="file"
                    accept=".zip"
                    onChange={(e) => handleFileSelect(e.target.files)}
                    style={{ display: 'none' }}
                    ref={fileInputRef}
                />
                <h2>Drag & Drop your .zip file here</h2>
                <p>or <strong>click to select a file</strong></p>
            </div>

            <div className="status-container">
                {isAnalyzing && <div className="loader" aria-label="Analyzing..."></div>}
                {error && <div className="error-message panel alert alert-error">{error}</div>}
            </div>

            {generatedCfg && (
                <div className="results-container">
                    <div className="column panel">
                        <div className="column-header">
                            <h3>Generated Source .cfg</h3>
                            <div className="actions">
                                <button className="button" onClick={() => copyToClipboard(generatedCfg)}>Copy</button>
                                <button className="button-green" onClick={() => downloadFile(generatedCfg, `${modName}.source.cfg`)}>Download</button>
                            </div>
                        </div>
                        <textarea className="panel-inset" value={generatedCfg} readOnly aria-label="Generated source CFG content"></textarea>
                    </div>
                    <div className="column panel">
                        <div className="column-header">
                            <h3>Cleaned .cfg (Mod-Only)</h3>
                            <div className="actions">
                                <button className="button" onClick={() => copyToClipboard(cleanedCfg)}>Copy</button>
                                <button className="button-green" onClick={() => downloadFile(cleanedCfg, `${modName}.cfg`)}>Download</button>
                            </div>
                        </div>
                        <textarea className="panel-inset" value={cleanedCfg} readOnly aria-label="Cleaned mod-only CFG content"></textarea>
                        <div className="log-container panel-inset">
                            <h4>Analysis Log (Removed Vanilla Keys)</h4>
                            <p>{analysisLog}</p>
                        </div>
                        <div className="log-actions">
                            <button className="button" onClick={() => downloadFile(removedKeysCfg, `${modName}.vanilla_keys.cfg`)}>
                                Download Removed Vanilla Keys
                            </button>
                            {unusedKeysCfg && unusedKeysCfg.length > 150 && (
                                <button className="button-red" onClick={() => downloadFile(unusedKeysCfg, `${modName}.unused_keys.cfg`)}>
                                    Download Unused Keys List
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {hardcodedIssues.length > 0 && (
                <div className="panel" style={{ marginTop: '2rem' }}>
                    <h3>Hardcoded & Untranslatable Strings ({hardcodedIssues.length})</h3>
                    <p style={{marginBottom: '1rem'}}>
                        These strings were found in the Lua code and may need to be localized or cannot be translated dynamically. You can copy this list to send to the mod author to fix.
                    </p>
                    <div className="table-container panel-inset" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr>
                                    <th style={{ borderBottom: '1px solid #555', padding: '8px' }}>File</th>
                                    <th style={{ borderBottom: '1px solid #555', padding: '8px' }}>Line</th>
                                    <th style={{ borderBottom: '1px solid #555', padding: '8px' }}>Type</th>
                                    <th style={{ borderBottom: '1px solid #555', padding: '8px' }}>Code</th>
                                    <th style={{ borderBottom: '1px solid #555', padding: '8px' }}>Message</th>
                                </tr>
                            </thead>
                            <tbody>
                                {hardcodedIssues.map((issue, idx) => (
                                    <tr key={idx}>
                                        <td style={{ borderBottom: '1px solid #444', padding: '8px', whiteSpace: 'nowrap' }}>{issue.file}</td>
                                        <td style={{ borderBottom: '1px solid #444', padding: '8px' }}>{issue.line}</td>
                                        <td style={{ borderBottom: '1px solid #444', padding: '8px' }}>
                                            <span style={{ color: issue.type === 'untranslatable' ? '#ff6b6b' : '#feca57' }}>
                                                {issue.type.toUpperCase()}
                                            </span>
                                        </td>
                                        <td style={{ borderBottom: '1px solid #444', padding: '8px', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>{issue.code}</td>
                                        <td style={{ borderBottom: '1px solid #444', padding: '8px', fontSize: '0.9em' }}>{issue.message}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div style={{ marginTop: '1rem' }}>
                        <button className="button" onClick={() => copyToClipboard(hardcodedIssues.map(i => `${i.file}:${i.line} [${i.type.toUpperCase()}] ${i.code} - ${i.message}`).join('\n'))}>
                            Copy List to Clipboard
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const container = document.getElementById('root');
const root = ReactDOM.createRoot(container!);
root.render(<App />);