import fs from 'fs';
import path from 'path';
import os from 'os';
import { parseCfgText } from './missing_keys_scanner.js';

export const DEFAULT_STEAM_DATA_PATHS = [
    'D:/SteamLibrary/steamapps/common/Factorio/data',
    'C:/Program Files (x86)/Steam/steamapps/common/Factorio/data',
    'C:/Program Files/Steam/steamapps/common/Factorio/data',
    'E:/SteamLibrary/steamapps/common/Factorio/data'
];

export const OFFICIAL_MODULES = [
    'core',
    'base',
    'space-age',
    'quality',
    'elevated-rails',
    'recycler'
];

/**
 * Auto-detects installed Steam Factorio 2.1+ data directory.
 * @returns {string|null}
 */
export function findSteamFactorioData() {
    if (process.env.FACTORIO_DATA && fs.existsSync(process.env.FACTORIO_DATA)) {
        return path.resolve(process.env.FACTORIO_DATA);
    }
    for (const p of DEFAULT_STEAM_DATA_PATHS) {
        if (fs.existsSync(p)) {
            return path.resolve(p);
        }
    }
    return null;
}

// In-memory cache for live vanilla keys: cacheKey -> { compositeKeys: Set, flatNames: Set }
const cache = new Map();

/**
 * Scans official Factorio 2.1+ modules (core, base, space-age, quality, elevated-rails, recycler)
 * and extracts all vanilla (section, key) pairs.
 *
 * @param {string} [customDataDir] - Path to Factorio data directory (auto-detected if omitted).
 * @param {string} [lang='en'] - Language code to scan.
 * @returns {{ compositeKeys: Set<string>|null, flatNames: Set<string>, modulesFound: string[], dataDir: string|null }}
 */
export function loadVanillaLocaleData(customDataDir = null, lang = 'en') {
    const dataDir = customDataDir || findSteamFactorioData();
    if (!dataDir || !fs.existsSync(dataDir)) {
        return {
            compositeKeys: null,
            flatNames: new Set(),
            modulesFound: [],
            dataDir: null
        };
    }

    const cacheKey = `${path.resolve(dataDir)}:${lang}`;
    if (cache.has(cacheKey)) {
        return cache.get(cacheKey);
    }

    const compositeKeys = new Set();
    const flatNames = new Set();
    const modulesFound = [];

    const entries = fs.readdirSync(dataDir, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.')) continue;

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
                    for (const key of Object.keys(keys)) {
                        compositeKeys.add(`${sec}:${key}`);
                        flatNames.add(key);
                    }
                }
            }
        }
    }

    const result = {
        compositeKeys,
        flatNames,
        modulesFound,
        dataDir: path.resolve(dataDir)
    };

    cache.set(cacheKey, result);
    return result;
}
