import fs from 'fs';
import path from 'path';

/**
 * Standard canonical Factorio 2.1+ localization sections.
 */
export const CANONICAL_SECTIONS = new Set([
    'mod-name', 'mod-description',
    'mod-setting-name', 'mod-setting-description',
    'string-mod-setting', 'string-mod-setting-description',
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
    'achievement-name', 'achievement-description', 'achievement-progress',
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
    'controls', 'controls-description', 'control-keys',
    'shortcut-name',
    'map-gen-preset-name', 'map-gen-preset-description',
    'factoriopedia', 'factoriopedia-description',
    'cant-build-reason', 'character-corpse', 'entity-status', 'entity-type'
]);

/**
 * Common entity prototype types that modders or naive generators mistakenly
 * turn into "[type-name]" instead of standard "[entity-name]".
 */
export const KNOWN_ENTITY_TYPES = new Set([
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
    'underground-belt', 'unit', 'unit-spawner', 'valve', 'wall', 'remnant'
]);

/**
 * Common item prototype types mistakenly used as "[type-name]".
 */
export const KNOWN_ITEM_TYPES = new Set([
    'item', 'ammo', 'armor', 'blueprint', 'blueprint-book', 'capsule',
    'copy-paste-tool', 'deconstruction-item', 'gun', 'item-with-entity-data',
    'module', 'rail-planner', 'repair-tool', 'selection-tool',
    'space-platform-starter-pack', 'spidertron-remote', 'tool', 'upgrade-item'
]);

/**
 * Common equipment prototype types mistakenly used as "[type-name]".
 */
export const KNOWN_EQUIPMENT_TYPES = new Set([
    'equipment', 'active-defense-equipment', 'battery-equipment', 'belt-immunity-equipment',
    'energy-shield-equipment', 'generator-equipment', 'inventory-bonus-equipment',
    'movement-bonus-equipment', 'night-vision-equipment', 'roboport-equipment',
    'solar-panel-equipment'
]);

/**
 * Explicit map of non-canonical / misplaced sections to their canonical targets.
 */
