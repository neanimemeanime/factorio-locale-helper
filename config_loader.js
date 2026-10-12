import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Standard Steam Factorio data directories for auto-detection.
 */
export const DEFAULT_STEAM_DATA_PATHS = [
    'D:/SteamLibrary/steamapps/common/Factorio/data',
    'C:/Program Files (x86)/Steam/steamapps/common/Factorio/data',
    'C:/Program Files/Steam/steamapps/common/Factorio/data',
    'E:/SteamLibrary/steamapps/common/Factorio/data',
    path.join(os.homedir(), '.steam/steam/steamapps/common/Factorio/data'),
    path.join(os.homedir(), 'Library/Application Support/Steam/steamapps/common/Factorio/data')
];

/**
 * Detects the default Factorio mods directory based on operating system.
 * @returns {string}
 */
export function getDefaultModsDir() {
    if (process.env.FACTORIO_MODS && fs.existsSync(process.env.FACTORIO_MODS)) {
        return path.resolve(process.env.FACTORIO_MODS);
    }
    if (process.platform === 'win32') {
        const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
        return path.join(appData, 'Factorio', 'mods');
    }
    if (process.platform === 'darwin') {
        return path.join(os.homedir(), 'Library', 'Application Support', 'factorio', 'mods');
    }
    return path.join(os.homedir(), '.factorio', 'mods');
}

/**
 * Auto-detects installed Steam Factorio data directory.
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

/**
 * Checks if a specific mod directory exists in mods folder (smart local detection).
 * @param {string} modsDir
 * @param {string} modName
 * @returns {boolean}
 */
export function hasModDirectory(modsDir, modName) {
    if (!modsDir || !modName) return false;
    const p = path.join(modsDir, modName);
    return fs.existsSync(p);
}

/**
 * Reads local config.json if present, otherwise returns defaults.
 * @returns {{
 *   modsDir: string,
 *   targetMod: string,
 *   targetLang: string,
 *   targetLocaleDir: string,
 *   steamDataDir: string|null
 * }}
 */
export function loadConfig() {
    const configPath = path.join(__dirname, 'config.json');
    let fileConfig = {};

    if (fs.existsSync(configPath)) {
        try {
            const raw = fs.readFileSync(configPath, 'utf-8');
            fileConfig = JSON.parse(raw);
        } catch (e) {
            console.error(`Warning: Failed to parse config.json: ${e.message}`);
        }
    }

    const modsDir = process.env.FACTORIO_MODS || fileConfig.modsDir || getDefaultModsDir();

    // Default target mod:
    // 1. Explicit env var
    // 2. Explicit config.json entry
    // 3. Auto-detect if user's local 'my-texture-pack' exists on disk
    // 4. Fallback to generic 'locale-mod'
    let targetMod = process.env.FACTORIO_TARGET_MOD || fileConfig.targetMod;
    if (!targetMod) {
        if (hasModDirectory(modsDir, 'my-texture-pack')) {
            targetMod = 'my-texture-pack';
        } else {
            targetMod = 'locale-mod';
        }
    }

    // Default target language:
    // 1. Explicit env var
    // 2. Explicit config.json entry
    // 3. Fallback: if user's targetMod contains locale/ru, default to 'ru', otherwise 'en'
    let targetLang = process.env.FACTORIO_TARGET_LANG || fileConfig.targetLang;
    if (!targetLang) {
        if (hasModDirectory(modsDir, path.join(targetMod, 'locale', 'ru'))) {
            targetLang = 'ru';
        } else {
            targetLang = 'en';
        }
    }

    const steamDataDir = process.env.FACTORIO_DATA || fileConfig.steamDataDir || findSteamFactorioData();
    const targetLocaleDir = path.join(modsDir, targetMod, 'locale', targetLang);

    return {
        modsDir,
        targetMod,
        targetLang,
        targetLocaleDir,
        steamDataDir
    };
}
