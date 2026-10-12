import assert from 'assert';
import {
    extractFactorioTokens,
    compareTokens,
    detectForeignCharacters,
    cleanFactorioText,
    auditLocaleQuality,
    WHITELIST_WORDS
} from './locale_quality_auditor.js';
import {
    getPrototypeSections,
    analyzeModCore,
    isStandardVanillaSection,
    isProtectedKey
} from './analyzer.js';
import { loadVanillaLocaleData, findSteamFactorioData } from './vanilla_loader.js';
import {
    validateLocaleSyntax,
    fixLocaleSyntax,
    normalizeSectionName
} from './syntax_validator.js';
import { mergeMissingKeysIntoCfg } from './missing_keys_scanner.js';

console.log('=== Running Factorio Locale Quality Audit Tests ===\n');

// 1. User Test Case: bunnyhop-weight with missing [color=green][/color] and __2__
{
    console.log('[Test 1] User Example: missing color tag and placeholder __2__');
    const orig = 'weight: [color=green]__1__[/color]/__2__ kg';
    const trans = 'вес: __1__ kg';

    const tokenCmp = compareTokens(orig, trans);
    assert.deepStrictEqual(tokenCmp.missing.slice().sort(), ['[color=green][/color]', '__2__'].sort(), 'Should report missing [color=green][/color] and __2__');
    assert.strictEqual(tokenCmp.syntaxErrors.length, 0);

    const foreign = detectForeignCharacters(trans);
    assert.ok(foreign, 'Should detect non-Russian letters');
    assert.ok(foreign.languages.includes('en'), 'Should detect English word "kg"');
    assert.deepStrictEqual(foreign.suspiciousLatin, ['kg']);
    console.log('  -> PASS: Correctly identified missing [color=green][/color], __2__ and English "kg"\n');
}

// 2. Nested tags: [color=red][font=default-bold]Text[/font][/color]
{
    console.log('[Test 2] Nested formatting tags');
    const orig = 'Status: [color=red][font=default-bold]Critical __1__[/font][/color]!';
    const trans = 'Статус: [color=red]Критично __1__[/color]!';

    const tokenCmp = compareTokens(orig, trans);
    assert.deepStrictEqual(tokenCmp.missing, ['[font=default-bold][/font]'], 'Should detect missing nested font tag');
    console.log('  -> PASS: Correctly detected missing nested font tag\n');
}

// 3. Standalone tags: item, fluid, entity, etc.
{
    console.log('[Test 3] Standalone prototype tags ([item=...], [planet=...])');
    const orig = 'Requires [item=iron-plate] and [fluid=water] on [planet=vulcanus]';
    const trans = 'Требуется [item=iron-plate] на [planet=vulcanus]';

    const tokenCmp = compareTokens(orig, trans);
    assert.deepStrictEqual(tokenCmp.missing, ['[fluid=water]']);
    console.log('  -> PASS: Correctly detected missing [fluid=water]\n');
}

// 4. Tag syntax errors in translation: unclosed tags
{
    console.log('[Test 4] Tag syntax errors (unclosed [color] tag)');
    const orig = 'Carrying [color=green]__1__[/color]/__2__kg';
    const transBadSyntax = 'Переносимый вес: [color=green]__1__/__2__ кг';

    const tokenCmp = compareTokens(orig, transBadSyntax);
    assert.ok(tokenCmp.syntaxErrors.length > 0, 'Should detect unclosed color tag');
    assert.ok(tokenCmp.missing.includes('[color=green][/color]'));
    console.log('  -> PASS: Correctly detected unclosed color tag syntax error\n');
}

// 5. Foreign scripts detection: Chinese (cn)
{
    console.log('[Test 5] Foreign scripts: Chinese (cn)');
    const cnOnly = '提升保险库质量保证';
    const foreignCn = detectForeignCharacters(cnOnly);
    assert.ok(foreignCn);
    assert.strictEqual(foreignCn.hasCyrillic, false);
    assert.ok(foreignCn.languages.includes('cn'));
    assert.deepStrictEqual(foreignCn.cjkWords, ['提升保险库质量保证']);
    console.log('  -> PASS: Correctly detected Chinese text\n');
}