export const MISPLACED_SECTION_MAP = {
    // Entities
    'corpse-name': 'entity-name',
    'corpse-description': 'entity-description',
    'remnant-name': 'entity-name',
    'remnant-description': 'entity-description',
    'rail-remnants-name': 'entity-name',
    'rail-remnants-description': 'entity-description',
    'unit-name': 'entity-name',
    'unit-description': 'entity-description',
    'unit-spawner-name': 'entity-name',
    'unit-spawner-description': 'entity-description',
    'wall-name': 'entity-name',
    'wall-description': 'entity-description',
    'turret-name': 'entity-name',
    'turret-description': 'entity-description',
    'container-name': 'entity-name',
    'container-description': 'entity-description',
    'assembling-machine-name': 'entity-name',
    'assembling-machine-description': 'entity-description',
    'furnace-name': 'entity-name',
    'furnace-description': 'entity-description',
    'boiler-name': 'entity-name',
    'boiler-description': 'entity-description',
    'generator-name': 'entity-name',
    'generator-description': 'entity-description',
    'accumulator-name': 'entity-name',
    'accumulator-description': 'entity-description',
    'roboport-name': 'entity-name',
    'roboport-description': 'entity-description',
    'radar-name': 'entity-name',
    'radar-description': 'entity-description',
    'car-name': 'entity-name',
    'car-description': 'entity-description',
    'spider-vehicle-name': 'entity-name',
    'spider-vehicle-description': 'entity-description',
    'simple-entity-name': 'entity-name',
    'simple-entity-description': 'entity-description',
    'tree-name': 'entity-name',
    'tree-description': 'entity-description',
    'fish-name': 'entity-name',
    'fish-description': 'entity-description',
    'plant-name': 'entity-name',
    'plant-description': 'entity-description',
    'cliff-name': 'entity-name',
    'cliff-description': 'entity-description',
    'lamp-name': 'entity-name',
    'lamp-description': 'entity-description',
    'gate-name': 'entity-name',
    'gate-description': 'entity-description',
    'pipe-name': 'entity-name',
    'pipe-description': 'entity-description',
    'pipe-to-ground-name': 'entity-name',
    'pipe-to-ground-description': 'entity-description',
    'pump-name': 'entity-name',
    'pump-description': 'entity-description',
    'storage-tank-name': 'entity-name',
    'storage-tank-description': 'entity-description',
    'reactor-name': 'entity-name',
    'reactor-description': 'entity-description',
    'mining-drill-name': 'entity-name',
    'mining-drill-description': 'entity-description',
    'locomotive-name': 'entity-name',
    'locomotive-description': 'entity-description',
    'cargo-wagon-name': 'entity-name',
    'cargo-wagon-description': 'entity-description',
    'fluid-wagon-name': 'entity-name',
    'fluid-wagon-description': 'entity-description',
    'artillery-wagon-name': 'entity-name',
    'artillery-wagon-description': 'entity-description',
    'beacon-name': 'entity-name',
    'beacon-description': 'entity-description',
    'inserter-name': 'entity-name',
    'inserter-description': 'entity-description',
    'splitter-name': 'entity-name',
    'splitter-description': 'entity-description',
    'transport-belt-name': 'entity-name',
    'transport-belt-description': 'entity-description',
    'underground-belt-name': 'entity-name',
    'underground-belt-description': 'entity-description',
    'electric-pole-name': 'entity-name',
    'electric-pole-description': 'entity-description',
    'power-switch-name': 'entity-name',
    'power-switch-description': 'entity-description',
    'segmented-unit-name': 'entity-name',
    'segmented-unit-description': 'entity-description',
    'segment-name': 'entity-name',
    'segment-description': 'entity-description',
    'lightning-name': 'entity-name',
    'lightning-description': 'entity-description',
    'explosion-name': 'entity-name',
    'explosion-description': 'entity-description',

    // Items
    'tool-name': 'item-name',
    'tool-description': 'item-description',
    'ammo-name': 'item-name',
    'ammo-description': 'item-description',
    'armor-name': 'item-name',
    'armor-description': 'item-description',
    'capsule-name': 'item-name',
    'capsule-description': 'item-description',
    'gun-name': 'item-name',
    'gun-description': 'item-description',
    'module-name': 'item-name',
    'module-description': 'item-description',
    'selection-tool-name': 'item-name',
    'selection-tool-description': 'item-description',
    'repair-tool-name': 'item-name',
    'repair-tool-description': 'item-description',
    'spidertron-remote-name': 'item-name',
    'spidertron-remote-description': 'item-description',

    // Equipment
    'active-defense-equipment-name': 'equipment-name',
    'active-defense-equipment-description': 'equipment-description',
    'battery-equipment-name': 'equipment-name',
    'battery-equipment-description': 'equipment-description',
    'energy-shield-equipment-name': 'equipment-name',
    'energy-shield-equipment-description': 'equipment-description',
    'generator-equipment-name': 'equipment-name',
    'generator-equipment-description': 'equipment-description',
    'solar-panel-equipment-name': 'equipment-name',
    'solar-panel-equipment-description': 'equipment-description',
    'night-vision-equipment-name': 'equipment-name',
    'night-vision-equipment-description': 'equipment-description',
    'movement-bonus-equipment-name': 'equipment-name',
    'movement-bonus-equipment-description': 'equipment-description',
    'roboport-equipment-name': 'equipment-name',
    'roboport-equipment-description': 'equipment-description',
    'belt-immunity-equipment-name': 'equipment-name',
    'belt-immunity-equipment-description': 'equipment-description',

    // Special types
    'planet-name': 'space-location-name',
    'planet-description': 'space-location-description',
    'space-connection-name': 'space-location-name',
    'space-connection-description': 'space-location-description',
    'fuel-category': 'fuel-category-name',
    'ammo-category': 'ammo-category-name',
    'recipe-category': 'recipe-category-name',
    'resource-category': 'resource-category-name',
    'autoplace-control-name': 'autoplace-control-names',
    'autoplace-control': 'autoplace-control-names'
};

/**
 * Normalizes a section name to its canonical Factorio section.
 * If the section is misplaced (e.g. 'corpse-name', 'remnant-name'),
 * returns the canonical section ('entity-name').
 *
 * @param {string} section
 * @returns {string}
 */
