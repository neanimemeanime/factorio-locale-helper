import assert from 'assert';
import {
    extractFactorioTokens,
    compareTokens,
    detectForeignCharacters,
    cleanFactorioText,
    auditLocaleQuality
} from './locale_quality_auditor.js';

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

console.log('=== All 10 Tests Passed Successfully! ===');
