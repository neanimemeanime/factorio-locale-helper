import fs from 'fs';
import path from 'path';
import os from 'os';
import { parseCfgText } from './missing_keys_scanner.js';

import { findSteamFactorioData, isValidFactorioDataDir } from './config_loader.js';

export { findSteamFactorioData };

export const OFFICIAL_MODULES = [
    'core',
    'base',
    'space-age',
    'quality',
    'elevated-rails',
    'recycler'
];

// In-memory cache for live vanilla keys: cacheKey -> { compositeKeys: Set, flatNames: Set, values: Map }
const cache = new Map();

/**
 * Extracts required official modules from info.json dependencies array.
 * Always includes 'core' and 'base'.
 * Only includes expansion modules (space-age, quality, elevated-rails, recycler)
 * if they are explicitly listed as hard/required dependencies (not '?', '!', or '~').
 *
 * @param {string[]} [dependencies=[]]
 * @returns {Set<string>}
 */
export function parseRequiredModulesFromDependencies(dependencies = []) {
    const required = new Set(['core', 'base']);
    if (!Array.isArray(dependencies)) return required;

    for (const dep of dependencies) {
        if (typeof dep !== 'string') continue;
        const trimmed = dep.trim();
        // Ignore optional (?), hidden (~), or incompatible (!) dependencies
        if (trimmed.startsWith('?') || trimmed.startsWith('!') || trimmed.startsWith('~') || trimmed.startsWith('(?)')) {
            continue;
        }
        // Extract mod name before any version constraint (e.g. "space-age >= 2.0" -> "space-age")
        const modName = trimmed.split(/[\s><=]/)[0].trim().toLowerCase();
        if (OFFICIAL_MODULES.includes(modName)) {
            required.add(modName);
        }
    }
    return required;
}

/**
 * Scans official Factorio 2.1+ modules (core, base, space-age, quality, elevated-rails, recycler)
 * and extracts all vanilla (section, key) pairs and their localized string values.
 *
 * @param {string} [customDataDir] - Path to Factorio data directory (auto-detected if omitted).
 * @param {string} [lang='en'] - Language code to scan.
 * @param {object} [options]
 * @param {Set<string>} [options.allowedModules] - Specific set of official modules to include.
 * @param {string[]} [options.dependencies] - info.json dependencies array to scope baseline.
 * @returns {{ compositeKeys: Set<string>|null, flatNames: Set<string>, values: Map<string, string>, modulesFound: string[], dataDir: string|null }}
 */
export function loadVanillaLocaleData(customDataDir = null, lang = 'en', options = {}) {
    const dataDir = customDataDir || findSteamFactorioData();
    if (!dataDir || !fs.existsSync(dataDir)) {
        return {
            compositeKeys: null,
            flatNames: new Set(),
            values: new Map(),
            modulesFound: [],
            dataDir: null
        };
    }

    let allowed = null;
    if (options.allowedModules) {
        allowed = options.allowedModules;
    } else if (options.dependencies) {
        allowed = parseRequiredModulesFromDependencies(options.dependencies);
    }

    const allowedKey = allowed ? Array.from(allowed).sort().join(',') : 'all';
    const cacheKey = `${path.resolve(dataDir)}:${lang}:${allowedKey}`;
    if (cache.has(cacheKey)) {
        return cache.get(cacheKey);
    }

    const compositeKeys = new Set();
    const flatNames = new Set();
    const values = new Map();
    const modulesFound = [];

    const entries = fs.readdirSync(dataDir, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.')) continue;

        if (allowed && !allowed.has(entry.name.toLowerCase())) {
            continue;
        }

        const moduleDir = path.join(dataDir, entry.name);
        // Check locale/<lang> first, fallback to locale/en if lang is different
        let locDir = path.join(moduleDir, 'locale', lang);
        if (!fs.existsSync(locDir) && lang !== 'en') {
            locDir = path.join(moduleDir, 'locale', 'en');
        }

        if (fs.existsSync(locDir)) {
            modulesFound.push(entry.name);
            const cfgFiles = fs.readdirSync(locDir).filter(f => f.endsWith('.cfg'));
            for (const cfgFile of cfgFiles) {
                const text = fs.readFileSync(path.join(locDir, cfgFile), 'utf-8');
                const parsed = parseCfgText(text, { normalize: false });
                for (const [sec, keys] of Object.entries(parsed)) {
                    for (const [key, val] of Object.entries(keys)) {
                        const compKey = `${sec}:${key}`;
                        compositeKeys.add(compKey);
                        flatNames.add(key);
                        values.set(compKey, val);
                    }
                }
            }
        }
    }

    const result = {
        compositeKeys,
        flatNames,
        values,
        modulesFound,
        dataDir: path.resolve(dataDir)
    };

    cache.set(cacheKey, result);
    return result;
}