// 6. Foreign scripts detection: Japanese (jp)
{
    console.log('[Test 6] Foreign scripts: Japanese Katakana (jp)');
    const jpMixed = 'Прыжок ウサギ __1__';
    const foreignJp = detectForeignCharacters(jpMixed);
    assert.ok(foreignJp);
    assert.strictEqual(foreignJp.hasCyrillic, true);
    assert.ok(foreignJp.languages.includes('jp'));
    assert.deepStrictEqual(foreignJp.cjkWords, ['ウサギ']);
    console.log('  -> PASS: Correctly detected Japanese Katakana in Russian string\n');
}

// 7. Whitelisted technical terms should NOT trigger foreign warnings
{
    console.log('[Test 7] Whitelisted technical terms (GUI, Shift, MW, MK2)');
    const validRussian = 'Нажмите [font=default-bold]Shift[/font] для открытия GUI генератора MK2 на 20 MW.';
    const foreignValid = detectForeignCharacters(validRussian);
    assert.strictEqual(foreignValid, null, 'Whitelisted technical terms must not be flagged');
    console.log('  -> PASS: Whitelist properly exempted technical acronyms and units\n');
}

// 8. Brand names, mod names, and expansions (eneas, discord, etc.) MUST be flagged as errors
{
    console.log('[Test 8] Brand names & mod names must be flagged (e.g. eneas -> энеас)');
    const brandString = 'Реактор eneas на планете foliax для Factorio в Discord';
    const foreignBrand = detectForeignCharacters(brandString);
    assert.ok(foreignBrand, 'Brands must be flagged as foreign words');
    assert.ok(foreignBrand.languages.includes('en'));
    assert.deepStrictEqual(foreignBrand.suspiciousLatin.sort(), ['discord', 'eneas', 'factorio', 'foliax'].sort());
    console.log('  -> PASS: Brand names and mod names (eneas, factorio, discord) correctly flagged as errors\n');
}

// 9. Emojis and alert icons should NOT trigger foreign script warnings
{
    console.log('[Test 9] Emoji and alert icons (⚠️, ⬆️, etc.)');
    const alertString = '⚠️ Предупреждение: ⬆️ повышение мощности на 100%! ⭐';
    const foreignAlert = detectForeignCharacters(alertString);
    assert.strictEqual(foreignAlert, null, 'Emojis must not be flagged as foreign language');
    console.log('  -> PASS: Emojis and symbols cleanly ignored\n');
}

// 10. Integration audit on planet-rabbasca mod
{
    console.log('[Test 10] Integration audit on planet-rabbasca');
    const result = auditLocaleQuality({ modFilter: 'planet-rabbasca' });
    assert.strictEqual(result.summary.totalFilesScanned, 1);
    assert.ok(result.summary.tagMismatchCount > 0, 'Should find tag mismatches');
    assert.ok(result.summary.totalIssuesFound > 0, 'Should find quality issues');
    console.log(`  -> PASS: Found ${result.summary.tagMismatchCount} tag mismatches and ${result.summary.totalIssuesFound} total quality issues\n`);
}

// 11. Tags with slashes and parameters
{
    console.log('[Test 11] Tag cleaning with slashes and parameters ([img=...], quality=...)');
    const textWithSlashes = 'Нажмите [img=utility/check_mark] или [img=item/copper-cable] для выбора [item=stone,quality=epic].';
    const cleaned = cleanFactorioText(textWithSlashes);
    assert.strictEqual(cleaned.includes('check_mark'), false, 'Should not contain check_mark');
    assert.strictEqual(cleaned.includes('copper-cable'), false, 'Should not contain copper-cable');
    assert.strictEqual(cleaned.includes('epic'), false, 'Should not contain epic');
    const foreign = detectForeignCharacters(textWithSlashes);
    assert.strictEqual(foreign, null, 'Tags with slashes and parameters should not leave Latin residue');
    console.log('  -> PASS: Tags with slashes and parameters cleanly stripped\n');
}

// 12. Expanded chemical symbols and technical tokens whitelist
{
    console.log('[Test 12] Expanded chemical symbols and technical tokens');
    const chemAndTech = 'Смесь O2, H2, CH4, Cl2, NH3 с примесью Fe, Cu, Ti в контейнере tier 2 на 50 slots (max 100, min 10, step 5).';
    const foreign = detectForeignCharacters(chemAndTech);
    assert.strictEqual(foreign, null, 'Chemical formulas and technical tokens must be whitelisted');
    console.log('  -> PASS: Chemical symbols and technical tokens cleanly whitelisted\n');
}

