import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Checks if a given path is a valid Factorio data directory (contains base or core module).
 * @param {string} dirPath
 * @returns {boolean}
 */
export function isValidFactorioDataDir(dirPath) {
    if (!dirPath) return false;
    try {
        if (!fs.existsSync(dirPath)) return false;
        return fs.existsSync(path.join(dirPath, 'base')) || fs.existsSync(path.join(dirPath, 'core'));
    } catch (_) {
        return false;
    }
}

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
 * Auto-detects installed Factorio data directory dynamically across all drives and platforms.
 * Discovers Steam libraries, custom drives, GOG, and standalone installations without hardcoded paths.
 * @returns {string|null}
 */
export function findSteamFactorioData() {
    if (process.env.FACTORIO_DATA) {
        const envP = path.resolve(process.env.FACTORIO_DATA);
        if (isValidFactorioDataDir(envP)) return envP;
    }

    const candidates = [];

    if (process.platform === 'win32') {
        const potentialSteamRoots = [
            path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Steam'),
            path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Steam')
        ];

        // Scan available Windows drive letters (C: through Z:)
        for (let code = 67; code <= 90; code++) {
            const driveLetter = String.fromCharCode(code) + ':';
            const driveRoot = driveLetter + '\\';
            try {
                if (!fs.existsSync(driveRoot)) continue;
            } catch (_) {
                continue;
            }

            potentialSteamRoots.push(
                path.join(driveLetter, 'SteamLibrary'),
                path.join(driveLetter, 'Steam')
            );

            candidates.push(
                path.join(driveLetter, 'SteamLibrary', 'steamapps', 'common', 'Factorio', 'data'),
                path.join(driveLetter, 'Steam', 'steamapps', 'common', 'Factorio', 'data'),
                path.join(driveLetter, 'Program Files (x86)', 'Steam', 'steamapps', 'common', 'Factorio', 'data'),
                path.join(driveLetter, 'Program Files', 'Steam', 'steamapps', 'common', 'Factorio', 'data'),
                path.join(driveLetter, 'Program Files (x86)', 'Factorio', 'data'),
                path.join(driveLetter, 'Program Files', 'Factorio', 'data'),
                path.join(driveLetter, 'Games', 'Factorio', 'data'),
                path.join(driveLetter, 'Factorio', 'data')
            );
        }

        // Parse libraryfolders.vdf from detected Steam installations to discover custom libraries on any drive
        for (const steamRoot of potentialSteamRoots) {
            const vdfPath = path.join(steamRoot, 'steamapps', 'libraryfolders.vdf');
            if (fs.existsSync(vdfPath)) {
                try {
                    const content = fs.readFileSync(vdfPath, 'utf-8');
                    const matches = content.match(/"path"\s+"([^"]+)"/g);
                    if (matches) {
                        for (const m of matches) {
                            const sub = m.match(/"path"\s+"([^"]+)"/);
                            if (sub && sub[1]) {
                                const libPath = sub[1].replace(/\\\\/g, '\\');
                                candidates.push(path.join(libPath, 'steamapps', 'common', 'Factorio', 'data'));
                            }
                        }
                    }
                } catch (_) {}
            }
        }
    } else if (process.platform === 'darwin') {
        candidates.push(
            path.join(os.homedir(), 'Library/Application Support/Steam/steamapps/common/Factorio/data'),
            '/Applications/Factorio.app/Contents/data'
        );
    } else {
        // Linux
        candidates.push(
            path.join(os.homedir(), '.steam/steam/steamapps/common/Factorio/data'),
            path.join(os.homedir(), '.local/share/Steam/steamapps/common/Factorio/data'),
            path.join(os.homedir(), '.factorio/data'),
            '/usr/share/factorio/data'
        );
    }

    for (const cand of candidates) {
        if (isValidFactorioDataDir(cand)) {
            return path.resolve(cand);
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

    const steamDataDir = process.env.FACTORIO_DATA || fileConfig.factorioData || fileConfig.steamDataDir || findSteamFactorioData();
    const targetLocaleDir = path.join(modsDir, targetMod, 'locale', targetLang);

    return {
        modsDir,
        targetMod,
        targetLang,
        targetLocaleDir,
        steamDataDir
    };
}
