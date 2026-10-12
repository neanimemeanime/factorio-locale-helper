import React, { createContext, useContext, useState, useEffect } from 'react';

export type UiLang = 'en' | 'ru';

export const translations = {
    en: {
        // App header
        'app.title': 'Factorio Mod Localization Helper',
        'app.subtitle': 'Comprehensive tool for prototype analysis, batch missing key scanning, syntax validation, and quality auditing for Factorio 2.1+ (Space Age) mods.',

        // Navigation tabs
        'nav.analyzer': 'Mod Analyzer',
        'nav.missing': 'Missing Keys',
        'nav.audit': 'Quality Audit',

        // Server Status Bar
        'status.server': 'Local API Server',
        'status.online': 'Online',
        'status.offline': 'Offline (Run: npm run server)',
        'status.modsDir': 'Mods Dir',
        'status.targetMod': 'Target Mod',
        'status.targetLang': 'Target Language',
        'status.gameData': 'Factorio Game Data',
        'status.notDetected': 'Auto-detected / Offline fallback',
        'status.uiLang': 'Interface Language',

        // Mod Analyzer Tab
        'analyzer.title': 'Factorio 2.1+ Static Mod Prototype Analyzer',
        'analyzer.dropzone': 'Drag & Drop unpacked mod folder or .zip archive here',
        'analyzer.or': 'or choose source manually',
        'analyzer.chooseFolder': 'Select unpacked folder',
        'analyzer.chooseZip': 'Select .zip file',
        'analyzer.folderSelected': 'Selected mod folder',
        'analyzer.zipSelected': 'Selected archive',
        'analyzer.targetLang': 'Target Locale Language',
        'analyzer.removeUnused': 'Remove unused keys from cleaned .cfg (Warning: may remove dynamically constructed keys)',
        'analyzer.removeUnusedDesc': 'Automatically strips keys present in .cfg but no longer referenced in Lua prototypes or scripts',
        'analyzer.directFolder': 'Direct local folder analysis & autosave',
        'analyzer.scanFolder': 'Scan Folder',
        'analyzer.sourceCfg': 'Source Mod .cfg',
        'analyzer.cleanedCfg': 'Cleaned .cfg (Mod Only)',
        'analyzer.saveToFolder': 'Save to Folder',
        'analyzer.analysisLog': 'Analysis Log (Removed Vanilla Keys)',
        'analyzer.downloadRemovedVanilla': 'Download Removed Vanilla Keys',
        'analyzer.downloadUnused': 'Download Unused Keys',
        'analyzer.hardcodedTitle': 'Hardcoded & Untranslatable Strings',
        'analyzer.hardcodedDesc': 'These strings were detected in Lua scripts and may require localization keys.',
        'analyzer.colFile': 'File',
        'analyzer.colLine': 'Line',
        'analyzer.colType': 'Type',
        'analyzer.colCode': 'Code',
        'analyzer.colDesc': 'Description',
        'analyzer.colSection': 'Section',
        'analyzer.vanillaKeysFound': 'Vanilla Keys Found',
        'analyzer.unusedKeysTitle': 'Unused Keys',
        'analyzer.analyzeBtn': 'Analyze Mod',
        'analyzer.analyzing': 'Analyzing prototypes & scripts...',
        'analyzer.error': 'Analysis failed',
        'analyzer.success': 'Analysis completed successfully',
        'analyzer.kpiPrototypes': 'Prototypes Found',
        'analyzer.kpiLocKeys': 'Locale Keys Required',
        'analyzer.kpiMissing': 'Missing Translations',
        'analyzer.kpiUnused': 'Unused Keys',
        'analyzer.generatedCfg': 'Generated .cfg Preview',
        'analyzer.copyCfg': 'Copy .cfg',
        'analyzer.downloadCfg': 'Download .cfg',
        'analyzer.saveToMod': 'Save directly to mod locale folder',
        'analyzer.saving': 'Saving...',
        'analyzer.saveSuccess': 'Saved successfully to',

        // Missing Keys Tab
        'missing.optionsTitle': 'Missing Keys Scanner Options',
        'missing.modsDirLabel': 'Factorio Mods Directory',
        'missing.targetModLabel': 'Target Localization Mod',
        'missing.filterModLabel': 'Filter Specific Mod (optional)',
        'missing.filterPlaceholder': 'All active mods',
        'missing.autoMergeLabel': 'Automatically append missing keys into target mod files',
        'missing.resetPaths': 'Reset Paths',
        'missing.scanBtn': 'Scan Active Mods',
        'missing.scanning': 'Scanning...',
        'missing.serverOffline': 'Local API server is not running. To scan active mods and inspect files, run in console: npm run server',
        'missing.kpiActiveMods': 'Active Mods',
        'missing.kpiModsWithMissing': 'Mods With Missing Keys',
        'missing.kpiTotalMissing': 'Total Missing Keys',
        'missing.kpiFilesUpdated': 'Files Updated',
        'missing.modList': 'Mod List',
        'missing.filterByName': 'Filter by name...',
        'missing.noModsFound': 'No mods found',
        'missing.inPack': 'In Pack',
        'missing.newFile': 'New File',
        'missing.archiveLabel': 'Archive',
        'missing.statusLabel': 'Status',
        'missing.statusInPack': 'Exists in localization pack',
        'missing.statusNew': 'File not created yet',
        'missing.copyCfg': 'Copy .cfg',
        'missing.downloadCfg': 'Download .cfg',
        'missing.mergeInto': 'Merge into',
        'missing.merging': 'Writing...',
        'missing.missingKeysTitle': 'Missing Keys',
        'missing.tableView': 'Table',
        'missing.rawView': 'Raw .cfg',
        'missing.colKey': 'Key',
        'missing.colOriginal': 'Original Text (EN)',
        'missing.colActions': 'Actions',
        'missing.copyKeyBtn': 'Key',
        'missing.copyStringBtn': 'String',
        'missing.selectModPrompt': 'Select a mod from the list on the left to view missing keys',
        'missing.allDoneTitle': 'All active mods are fully localized',
        'missing.allDoneDesc': 'Checked active mod(s). No missing keys detected.',
        'missing.keysWritten': 'Keys successfully written to',
        'missing.copiedKey': 'Key copied',
        'missing.copiedString': 'String copied',
        'missing.copiedClipboard': 'Copied to clipboard',

        // Quality Audit Tab
        'audit.optionsTitle': 'Locale Quality Audit Options',
        'audit.targetDirLabel': 'Localization Directory (.cfg)',
        'audit.modsDirLabel': 'Factorio Mods Directory (for EN reference)',
        'audit.filterModLabel': 'Filter Specific Mod (optional)',
        'audit.filterPlaceholder': 'e.g. planet-rabbasca',
        'audit.issueLimitLabel': 'Issue Limit',
        'audit.limit100': '100 issues',
        'audit.limit250': '250 issues',
        'audit.limit500': '500 issues',
        'audit.limitAll': 'No limit (all found)',
        'audit.resetPaths': 'Reset Paths',
        'audit.runBtn': 'Run Quality Audit',
        'audit.auditing': 'Auditing...',
        'audit.serverOffline': 'Local API server is not running. To audit localization files, run in console: npm run server',
        'audit.kpiFilesAudited': 'Files Audited',
        'audit.kpiTotalIssues': 'Total Issues',
        'audit.kpiTagMismatch': 'Tag Mismatches',
        'audit.kpiForeignChars': 'Foreign Characters',
        'audit.kpiMixedLang': 'Mixed Language',
        'audit.kpiUntranslated': 'Untranslated (EN)',
        'audit.filterAll': 'All',
        'audit.filterTags': 'Tags & Placeholders',
        'audit.filterForeign': 'Foreign Chars',
        'audit.filterMixed': 'Mixed Language',
        'audit.filterUntranslated': 'Untranslated',
        'audit.searchPlaceholder': 'Search strings, keys, or mods...',
        'audit.foundCount': 'Found',
        'audit.showingFirst': 'Showing first',
        'audit.of': 'of',
        'audit.issues': 'issues. Adjust filter or increase limit to see more.',
        'audit.noIssuesCategory': 'No issues found in selected category.',
        'audit.colCategory': 'Category',
        'audit.colModSection': 'Mod / Section',
        'audit.colKeyContent': 'Key & Content',
        'audit.colActions': 'Actions',
        'audit.missingTags': 'Missing tags',
        'audit.words': 'Words',
        'audit.chars': 'Characters',
        'audit.original': 'Original (EN)',
        'audit.translation': 'Translation',
        'audit.copyKeyBtn': 'Key',
        'audit.copyStringBtn': 'String',
        'audit.noIssuesTitle': 'No quality issues detected',
        'audit.noIssuesDesc': 'Audited files. All tags, placeholders, and language constraints verified.',
        'audit.badgeTags': 'TAGS',
        'audit.badgeForeign': 'FOREIGN',
        'audit.badgeMixed': 'MIXED',
        'audit.badgeUntranslated': 'UNTRANSLATED'
    },
    ru: {
        // Заголовок приложения
        'app.title': 'Помощник локализации модов Factorio',
        'app.subtitle': 'Инструмент анализа прототипов, пакетного поиска недостающих ключей, валидации синтаксиса и контроля качества переводов Factorio 2.1+ (Space Age).',

        // Вкладки навигации
        'nav.analyzer': 'Анализ мода',
        'nav.missing': 'Недостающие ключи',
        'nav.audit': 'Аудит качества',

        // Панель состояния сервера
        'status.server': 'Локальный API сервер',
        'status.online': 'Подключен',
        'status.offline': 'Отключен (Запустите: npm run server)',
        'status.modsDir': 'Папка модов',
        'status.targetMod': 'Целевой мод',
        'status.targetLang': 'Язык перевода',
        'status.gameData': 'Данные Factorio',
        'status.notDetected': 'Автопоиск / Оффлайн-словарь',
        'status.uiLang': 'Язык интерфейса',

        // Вкладка анализа мода
        'analyzer.title': 'Статический анализатор прототипов Factorio 2.1+',
        'analyzer.dropzone': 'Перетащите сюда архив мода .zip',
        'analyzer.or': 'или выберите источник вручную',
        'analyzer.chooseFolder': 'Выбрать папку мода',
        'analyzer.chooseZip': 'Выбрать архив .zip',
        'analyzer.folderSelected': 'Выбрана папка мода',
        'analyzer.zipSelected': 'Выбран архив',
        'analyzer.targetLang': 'Целевой язык локализации',
        'analyzer.removeUnused': 'Удалять неиспользуемые ключи из очищенного .cfg (Внимание: может удалить динамические ключи)',
        'analyzer.removeUnusedDesc': 'Автоматически удаляет строки, присутствующие в .cfg, но больше не используемые в прототипах или Lua коде',
        'analyzer.directFolder': 'Анализ локальной папки и автосохранение',
        'analyzer.scanFolder': 'Сканировать папку',
        'analyzer.sourceCfg': 'Исходный .cfg мода',
        'analyzer.cleanedCfg': 'Очищенный .cfg (Только мод)',
        'analyzer.saveToFolder': 'Сохранить в папку',
        'analyzer.analysisLog': 'Лог анализа (Удаленные ванильные ключи)',
        'analyzer.downloadRemovedVanilla': 'Скачать удаленные ванильные ключи',
        'analyzer.downloadUnused': 'Скачать неиспользуемые ключи',
        'analyzer.hardcodedTitle': 'Захардкоженные и непереводимые строки',
        'analyzer.hardcodedDesc': 'Эти строки найдены в скриптах Lua и могут требовать ключей локализации.',
        'analyzer.colFile': 'Файл',
        'analyzer.colLine': 'Строка',
        'analyzer.colType': 'Тип',
        'analyzer.colCode': 'Код',
        'analyzer.colDesc': 'Описание',
        'analyzer.colSection': 'Секция',
        'analyzer.vanillaKeysFound': 'Найдены ванильные ключи',
        'analyzer.unusedKeysTitle': 'Неиспользуемые ключи',
        'analyzer.analyzeBtn': 'Анализировать мод',
        'analyzer.analyzing': 'Анализ прототипов и скриптов...',
        'analyzer.error': 'Ошибка анализа',
        'analyzer.success': 'Анализ успешно завершён',
        'analyzer.kpiPrototypes': 'Найдено прототипов',
        'analyzer.kpiLocKeys': 'Требуется ключей',
        'analyzer.kpiMissing': 'Не хватает перевода',
        'analyzer.kpiUnused': 'Неиспользуемых строк',
        'analyzer.generatedCfg': 'Предпросмотр сгенерированного .cfg',
        'analyzer.copyCfg': 'Скопировать .cfg',
        'analyzer.downloadCfg': 'Скачать .cfg',
        'analyzer.saveToMod': 'Сохранить напрямую в папку locale мода',
        'analyzer.saving': 'Сохранение...',
        'analyzer.saveSuccess': 'Успешно сохранено в',

        // Вкладка поиска недостающих ключей
        'missing.optionsTitle': 'Параметры поиска недостающих ключей',
        'missing.modsDirLabel': 'Папка модов Factorio',
        'missing.targetModLabel': 'Целевой мод локализации',
        'missing.filterModLabel': 'Фильтр по конкретному моду (опционально)',
        'missing.filterPlaceholder': 'Все активные моды',
        'missing.autoMergeLabel': 'Автоматически вносить недостающие ключи в файлы целевого мода',
        'missing.resetPaths': 'Сбросить пути',
        'missing.scanBtn': 'Сканировать активные моды',
        'missing.scanning': 'Сканирование...',
        'missing.serverOffline': 'Локальный API сервер не запущен. Для сканирования активных модов и считывания файлов запустите в консоли: npm run server',
        'missing.kpiActiveMods': 'Активных модов',
        'missing.kpiModsWithMissing': 'Модов с нехваткой',
        'missing.kpiTotalMissing': 'Всего недостающих строк',
        'missing.kpiFilesUpdated': 'Обновлено файлов',
        'missing.modList': 'Список модов',
        'missing.filterByName': 'Фильтр по названию...',
        'missing.noModsFound': 'Моды не найдены',
        'missing.inPack': 'В паке',
        'missing.newFile': 'Новый файл',
        'missing.archiveLabel': 'Архив',
        'missing.statusLabel': 'Статус',
        'missing.statusInPack': 'Существует в паке перевода',
        'missing.statusNew': 'Файл ещё не создан',
        'missing.copyCfg': 'Скопировать .cfg',
        'missing.downloadCfg': 'Скачать .cfg',
        'missing.mergeInto': 'Внести в',
        'missing.merging': 'Запись...',
        'missing.missingKeysTitle': 'Отсутствующие ключи',
        'missing.tableView': 'Таблица',
        'missing.rawView': 'Текст .cfg',
        'missing.colKey': 'Ключ',
        'missing.colOriginal': 'Оригинальный текст (EN)',
        'missing.colActions': 'Действия',
        'missing.copyKeyBtn': 'Ключ',
        'missing.copyStringBtn': 'Строка',
        'missing.selectModPrompt': 'Выберите мод из списка слева для просмотра отсутствующих ключей',
        'missing.allDoneTitle': 'Все активные моды полностью переведены',
        'missing.allDoneDesc': 'Проверено активных модов. Отсутствующих ключей не обнаружено.',
        'missing.keysWritten': 'Ключи успешно записаны в',
        'missing.copiedKey': 'Ключ скопирован',
        'missing.copiedString': 'Строка скопирована',
        'missing.copiedClipboard': 'Скопировано в буфер обмена',

        // Вкладка аудита качества
        'audit.optionsTitle': 'Параметры аудита качества локализации',
        'audit.targetDirLabel': 'Папка с переводами (.cfg)',
        'audit.modsDirLabel': 'Папка модов Factorio (для сверки с EN)',
        'audit.filterModLabel': 'Фильтр по конкретному моду (опционально)',
        'audit.filterPlaceholder': 'Например, planet-rabbasca',
        'audit.issueLimitLabel': 'Лимит замечаний',
        'audit.limit100': '100 замечаний',
        'audit.limit250': '250 замечаний',
        'audit.limit500': '500 замечаний',
        'audit.limitAll': 'Без лимита (все найденные)',
        'audit.resetPaths': 'Сбросить пути',
        'audit.runBtn': 'Запустить аудит качества',
        'audit.auditing': 'Проверка...',
        'audit.serverOffline': 'Локальный API сервер не запущен. Для аудита файлов локализации запустите в консоли: npm run server',
        'audit.kpiFilesAudited': 'Проверено файлов',
        'audit.kpiTotalIssues': 'Всего замечаний',
        'audit.kpiTagMismatch': 'Несовпадения тегов',
        'audit.kpiForeignChars': 'Символы языков',
        'audit.kpiMixedLang': 'Смесь языков',
        'audit.kpiUntranslated': 'Без перевода (EN)',
        'audit.filterAll': 'Все',
        'audit.filterTags': 'Теги и плейсхолдеры',
        'audit.filterForeign': 'Иероглифы',
        'audit.filterMixed': 'Смесь языков',
        'audit.filterUntranslated': 'Без перевода',
        'audit.searchPlaceholder': 'Поиск по строкам, ключам или моду...',
        'audit.foundCount': 'Найдено',
        'audit.showingFirst': 'Показаны первые',
        'audit.of': 'из',
        'audit.issues': 'замечаний. Измените фильтр или увеличьте лимит для просмотра остальных.',
        'audit.noIssuesCategory': 'В выбранной категории замечаний не найдено.',
        'audit.colCategory': 'Категория',
        'audit.colModSection': 'Мод / Секция',
        'audit.colKeyContent': 'Ключ и Содержимое',
        'audit.colActions': 'Действия',
        'audit.missingTags': 'Пропущенные теги',
        'audit.words': 'Слова',
        'audit.chars': 'Символы',
        'audit.original': 'Оригинал (EN)',
        'audit.translation': 'Перевод',
        'audit.copyKeyBtn': 'Ключ',
        'audit.copyStringBtn': 'Строку',
        'audit.noIssuesTitle': 'Замечаний к качеству перевода не обнаружено',
        'audit.noIssuesDesc': 'Проверены файлы. Все теги, плейсхолдеры и языковые нормы соблюдены.',
        'audit.badgeTags': 'ТЕГИ',
        'audit.badgeForeign': 'ИЕРОГЛИФЫ',
        'audit.badgeMixed': 'СМЕСЬ',
        'audit.badgeUntranslated': 'АНГЛИЙСКИЙ'
    }
} as const;