// 13. Relaxed color tag matching
{
    console.log('[Test 13] Relaxed color tag matching (semantic paired color tags)');
    const orig = 'Внимание: [color=yellow]Предупреждение[/color] системы!';
    const trans = 'Внимание: [color=orange]Предупреждение[/color] системы!';
    const cmp = compareTokens(orig, trans);
    assert.strictEqual(cmp.missing.length, 0, 'Semantic paired color tag should not trigger missing error');
    assert.strictEqual(cmp.extra.length, 0, 'Semantic paired color tag should not trigger extra error');

    // But completely omitted color tag MUST still be detected
    const transNoColor = 'Внимание: Предупреждение системы!';
    const cmpOmitted = compareTokens(orig, transNoColor);
    assert.strictEqual(cmpOmitted.missing.length, 1, 'Omitted color tag must still be flagged');
    console.log('  -> PASS: Semantic color tags relaxed when preserved, flagged when omitted\n');
}

// 14. Factorio 2.1+ prototype classification and no blind fallback
{
    console.log('[Test 14] Factorio 2.1+ prototype classification and elimination of blind fallback');
    // Entity types must map to entity-name
    assert.strictEqual(getPrototypeSections('corpse').name, 'entity-name');
    assert.strictEqual(getPrototypeSections('unit').name, 'entity-name');
    assert.strictEqual(getPrototypeSections('unit-spawner').name, 'entity-name');
    assert.strictEqual(getPrototypeSections('wall').name, 'entity-name');
    assert.strictEqual(getPrototypeSections('spider-vehicle').name, 'entity-name');
    assert.strictEqual(getPrototypeSections('assembling-machine').name, 'entity-name');
    assert.strictEqual(getPrototypeSections('segmented-unit').name, 'entity-name');
    // Item types must map to item-name
    assert.strictEqual(getPrototypeSections('ammo').name, 'item-name');
    assert.strictEqual(getPrototypeSections('module').name, 'item-name');
    assert.strictEqual(getPrototypeSections('tool').name, 'item-name');
    assert.strictEqual(getPrototypeSections('selection-tool').name, 'item-name');
    // Equipment types must map to equipment-name
    assert.strictEqual(getPrototypeSections('battery-equipment').name, 'equipment-name');
    assert.strictEqual(getPrototypeSections('active-defense-equipment').name, 'equipment-name');
    // Space Age types
    assert.strictEqual(getPrototypeSections('planet').name, 'space-location-name');
    assert.strictEqual(getPrototypeSections('space-location').name, 'space-location-name');
    assert.strictEqual(getPrototypeSections('quality').name, 'quality-name');
    assert.strictEqual(getPrototypeSections('asteroid-chunk').name, 'asteroid-chunk-name');
    // Unknown prototype must safely default to entity-name, never invent non-standard [foo-name]
    assert.strictEqual(getPrototypeSections('unknown-future-entity').name, 'entity-name');
    console.log('  -> PASS: Full Factorio 2.1+ prototype classification working, blind fallback eliminated\n');
}

// 15. Section syntax validation & normalization
{
    console.log('[Test 15] Section syntax validation (misplaced sections, duplicate headers, empty sections)');
    const badCfg = `
orphan-key=bad
[corpse-name]
biter-corpse=Труп кусателя
[]
[entity-name]
gun-turret=Турель
line without equals
[entity-name]
laser-turret=Лазерная турель
`;
    const val = validateLocaleSyntax(badCfg);
    assert.strictEqual(val.valid, false);
    const errorTypes = val.errors.map(e => e.type);
    assert.ok(errorTypes.includes('orphan_key'), 'Should detect orphan key');
    assert.ok(errorTypes.includes('misplaced_section'), 'Should detect misplaced section [corpse-name]');
    assert.ok(errorTypes.includes('empty_section'), 'Should detect empty section []');
    assert.ok(errorTypes.includes('duplicate_section'), 'Should detect duplicate section [entity-name]');
    assert.ok(errorTypes.includes('line_without_equals'), 'Should detect line without equals');
    console.log('  -> PASS: All syntax errors correctly detected\n');
}