export function normalizeSectionName(section) {
    if (!section) return section;
    const trimmed = section.trim();
    if (MISPLACED_SECTION_MAP[trimmed]) {
        return MISPLACED_SECTION_MAP[trimmed];
    }
    if (trimmed.endsWith('-equipment-name')) return 'equipment-name';
    if (trimmed.endsWith('-equipment-description')) return 'equipment-description';
    if (trimmed.endsWith('-achievement-name')) return 'achievement-name';
    if (trimmed.endsWith('-achievement-description')) return 'achievement-description';

    if (trimmed.endsWith('-name')) {
        const prefix = trimmed.slice(0, -5);
        if (KNOWN_ENTITY_TYPES.has(prefix)) return 'entity-name';
        if (KNOWN_ITEM_TYPES.has(prefix)) return 'item-name';
        if (KNOWN_EQUIPMENT_TYPES.has(prefix)) return 'equipment-name';
    }
    if (trimmed.endsWith('-description')) {
        const prefix = trimmed.slice(0, -12);
        if (KNOWN_ENTITY_TYPES.has(prefix)) return 'entity-description';
        if (KNOWN_ITEM_TYPES.has(prefix)) return 'item-description';
        if (KNOWN_EQUIPMENT_TYPES.has(prefix)) return 'equipment-description';
    }

    return trimmed;
}

/**
 * Validates the syntax of Factorio .cfg content.
 * Checks for:
 * 1. Duplicate section headers within the file (Factorio 2.1 fatal crash).
 * 2. Non-canonical / misplaced sections (e.g. corpse-name, unit-name).
 * 3. Orphan keys before the first section.
 * 4. Empty section headers [].
 * 5. Malformed lines without '=' inside sections.
 *
 * @param {string} content
 * @param {object} [options]
 * @param {string} [options.filePath] - Optional filename for error reporting.
 * @returns {{ valid: boolean, errors: Array<{ type: string, line: number, section?: string, message: string, suggestion?: string, raw?: string }> }}
 */