export type TranslationKey = keyof typeof translations['en'];

interface I18nContextType {
    uiLang: UiLang;
    setUiLang: (lang: UiLang) => void;
    t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType>({
    uiLang: 'en',
    setUiLang: () => {},
    t: (key) => key
});

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [uiLang, setUiLangState] = useState<UiLang>(() => {
        try {
            const saved = localStorage.getItem('factorio_gui_lang');
            if (saved === 'ru' || saved === 'en') return saved;
            // Detect user language from browser
            if (typeof navigator !== 'undefined' && navigator.language?.startsWith('ru')) {
                return 'ru';
            }
        } catch (_) {}
        return 'en';
    });

    const setUiLang = (lang: UiLang) => {
        setUiLangState(lang);
        try {
            localStorage.setItem('factorio_gui_lang', lang);
        } catch (_) {}
    };

    const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
        const langDict = translations[uiLang] || translations.en;
        let str: string = (langDict as Record<string, string>)[key] || (translations.en as Record<string, string>)[key] || key;
        if (params) {
            for (const [k, v] of Object.entries(params)) {
                str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
            }
        }
        return str;
    };

    return (
        <I18nContext.Provider value={{ uiLang, setUiLang, t }}>
            {children}
        </I18nContext.Provider>
    );
};

export const useI18n = () => useContext(I18nContext);