// 16. Automatic syntax fixing (fixLocaleSyntax)
{
    console.log('[Test 16] Automatic syntax fixing (fixLocaleSyntax)');
    const badCfg = `
orphan-key=val
[corpse-name]
biter-corpse=Труп кусателя
[]
[entity-name]
gun-turret=Турель
line without equals
[entity-name]
laser-turret=Лазерная турель
`;
    const fixed = fixLocaleSyntax(badCfg);
    const reval = validateLocaleSyntax(fixed);
    assert.strictEqual(reval.valid, true, 'Repaired CFG should have valid syntax');
    assert.strictEqual(fixed.includes('[corpse-name]'), false, '[corpse-name] must be migrated');
    assert.strictEqual(fixed.includes('[entity-name]'), true, '[entity-name] must exist');
    // Count [entity-name] occurrences: must be exactly 1
    const matches = fixed.match(/\[entity-name\]/g) || [];
    assert.strictEqual(matches.length, 1, '[entity-name] must be deduplicated to exactly 1 header');
    assert.strictEqual(fixed.includes('biter-corpse=Труп кусателя'), true, 'Translations must be preserved');
    assert.strictEqual(fixed.includes('gun-turret=Турель'), true);
    assert.strictEqual(fixed.includes('laser-turret=Лазерная турель'), true);
    console.log('  -> PASS: Syntax successfully repaired and sections normalized\n');
}

// 17. Strict section deduplication in mergeMissingKeysIntoCfg
{
    console.log('[Test 17] Strict section deduplication in mergeMissingKeysIntoCfg');
    const existingWithDuplicates = `# Header comment
[entity-name]
gun-turret=Турель

# Another comment
[entity-name]
laser-turret=Лазерная турель
`;
    const missing = {
        'entity-name': { 'artillery-turret': 'Артиллерийская турель' },
        'remnant-name': { 'wall-remnant': 'Остатки стены' }
    };
    const merged = mergeMissingKeysIntoCfg(existingWithDuplicates, missing);

    // Verify exactly one [entity-name] header
    const entityHeaderCount = (merged.match(/\[entity-name\]/g) || []).length;
    assert.strictEqual(entityHeaderCount, 1, 'Must strictly deduplicate: exactly 1 [entity-name] header');
    assert.strictEqual(merged.includes('[remnant-name]'), false, 'remnant-name must normalize to entity-name');

    // Verify all keys are present
    assert.strictEqual(merged.includes('gun-turret=Турель'), true);
    assert.strictEqual(merged.includes('laser-turret=Лазерная турель'), true);
    assert.strictEqual(merged.includes('artillery-turret=Артиллерийская турель'), true);
    assert.strictEqual(merged.includes('wall-remnant=Остатки стены'), true);
    console.log('  -> PASS: Sections strictly deduplicated without Factorio 2.1 duplicate key crashes\n');
}

// 18. Composite key matching & non-standard section preservation (solving Internal_names.txt flaw)
{
    console.log('[Test 18] Composite key matching & non-standard section preservation');
    const mockLocaleContent = `
[item-name]
stone=Камень мода
my-mod-item=Мой предмет

[my-gui]
stone=Камень в окне интерфейса
copper=Медь в окне интерфейса
`;

    // Case A: Live Steam multi-module composite keys
    const vanillaComposite = new Set(['item-name:stone', 'entity-name:stone', 'item-name:copper-plate']);
    const resLive = analyzeModCore({
        info: { name: 'test-mod' },
        luaFiles: [{ path: 'prototypes/item.lua', content: 'data:extend({{type="item", name="my-mod-item"}})' }],
        localeFiles: { en: [mockLocaleContent] },
        prototypesDb: new Set(),
        vanillaNames: new Set(['stone', 'copper']),
        vanillaCompositeKeys: vanillaComposite,
        removeUnusedKeys: false
    });

    assert.strictEqual(resLive.removedVanillaKeys.some(r => r.section === 'item-name' && r.key === 'stone'), true, 'stone under [item-name] must be removed as vanilla duplicate');
    assert.strictEqual(resLive.removedVanillaKeys.some(r => r.section === 'my-gui'), false, 'Keys under [my-gui] must never be removed as vanilla duplicates');
    assert.strictEqual(resLive.cleanedCfg.includes('[my-gui]'), true, 'cleanedCfg must preserve [my-gui]');
    assert.strictEqual(resLive.cleanedCfg.includes('stone=Камень в окне интерфейса'), true, 'cleanedCfg must preserve stone under [my-gui]');
    assert.strictEqual(resLive.cleanedCfg.includes('copper=Медь в окне интерфейса'), true, 'cleanedCfg must preserve copper under [my-gui]');

    // Case B: Offline fallback mode (only flat Internal_names.txt, no live Steam data)
    const resOffline = analyzeModCore({
        info: { name: 'test-mod' },
        luaFiles: [{ path: 'prototypes/item.lua', content: 'data:extend({{type="item", name="my-mod-item"}})' }],
        localeFiles: { en: [mockLocaleContent] },
        prototypesDb: new Set(),
        vanillaNames: new Set(['stone', 'copper']),
        vanillaCompositeKeys: null, // Offline fallback
        removeUnusedKeys: false
    });

    assert.strictEqual(resOffline.removedVanillaKeys.some(r => r.section === 'item-name' && r.key === 'stone'), true, 'Offline: stone under standard [item-name] removed');
    assert.strictEqual(resOffline.removedVanillaKeys.some(r => r.section === 'my-gui'), false, 'Offline: non-standard [my-gui] protected from flat name collisions');
    assert.strictEqual(resOffline.cleanedCfg.includes('stone=Камень в окне интерфейса'), true, 'Offline: stone under [my-gui] preserved');
    console.log('  -> PASS: Composite key matching and offline standard-section filtering protect custom GUI sections\n');
}