export function validateLocaleSyntax(content, options = {}) {
    const errors = [];
    if (!content || !content.trim()) {
        return { valid: true, errors: [] };
    }

    const lines = content.split(/\r?\n/);
    const seenSections = new Map(); // sectionName -> firstLineIndex
    let currentSection = null;

    for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i];
        const line = rawLine.trim();
        const lineNum = i + 1;

        if (!line || line.startsWith('#') || line.startsWith(';')) {
            continue;
        }

        // Section header
        if (line.startsWith('[') && line.endsWith(']')) {
            const secName = line.slice(1, -1).trim();

            if (!secName) {
                errors.push({
                    type: 'empty_section',
                    line: lineNum,
                    message: `Empty section header "[]" on line ${lineNum}`,
                    raw: rawLine
                });
                continue;
            }

            // Check duplicate section headers
            if (seenSections.has(secName)) {
                errors.push({
                    type: 'duplicate_section',
                    line: lineNum,
                    section: secName,
                    firstLine: seenSections.get(secName),
                    message: `Duplicate section header [${secName}] on line ${lineNum} (first seen on line ${seenSections.get(secName)}). Causes Factorio 2.1 fatal crash: Duplicate key in property tree at ROOT`,
                    raw: rawLine
                });
            } else {
                seenSections.set(secName, lineNum);
            }

            // Check non-canonical / misplaced sections
            const normalized = normalizeSectionName(secName);
            if (normalized !== secName) {
                errors.push({
                    type: 'misplaced_section',
                    line: lineNum,
                    section: secName,
                    suggestion: normalized,
                    message: `Non-canonical / misplaced section [${secName}] on line ${lineNum}. Should be [${normalized}]`,
                    raw: rawLine
                });
            }

            currentSection = secName;
            continue;
        }

        // Key-value pair or malformed line
        if (line.includes('=')) {
            const eqIdx = line.indexOf('=');
            const key = line.slice(0, eqIdx).trim();

            if (!currentSection) {
                errors.push({
                    type: 'orphan_key',
                    line: lineNum,
                    key,
                    message: `Orphan key "${key}" defined on line ${lineNum} before any [section] header`,
                    raw: rawLine
                });
            }
        } else {
            // Line without '=' that isn't a comment or empty
            errors.push({
                type: 'line_without_equals',
                line: lineNum,
                section: currentSection || '<none>',
                message: `Line ${lineNum} has no '=' assignment operator: "${line}"`,
                raw: rawLine
            });
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Automatically repairs Factorio .cfg content:
 * - Normalizes misplaced sections to canonical ones (e.g. [corpse-name] -> [entity-name]).
 * - Deduplicates section headers: all keys and comments under repeated headers are consolidated.
 * - Drops empty section headers [].
 * - Fixes orphan keys by putting them under a fallback section or commenting them.
 * - Comments out lines without '='.
 * - Preserves existing comments and translations.
 *
 * @param {string} content
 * @returns {string} Repaired .cfg string.
 */
export function fixLocaleSyntax(content) {
    if (!content || !content.trim()) return content;

    const hasCRLF = content.includes('\r\n');
    const nl = hasCRLF ? '\r\n' : '\n';
    const lines = content.split(/\r?\n/);

    // Structure:
    // headerComments: string[]
    // sections: Map<string, { commentsAndKeys: Array<{ type: 'comment'|'pair'|'raw', text: string, key?: string, val?: string }> }>
    const headerLines = [];
    const sectionOrder = [];
    const sectionData = new Map(); // normalizedSectionName -> entries

    let curSection = null;

    for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i];
        const trimmed = rawLine.trim();

        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            const rawName = trimmed.slice(1, -1).trim();
            if (!rawName) {
                // Drop empty section header []
                continue;
            }
            const normName = normalizeSectionName(rawName);
            curSection = normName;
            if (!sectionData.has(normName)) {
                sectionOrder.push(normName);
                sectionData.set(normName, []);
            }
            continue;
        }

        if (!curSection) {
            // Before any section
            if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) {
                headerLines.push(rawLine);
            } else if (trimmed.includes('=')) {
                // Orphan key before section: place in 'mod-name' or default section
                const fallbackSection = 'other';
                curSection = fallbackSection;
                if (!sectionData.has(fallbackSection)) {
                    sectionOrder.push(fallbackSection);
                    sectionData.set(fallbackSection, []);
                }
                const eqIdx = trimmed.indexOf('=');
                const key = trimmed.slice(0, eqIdx).trim();
                const val = trimmed.slice(eqIdx + 1).trim();
                sectionData.get(fallbackSection).push({
                    type: 'pair',
                    key,
                    val,
                    text: `${key}=${val}`
                });
            } else {
                // Malformed line before section
                headerLines.push(`# MALFORMED: ${rawLine}`);
            }
            continue;
        }

        // Inside a section
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) {
            sectionData.get(curSection).push({ type: 'comment', text: rawLine });
        } else if (trimmed.includes('=')) {
            const eqIdx = trimmed.indexOf('=');
            const key = trimmed.slice(0, eqIdx).trim();
            const val = trimmed.slice(eqIdx + 1).trim();
            sectionData.get(curSection).push({
                type: 'pair',
                key,
                val,
                text: `${key}=${val}`
            });
        } else {
            // Line without '=': comment out
            sectionData.get(curSection).push({
                type: 'comment',
                text: `# MALFORMED LINE: ${rawLine}`
            });
        }
    }

    const outLines = [];
    if (headerLines.length > 0) {
        outLines.push(...headerLines);
        if (headerLines[headerLines.length - 1].trim().length > 0) {
            outLines.push('');
        }
    }

    for (const secName of sectionOrder) {
        const entries = sectionData.get(secName);
        if (!entries || entries.length === 0) continue;

        // Ensure single blank line before section header if needed
        if (outLines.length > 0 && outLines[outLines.length - 1].trim().length > 0) {
            outLines.push('');
        }
        outLines.push(`[${secName}]`);

        // Deduplicate keys within the section while keeping latest/first translation
        const seenKeys = new Set();
        for (const entry of entries) {
            if (entry.type === 'pair') {
                if (seenKeys.has(entry.key)) {
                    // Skip duplicate key in same section
                    continue;
                }
                seenKeys.add(entry.key);
                outLines.push(entry.text);
            } else {
                outLines.push(entry.text);
            }
        }
    }

    let result = outLines.join(nl);
    if (!result.endsWith(nl)) {
        result += nl;
    }
    return result;
}