// 19. MOD OVERRIDE preservation
{
    console.log('[Test 19] # MOD OVERRIDE and ; MOD OVERRIDE preservation');
    const mockLocaleWithOverrides = `
[item-name]
stone=Пользовательский камень # MOD OVERRIDE
copper-plate=Пользовательская медь ; MOD OVERRIDE

# MOD OVERRIDE
iron-plate=Пользовательское железо

# Обычный комментарий
wood=Древесина
`;

    const vanillaComposite = new Set([
        'item-name:stone',
        'item-name:copper-plate',
        'item-name:iron-plate',
        'item-name:wood'
    ]);

    const resOverride = analyzeModCore({
        info: { name: 'test-mod' },
        luaFiles: [],
        localeFiles: { en: [mockLocaleWithOverrides] },
        prototypesDb: new Set(),
        vanillaNames: new Set(['stone', 'copper-plate', 'iron-plate', 'wood']),
        vanillaCompositeKeys: vanillaComposite,
        removeUnusedKeys: false
    });

    const removedKeys = resOverride.removedVanillaKeys.map(r => r.key);
    assert.strictEqual(removedKeys.includes('stone'), false, 'stone with # MOD OVERRIDE must not be removed');
    assert.strictEqual(removedKeys.includes('copper-plate'), false, 'copper-plate with ; MOD OVERRIDE must not be removed');
    assert.strictEqual(removedKeys.includes('iron-plate'), false, 'iron-plate with preceding # MOD OVERRIDE must not be removed');
    assert.strictEqual(removedKeys.includes('wood'), true, 'wood without override must be removed');

    // Verify preserved in cleanedCfg
    assert.strictEqual(resOverride.cleanedCfg.includes('stone=Пользовательский камень # MOD OVERRIDE'), true);
    assert.strictEqual(resOverride.cleanedCfg.includes('copper-plate=Пользовательская медь ; MOD OVERRIDE'), true);
    assert.strictEqual(resOverride.cleanedCfg.includes('iron-plate=Пользовательское железо'), true);
    assert.strictEqual(resOverride.cleanedCfg.includes('# MOD OVERRIDE'), true, 'Preceding # MOD OVERRIDE comment must be preserved');
    console.log('  -> PASS: # MOD OVERRIDE and ; MOD OVERRIDE keys and comments cleanly preserved\n');
}

// 20. Live Steam Factorio 2.1+ multi-module scanning
{
    console.log('[Test 20] Live Steam Factorio 2.1+ multi-module scanning');
    const dataDir = findSteamFactorioData();
    if (!dataDir) {
        console.log('  Factorio data directory not detected on host.');
        console.log('  -> PASS: Dynamic game detection cleanly returned null for uninstalled host; offline fallback active\n');
    } else {
        console.log(`  Factorio data directory detected: ${dataDir}`);
        const liveData = loadVanillaLocaleData(dataDir, 'en');
        assert.ok(liveData.compositeKeys instanceof Set, 'compositeKeys must be a Set');
        assert.ok(liveData.compositeKeys.size > 1000, `Must load substantial number of keys (loaded ${liveData.compositeKeys.size})`);
        assert.ok(liveData.modulesFound.includes('base'), 'Must find base module');
        assert.ok(liveData.modulesFound.includes('core'), 'Must find core module');

        // Factorio 2.1 Space Age / vanilla core keys check
        assert.strictEqual(liveData.compositeKeys.has('item-name:iron-plate'), true, 'item-name:iron-plate must be present');
        assert.strictEqual(liveData.compositeKeys.has('entity-name:stone'), true, 'entity-name:stone must be present');
        console.log(`  -> PASS: Successfully loaded ${liveData.compositeKeys.size} live composite keys across modules: ${liveData.modulesFound.join(', ')}\n`);
    }
}

// 21. Non-localizable prototypes (collision-layer, mod-data) must be ignored without warnings
{
    console.log('[Test 21] Non-localizable prototypes (collision-layer, mod-data)');
    const mockLua = `
data:extend({
    {
        type = "collision-layer",
        name = "test-layer"
    },
    {
        type = "mod-data",
        name = "test-config"
    }
})
`;
    const res = analyzeModCore({
        info: { name: 'test-non-localizable' },
        luaFiles: [{ path: 'prototypes.lua', content: mockLua }],
        localeFiles: { en: ['[entity-name]\nexisting=Сущность'] },
        prototypesDb: new Set(),
        vanillaNames: new Set(),
        vanillaCompositeKeys: new Set(),
        removeUnusedKeys: false
    });

    assert.strictEqual(res.generatedCfg.includes('test-layer'), false, 'collision-layer must not be added to generatedCfg');
    assert.strictEqual(res.generatedCfg.includes('test-config'), false, 'mod-data must not be added to generatedCfg');
    console.log('  -> PASS: Non-localizable prototypes cleanly ignored without false positives\n');
}

// 22. File path filtering in Lua strings and recipe name inheritance
{
    console.log('[Test 22] File path filtering in Lua strings and recipe name inheritance');
    const mockLua = `
filenames = {
    "__test-mod__/graphics/icons/icon.png",
    "__test-mod__/sounds/alert.ogg"
}

data:extend({
    {
        type = "item",
        name = "custom-pipe",
        place_result = "custom-pipe"
    },
    {
        type = "recipe",
        name = "custom-pipe",
        result = "custom-pipe"
    }
})
`;
    const res = analyzeModCore({
        info: { name: 'test-path-filter' },
        luaFiles: [{ path: 'data.lua', content: mockLua }],
        localeFiles: { en: ['[item-name]\ncustom-pipe=Custom Pipe'] },
        prototypesDb: new Set(),
        vanillaNames: new Set(),
        vanillaCompositeKeys: new Set(),
        removeUnusedKeys: false
    });

    assert.strictEqual(res.generatedCfg.includes('icon.png'), false, 'Image paths must never be treated as locale keys');
    assert.strictEqual(res.generatedCfg.includes('alert.ogg'), false, 'Audio paths must never be treated as locale keys');
    assert.strictEqual(res.generatedCfg.includes('recipe-name') && res.generatedCfg.includes('custom-pipe='), false, 'Recipe sharing name with existing item must not require recipe-name');
    console.log('  -> PASS: File paths properly filtered and recipe name inheritance verified\n');
}

// 23. Prototypes with setting_type ordering, single quotes, and localised_name/desc overrides
{
    console.log('[Test 23] Setting prototypes with setting_type and in-Lua localised_name/desc overrides');
    const mockLua = `
data:extend({
    {
        setting_type = "startup",
        name = "custom-toggle",
        localised_name = {"", {"Shortcuts-custom.title"}},
        type = "bool-setting",
        default_value = true
    },
    {
        type = 'shortcut',
        name = 'custom-shortcut',
        localised_name = {'', {'Shortcuts-custom.action'}},
        action = 'lua'
    }
})
`;
    const res = analyzeModCore({
        info: { name: 'test-settings' },
        luaFiles: [{ path: 'settings.lua', content: mockLua }],
        localeFiles: { en: ['[Shortcuts-custom]\ntitle=Custom Toggle\naction=Custom Action'] },
        prototypesDb: new Set(),
        vanillaNames: new Set(),
        vanillaCompositeKeys: new Set(),
        removeUnusedKeys: false
    });

    assert.strictEqual(res.generatedCfg.includes('[entity-name]'), false, 'Settings must never be mistakenly treated as entity-name');
    assert.strictEqual(res.generatedCfg.includes('[shortcut-name]'), false, 'Shortcuts with localised_name must not generate false missing shortcut-name');
    assert.strictEqual(res.generatedCfg.includes('custom-toggle='), false, 'custom-toggle must not be missing since it has localised_name');
    assert.strictEqual(res.generatedCfg.includes('custom-shortcut='), false, 'custom-shortcut must not be missing since it has localised_name');
    console.log('  -> PASS: Prototypes with setting_type and localised_name overrides handled accurately without false positives\n');
}

console.log('=== All 23 Tests Passed Successfully! ===');
