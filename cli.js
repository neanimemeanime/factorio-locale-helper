import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { analyzeModCore } from './analyzer.js';
import { scanMissingKeys } from './missing_keys_scanner.js';
import { auditLocaleQuality } from './locale_quality_auditor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load internal names and prototype definitions
const internalNamesPath = path.join(__dirname, 'Internal_names.txt');
const prototypesPath = path.join(__dirname, 'Prototypes.txt');

const vanillaNamesText = fs.existsSync(internalNamesPath) ? fs.readFileSync(internalNamesPath, 'utf-8') : '';
const prototypesText = fs.existsSync(prototypesPath) ? fs.readFileSync(prototypesPath, 'utf-8') : '';

const vanillaNames = new Set(vanillaNamesText.split(/\r?\n/).filter(Boolean));
const prototypesDb = new Set(prototypesText.split(/\r?\n/).filter(Boolean));

// Recursively reads files from a directory and formats them for analyzeModCore.
// Supports automatic zip extraction.
function readModDir(modPath) {
    let tempDirToDelete = null;
    let targetModPath = modPath;

    if (modPath.endsWith('.zip')) {
        const tempDir = path.join(os.tmpdir(), '.temp_unzip_' + Date.now() + '_' + Math.floor(Math.random() * 1000));
        fs.mkdirSync(tempDir, { recursive: true });
        tempDirToDelete = tempDir;

        try {
            const escapePath = (p) => p.replace(/'/g, "''");
            const cmd = `powershell -NoProfile -Command "Expand-Archive -Force -Path '${escapePath(modPath)}' -DestinationPath '${escapePath(tempDir)}'"`;
            execSync(cmd, { stdio: 'ignore' });
        } catch (err) {
            try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
            throw new Error(`Failed to unzip file: ${err.message}`);
        }

        const entries = fs.readdirSync(tempDir, { withFileTypes: true });
        const dirEntry = entries.find(e => e.isDirectory());
        if (dirEntry) {
            targetModPath = path.join(tempDir, dirEntry.name);
        } else {
            targetModPath = tempDir;
        }
    }

    if (!fs.existsSync(targetModPath)) {
        if (tempDirToDelete) {
            try { fs.rmSync(tempDirToDelete, { recursive: true, force: true }); } catch (_) {}
        }
        throw new Error(`Path does not exist: ${targetModPath}`);
    }
    const stat = fs.statSync(targetModPath);
    if (!stat.isDirectory()) {
        if (tempDirToDelete) {
            try { fs.rmSync(tempDirToDelete, { recursive: true, force: true }); } catch (_) {}
        }
        throw new Error(`Path is not a directory: ${targetModPath}`);
    }

    const allFiles = [];
    function walk(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'dist') {
                    walk(fullPath);
                }
            } else {
                allFiles.push(fullPath);
            }
        }
    }
    walk(targetModPath);

    let info = {};
    const luaFiles = [];
    const localeFiles = {};

    for (const filePath of allFiles) {
        const relPath = path.relative(targetModPath, filePath).replace(/\\/g, '/');
        
        if (relPath === 'info.json') {
            try {
                info = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            } catch (err) {
                console.error(`Error parsing info.json at ${filePath}:`, err);
            }
        } else if (filePath.endsWith('.lua')) {
            const content = fs.readFileSync(filePath, 'utf-8');
            luaFiles.push({ path: relPath, content });
        } else if (relPath.startsWith('locale/') && relPath.endsWith('.cfg')) {
            const langMatch = relPath.match(/^locale\/([a-zA-Z-]+)\//);
            if (langMatch && langMatch[1]) {
                const lang = langMatch[1];
                const content = fs.readFileSync(filePath, 'utf-8');
                if (!localeFiles[lang]) localeFiles[lang] = [];
                localeFiles[lang].push(content);
            }
        }
    }

    // Clean up temporary unzipped folder if one was created
    if (tempDirToDelete) {
        try {
            fs.rmSync(tempDirToDelete, { recursive: true, force: true });
        } catch (err) {
            console.error(`Error deleting temp folder ${tempDirToDelete}:`, err);
        }
    }

    return { info, luaFiles, localeFiles };
}

// -------------------------------------------------------------
// CLI Mode Execution
// -------------------------------------------------------------
function runCli(modPath, write, lang, removeUnused, outputPath) {
    try {
        console.log(`Scanning mod folder: ${modPath}`);
        const data = readModDir(modPath);
        const result = analyzeModCore({
            info: data.info,
            luaFiles: data.luaFiles,
            localeFiles: data.localeFiles,
            prototypesDb,
            vanillaNames,
            removeUnusedKeys: removeUnused
        });

        console.log(`Analysis complete for mod: "${result.modName}"`);
        console.log(`- Hardcoded issues: ${result.hardcodedIssues.length}`);
        console.log(`- Removed vanilla keys: ${result.removedVanillaKeys.length}`);
        console.log(`- Unused keys: ${result.unusedKeysList.length}`);

        let outPath = null;
        if (outputPath) {
            if (fs.existsSync(outputPath) && fs.statSync(outputPath).isDirectory()) {
                outPath = path.join(outputPath, `${result.modName}.cfg`);
            } else {
                outPath = outputPath;
            }
        } else if (write) {
            if (modPath.endsWith('.zip')) {
                outPath = path.join(path.dirname(modPath), `${result.modName}.cfg`);
            } else {
                outPath = path.join(modPath, 'locale', lang, `${result.modName}.cfg`);
            }
        }

        if (outPath) {
            const parentDir = path.dirname(outPath);
            if (!fs.existsSync(parentDir)) {
                fs.mkdirSync(parentDir, { recursive: true });
            }
            fs.writeFileSync(outPath, result.cleanedCfg, 'utf-8');
            console.log(`\nSuccessfully wrote cleaned .cfg to: ${outPath}`);
        } else {
            console.log(`\n--- Generated Cleaned .cfg (${lang}) ---`);
            console.log(result.cleanedCfg);
            console.log(`----------------------------------------`);
            
            if (result.hardcodedIssues.length > 0) {
                console.log(`\n--- Hardcoded / Untranslatable Strings ---`);
                result.hardcodedIssues.forEach(issue => {
                    console.log(`${issue.file}:${issue.line} [${issue.type.toUpperCase()}] ${issue.code} -> ${issue.message}`);
                });
            }
        }
    } catch (err) {
        console.error(`CLI Error: ${err.message}`);
        process.exit(1);
    }
}

// -------------------------------------------------------------
// Local HTTP Server Mode
// -------------------------------------------------------------
function startServer(port = 3001) {
    const server = http.createServer((req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        const urlObj = new URL(req.url, `http://${req.headers.host}`);
        
        if (req.method === 'GET' && urlObj.pathname === '/api/status') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', version: '1.0.0' }));
            return;
        }

        if (req.method === 'POST' && urlObj.pathname === '/api/analyze') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
                try {
                    const params = JSON.parse(body);
                    const modPath = params.path;
                    const removeUnused = !!params.removeUnused;

                    if (!modPath) {
                        throw new Error('path parameter is required');
                    }

                    const data = readModDir(modPath);
                    const result = analyzeModCore({
                        info: data.info,
                        luaFiles: data.luaFiles,
                        localeFiles: data.localeFiles,
                        prototypesDb,
                        vanillaNames,
                        removeUnusedKeys: removeUnused
                    });

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, result }));
                } catch (err) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: err.message }));
                }
            });
            return;
        }

        if (req.method === 'POST' && urlObj.pathname === '/api/save') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
                try {
                    const params = JSON.parse(body);
                    const modPath = params.path;
                    const content = params.content;
                    const lang = params.lang || 'en';

                    if (!modPath || !content) {
                        throw new Error('path and content are required');
                    }

                    const infoPath = path.join(modPath, 'info.json');
                    let modName = 'mod';
                    if (fs.existsSync(infoPath)) {
                        try {
                            const info = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));
                            modName = info.name || 'mod';
                        } catch (_) {}
                    }

                    const localeDir = path.join(modPath, 'locale', lang);
                    if (!fs.existsSync(localeDir)) {
                        fs.mkdirSync(localeDir, { recursive: true });
                    }

                    const outPath = path.join(localeDir, `${modName}.cfg`);
                    fs.writeFileSync(outPath, content, 'utf-8');

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, filePath: outPath }));
                } catch (err) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: err.message }));
                }
            });
            return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not Found' }));
    });

    server.listen(port, () => {
        console.log(`Factorio Localization Helper API Server running on http://localhost:${port}`);
    });
}

// -------------------------------------------------------------
// MCP Server Mode (JSON-RPC over stdio)
// -------------------------------------------------------------
const logFilePath = path.join(__dirname, 'mcp_debug.log');
function mcpLog(msg) {
    try {
        fs.appendFileSync(logFilePath, `[${new Date().toISOString()}] ${msg}\n`, 'utf-8');
    } catch (_) {}
}

function startMcp() {
    mcpLog("MCP server started");
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
    });

    rl.on('line', (line) => {
        if (!line.trim()) return;
        mcpLog(`IN: ${line}`);
        try {
            const request = JSON.parse(line);
            handleMcpRequest(request);
        } catch (err) {
            mcpLog(`ERR parsing: ${err.message}`);
            sendMcpError(null, -32700, "Parse error: " + err.message);
        }
    });

    process.on('SIGINT', () => {
        mcpLog("MCP server process SIGINT");
        process.exit(0);
    });
}

function handleMcpRequest(req) {
    const { method, id, params } = req;

    if (id === undefined || id === null) {
        mcpLog(`Notification received and ignored: ${method}`);
        return;
    }

    if (method === 'initialize') {
        sendMcpResponse(id, {
            protocolVersion: "2024-11-05",
            capabilities: {
                tools: {}
            },
            serverInfo: {
                name: "factorio-locale-helper",
                version: "1.0.0"
            }
        });
        return;
    }

    if (method === 'initialized') {
        return;
    }

    if (method === 'ping') {
        sendMcpResponse(id, {});
        return;
    }

    if (method === 'tools/list') {
        sendMcpResponse(id, {
            tools: [
                {
                    name: "analyze_mod",
                    description: "Analyze an unpacked Factorio mod folder to find missing localization keys, hardcoded strings, and generate/write the .cfg file.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            path: {
                                type: "string",
                                description: "Absolute path to the unpacked Factorio mod directory"
                            },
                            write: {
                                type: "boolean",
                                description: "Whether to write the generated .cfg file directly into the mod's locale folder",
                                default: false
                            },
                            lang: {
                                type: "string",
                                description: "Language code for the output locale file (e.g. 'en', 'ru')",
                                default: "en"
                            },
                            removeUnused: {
                                type: "boolean",
                                description: "Whether to remove unused keys from the generated .cfg file",
                                default: false
                            },
                            outputPath: {
                                type: "string",
                                description: "Optional path or directory where to write the generated .cfg file"
                            }
                        },
                        required: ["path"]
                    }
                },
                {
                    name: "manage_duplicates",
                    description: "Manage duplicate vanilla localization keys in a Factorio mod using Steam Factorio 2.1+ data. Supports listing duplicates ('status'), commenting them out with # ('comment'), or restoring them ('uncomment').",
                    inputSchema: {
                        type: "object",
                        properties: {
                            path: {
                                type: "string",
                                description: "Absolute path to the unpacked Factorio mod directory or its locale folder"
                            },
                            action: {
                                type: "string",
                                enum: ["status", "comment", "uncomment"],
                                default: "status",
                                description: "Action to perform: 'status' to view duplicates, 'comment' to comment them out (#), 'uncomment' to restore"
                            },
                            lang: {
                                type: "string",
                                default: "ru",
                                description: "Language code for the locale (default: 'ru')"
                            }
                        },
                        required: ["path"]
                    }
                },
                {
                    name: "scan_missing_keys",
                    description: "Batch scan active Factorio mods from mod-list.json, parse original English locales (locale/en/*.cfg) from folders and .zip archives, compare against target translation mod (my-texture-pack/locale/ru), and return missing keys diff.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            modsDir: {
                                type: "string",
                                description: "Path to Factorio mods directory containing mod-list.json (default: %APPDATA%/Factorio/mods)"
                            },
                            targetMod: {
                                type: "string",
                                default: "my-texture-pack",
                                description: "Target localization mod name (default: 'my-texture-pack')"
                            },
                            lang: {
                                type: "string",
                                default: "ru",
                                description: "Language code to compare against (default: 'ru')"
                            },
                            modFilter: {
                                type: "string",
                                description: "Optional name of a specific mod to scan"
                            },
                            writeDir: {
                                type: "string",
                                description: "Optional directory where to write generated .cfg diff files with missing keys"
                            },
                            writeToTarget: {
                                type: "boolean",
                                default: true,
                                description: "Whether to automatically write/merge missing keys directly into target mod's .cfg files (default: true)"
                            }
                        }
                    }
                },
                {
                    name: "audit_locale_quality",
                    description: "Audit Russian localization files for tag/placeholder mismatches against original English (missing [color=green][/color], __2__, etc.), foreign characters (en, jp, cn, etc.), mixed language strings ('wooden бочка'), and untranslated text.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            targetPath: {
                                type: "string",
                                description: "Path to the locale folder to audit (default: %APPDATA%/Factorio/mods/my-texture-pack/locale/ru)"
                            },
                            modsDir: {
                                type: "string",
                                description: "Path to Factorio mods folder containing original mod zips/folders with locale/en (default: %APPDATA%/Factorio/mods)"
                            },
                            modFilter: {
                                type: "string",
                                description: "Optional filter for a specific mod name or .cfg file"
                            },
                            issueType: {
                                type: "string",
                                enum: ["all", "tags", "foreign", "mixed", "untranslated"],
                                default: "all",
                                description: "Filter by issue type: 'all', 'tags' (missing tags/placeholders), 'foreign' (non-Russian characters like cn, jp, en), 'mixed' (mixed latin/cyrillic), or 'untranslated' (pure English text)"
                            },
                            limit: {
                                type: "number",
                                default: 100,
                                description: "Maximum number of issues to return (default: 100, 0 for unlimited)"
                            }
                        }
                    }
                }
            ]
        });
        return;
    }

    if (method === 'tools/call') {
        const { name, arguments: args } = params || {};
        if (name === 'analyze_mod') {
            try {
                const modPath = args.path;
                const write = !!args.write;
                const lang = args.lang || 'en';
                const removeUnused = !!args.removeUnused;
                const outputPath = args.outputPath;

                if (!modPath) {
                    throw new Error("Missing 'path' argument.");
                }

                const data = readModDir(modPath);
                const result = analyzeModCore({
                    info: data.info,
                    luaFiles: data.luaFiles,
                    localeFiles: data.localeFiles,
                    prototypesDb,
                    vanillaNames,
                    removeUnusedKeys: removeUnused
                });

                let outputText = `Analysis of mod "${result.modName}":\n\n`;
                outputText += `Hardcoded / untranslatable string issues found: ${result.hardcodedIssues.length}\n`;
                outputText += `Vanilla game keys removed: ${result.removedVanillaKeys.length}\n`;
                outputText += `Unused locale keys: ${result.unusedKeysList.length}\n\n`;

                let outPath = null;
                if (outputPath) {
                    if (fs.existsSync(outputPath) && fs.statSync(outputPath).isDirectory()) {
                        outPath = path.join(outputPath, `${result.modName}.cfg`);
                    } else {
                        outPath = outputPath;
                    }
                } else if (write) {
                    if (modPath.endsWith('.zip')) {
                        outPath = path.join(path.dirname(modPath), `${result.modName}.cfg`);
                    } else {
                        outPath = path.join(modPath, 'locale', lang, `${result.modName}.cfg`);
                    }
                }

                if (outPath) {
                    const parentDir = path.dirname(outPath);
                    if (!fs.existsSync(parentDir)) {
                        fs.mkdirSync(parentDir, { recursive: true });
                    }
                    fs.writeFileSync(outPath, result.cleanedCfg, 'utf-8');
                    outputText += `Saved generated locale file directly to:\n${outPath}\n`;
                } else {
                    outputText += `--- GENERATED CLEANED .CFG (${lang}) ---\n`;
                    outputText += result.cleanedCfg + '\n\n';
                    
                    if (result.hardcodedIssues.length > 0) {
                        outputText += `--- HARDCODED STRINGS ---\n`;
                        result.hardcodedIssues.forEach(issue => {
                            outputText += `${issue.file}:${issue.line} [${issue.type.toUpperCase()}] ${issue.code} -> ${issue.message}\n`;
                        });
                        outputText += `\n`;
                    }
                }

                sendMcpResponse(id, {
                    content: [
                        {
                            type: "text",
                            text: outputText
                        }
                    ]
                });
            } catch (err) {
                sendMcpResponse(id, {
                    content: [
                        {
                            type: "text",
                            text: `Error analyzing mod: ${err.message}`
                        }
                    ],
                    isError: true
                });
            }
            return;
        }

        if (name === 'manage_duplicates') {
            try {
                const modPath = args.path;
                const action = args.action || 'status';
                const lang = args.lang || 'ru';

                if (!modPath) {
                    throw new Error("Missing 'path' argument.");
                }

                const scriptPath = path.join(__dirname, 'manage_duplicates.py');
                const escapeArg = (s) => `"${s.replace(/"/g, '\\"')}"`;
                const cmd = `python ${escapeArg(scriptPath)} ${escapeArg(modPath)} --action ${action} --lang ${lang}`;
                
                mcpLog(`Running manage_duplicates cmd: ${cmd}`);
                const output = execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });

                sendMcpResponse(id, {
                    content: [
                        {
                            type: "text",
                            text: output
                        }
                    ]
                });
            } catch (err) {
                sendMcpResponse(id, {
                    content: [
                        {
                            type: "text",
                            text: `Error executing manage_duplicates: ${err.message}${err.stdout ? '\n' + err.stdout : ''}`
                        }
                    ],
                    isError: true
                });
            }
            return;
        }

        if (name === 'scan_missing_keys') {
            try {
                const result = scanMissingKeys({
                    modsDir: args?.modsDir,
                    targetMod: args?.targetMod,
                    lang: args?.lang,
                    modFilter: args?.modFilter || args?.filter,
                    writeDir: args?.writeDir,
                    writeToTarget: args?.writeToTarget !== false
                });

                sendMcpResponse(id, {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result, null, 2)
                        }
                    ]
                });
            } catch (err) {
                sendMcpResponse(id, {
                    content: [
                        {
                            type: "text",
                            text: `Error scanning missing keys: ${err.message}`
                        }
                    ],
                    isError: true
                });
            }
            return;
        }

        if (name === 'audit_locale_quality') {
            try {
                const result = auditLocaleQuality({
                    targetLocaleDir: args?.targetPath || args?.targetLocaleDir,
                    modsDir: args?.modsDir || args?.sourcePath,
                    modFilter: args?.modFilter || args?.filter,
                    issueType: args?.issueType,
                    limit: typeof args?.limit === 'number' ? args.limit : 100
                });

                sendMcpResponse(id, {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result, null, 2)
                        }
                    ]
                });
            } catch (err) {
                sendMcpResponse(id, {
                    content: [
                        {
                            type: "text",
                            text: `Error auditing locale quality: ${err.message}`
                        }
                    ],
                    isError: true
                });
            }
            return;
        }

        sendMcpError(id, -32601, `Method not found: tools/call/${name}`);
        return;
    }

    sendMcpError(id, -32601, `Method not found: ${method}`);
}

function sendMcpResponse(id, result) {
    const responseStr = JSON.stringify({
        jsonrpc: "2.0",
        id,
        result
    });
    mcpLog(`OUT RESP: ${responseStr}`);
    console.log(responseStr);
}

function sendMcpError(id, code, message) {
    const errorStr = JSON.stringify({
        jsonrpc: "2.0",
        id,
        error: { code, message }
    });
    mcpLog(`OUT ERR: ${errorStr}`);
    console.log(errorStr);
}

// -------------------------------------------------------------
// Main Dispatcher
// -------------------------------------------------------------
const args = process.argv.slice(2);
let mode = 'cli';
let modPath = '';
let write = false;
let lang = '';
let removeUnused = false;
let port = 3001;
let outputPath = '';
let action = '';
let modsDir = '';
let targetMod = 'my-texture-pack';
let modFilter = '';
let writeDir = '';
let issueType = 'all';
let limit = 100;
let jsonOutput = false;
let writeToTarget = true;

for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--server') {
        mode = 'server';
    } else if (arg === '--mcp') {
        mode = 'mcp';
    } else if (arg === '--duplicates' || arg === '--manage-duplicates') {
        mode = 'duplicates';
    } else if (arg === '--scan-missing' || arg === '--missing-keys') {
        mode = 'scan-missing';
    } else if (arg === '--dry-run' || arg === '--no-write') {
        writeToTarget = false;
    } else if (arg === '--audit' || arg === '--audit-locale') {
        mode = 'audit';
    } else if (arg === '--mods-dir') {
        modsDir = args[++i];
    } else if (arg === '--target-mod') {
        targetMod = args[++i];
    } else if (arg === '--filter' || arg === '--mod-filter') {
        modFilter = args[++i];
    } else if (arg === '--write-dir') {
        writeDir = args[++i];
    } else if (arg === '--issue-type') {
        issueType = args[++i];
    } else if (arg === '--limit') {
        limit = parseInt(args[++i], 10);
    } else if (arg === '--json') {
        jsonOutput = true;
    } else if (arg === '--action') {
        action = args[++i];
    } else if (arg === '--path') {
        modPath = args[++i];
    } else if (arg === '--write') {
        write = true;
    } else if (arg === '--lang') {
        lang = args[++i];
    } else if (arg === '--remove-unused') {
        removeUnused = true;
    } else if (arg === '--output-path' || arg === '--outputPath') {
        outputPath = args[++i];
    } else if (arg === '--port') {
        port = parseInt(args[++i], 10);
    } else if (arg === '--help' || arg === '-h') {
        console.log(`
Factorio Mod Localization Helper CLI / Server / MCP

Usage:
  Direct CLI analysis:
    node cli.js --path <absolute_mod_path> [--write] [--lang <lang>] [--remove-unused] [--output-path <path>]

  Batch Missing Keys Diff (mod-list.json vs my-texture-pack):
    node cli.js --scan-missing [--mods-dir <dir>] [--target-mod <name>] [--lang <lang>] [--filter <mod>] [--write-dir <dir>] [--json]

  Audit Locale Quality (mixed language / untranslated):
    node cli.js --audit [--path <target_locale_dir>] [--filter <mod>] [--issue-type all|mixed|untranslated] [--limit <num>] [--json]

  Duplicate Vanilla Keys Manager (Steam Factorio 2.1+):
    node cli.js --duplicates [--path <path>] [--action status|comment|uncomment] [--lang <lang>]

  Local HTTP server mode (default port 3001):
    node cli.js --server [--port <port>]

  MCP stdio server mode (for AI integrations):
    node cli.js --mcp

Options:
  --scan-missing      Run batch missing keys diff.
  --audit             Run translation quality audit.
  --mods-dir <dir>    Path to mods folder containing mod-list.json (default: %APPDATA%/Factorio/mods).
  --target-mod <name> Target translation mod name (default: my-texture-pack).
  --filter <mod>      Filter analysis/diff/audit to a specific mod name.
  --write-dir <dir>   Directory to write missing diff .cfg files.
  --issue-type <type> Issue type for audit: all (default), mixed, untranslated.
  --limit <num>       Maximum audit issues to display (default: 100, 0 for unlimited).
  --json              Output raw JSON results.
  --path <path>       Absolute path to the unpacked Factorio mod folder or zip archive.
  --write             Save the generated CFG directly into the mod's locale subfolder.
  --lang <lang>       Language code for output (default: 'en' for single mod, 'ru' for diff/audit).
  --remove-unused     Remove unused locale keys from the cleaned output.
  --output-path <path> Optional path or directory where to write the generated .cfg file.
  --duplicates        Run vanilla duplicates manager.
  --action <action>   Action for duplicates manager: status, comment, or uncomment.
  --server            Run as a local HTTP API server.
  --port <port>       Port for HTTP API server (default: 3001).
  --mcp               Run as an MCP stdio server.
  --help, -h          Show this help text.
`);
        process.exit(0);
    }
}

if (mode === 'server') {
    startServer(port);
} else if (mode === 'mcp') {
    startMcp();
} else if (mode === 'scan-missing') {
    try {
        console.log(`Scanning active Factorio mods for missing keys (target: ${targetMod})...`);
        const result = scanMissingKeys({
            modsDir: modsDir || undefined,
            targetMod: targetMod || undefined,
            lang: lang || 'ru',
            modFilter: modFilter || undefined,
            writeDir: writeDir || undefined,
            writeToTarget
        });
        if (jsonOutput) {
            console.log(JSON.stringify(result, null, 2));
        } else {
            console.log(`\n=== Missing Keys Diff Summary ===`);
            console.log(`Mods directory: ${result.summary.modsDir}`);
            console.log(`Target mod: ${result.summary.targetMod} (locale: ${result.summary.targetLang})`);
            console.log(`Active mods scanned: ${result.summary.totalActiveMods}`);
            console.log(`Mods with missing keys: ${result.summary.modsWithMissingKeys}`);
            console.log(`Total missing keys: ${result.summary.totalMissingKeys}`);
            console.log(`Auto-merged into target .cfg: ${result.summary.writeToTarget ? `${result.summary.updatedFilesCount} files updated` : 'DISABLED (dry run)'}`);
            if (result.summary.writtenToDir) {
                console.log(`Saved diff .cfg files to: ${result.summary.writtenToDir}`);
            }
            console.log(`---------------------------------`);
            for (const [mName, mData] of Object.entries(result.mods)) {
                console.log(`\nMod: ${mName} (${mData.missingCount} missing keys, RU file exists: ${mData.ruFileExists ? 'YES' : 'NO'})`);
                for (const [sec, keys] of Object.entries(mData.sections)) {
                    console.log(`  [${sec}]`);
                    for (const [k, v] of Object.entries(keys)) {
                        console.log(`    ${k}=${v}`);
                    }
                }
            }
        }
    } catch (err) {
        console.error(`Error scanning missing keys: ${err.message}`);
        process.exit(1);
    }
} else if (mode === 'audit') {
    try {
        console.log(`Auditing locale quality (type: ${issueType}, limit: ${limit})...`);
        const result = auditLocaleQuality({
            targetLocaleDir: modPath || undefined,
            modsDir: modsDir || undefined,
            modFilter: modFilter || undefined,
            issueType,
            limit
        });
        if (jsonOutput) {
            console.log(JSON.stringify(result, null, 2));
        } else {
            console.log(`\n=== Locale Quality Audit Summary ===`);
            console.log(`Directory: ${result.summary.targetLocaleDir}`);
            console.log(`Files scanned: ${result.summary.totalFilesScanned}`);
            console.log(`Total issues found: ${result.summary.totalIssuesFound} (Tags: ${result.summary.tagMismatchCount || 0}, Foreign: ${result.summary.foreignCharactersCount || 0}, Mixed: ${result.summary.mixedCount}, Untranslated: ${result.summary.untranslatedCount})`);
            console.log(`Issues displayed: ${result.summary.returnedCount}${result.summary.hasMore ? ' (use --limit 0 for all)' : ''}`);
            console.log(`------------------------------------`);
            for (const issue of result.issues) {
                let label = '[UNKNOWN]';
                if (issue.type === 'tag_mismatch') {
                    label = '[TAG MISMATCH]';
                } else if (issue.type === 'foreign_characters') {
                    label = `[FOREIGN (${(issue.languages || []).join(',')})]`;
                } else if (issue.type === 'mixed_language') {
                    label = '[MIXED]';
                } else if (issue.type === 'untranslated_english') {
                    label = '[UNTRANSLATED]';
                }

                console.log(`${label} ${issue.file} -> [${issue.section}] ${issue.key}`);
                console.log(`   Text: "${issue.text}"`);
                if (issue.originalText) {
                    console.log(`   Original: "${issue.originalText}"`);
                }
                if (issue.missingTags && issue.missingTags.length > 0) {
                    console.log(`   Missing: ${issue.missingTags.join(', ')}`);
                }
                if (issue.extraTags && issue.extraTags.length > 0) {
                    console.log(`   Extra: ${issue.extraTags.join(', ')}`);
                }
                if (issue.syntaxErrors && issue.syntaxErrors.length > 0) {
                    console.log(`   Syntax: ${issue.syntaxErrors.join('; ')}`);
                }
                if (issue.foreignCharacters && issue.foreignCharacters.length > 0) {
                    console.log(`   Characters: ${issue.foreignCharacters.join(', ')}`);
                }
                if (issue.suspiciousWords && issue.suspiciousWords.length > 0) {
                    console.log(`   Suspicious: ${issue.suspiciousWords.join(', ')}`);
                }
            }
        }
    } catch (err) {
        console.error(`Error auditing locale: ${err.message}`);
        process.exit(1);
    }
} else if (mode === 'duplicates') {
    const scriptPath = path.join(__dirname, 'manage_duplicates.py');
    const escapeArg = (s) => `"${s.replace(/"/g, '\\"')}"`;
    const targetPath = modPath ? escapeArg(modPath) : '';
    const actionArg = action ? `--action ${action}` : '';
    const langArg = lang ? `--lang ${lang}` : '';
    const cmd = `python ${escapeArg(scriptPath)} ${targetPath} ${actionArg} ${langArg}`.trim();
    try {
        execSync(cmd, { stdio: 'inherit' });
    } catch (e) {
        process.exit(e.status || 1);
    }
} else {
    if (!modPath) {
        console.error("Error: --path <mod_path> is required when not running in server, mcp, duplicates, scan-missing, or audit mode.");
        console.log("Run with --help for more information.");
        process.exit(1);
    }
    runCli(modPath, write, lang || 'en', removeUnused, outputPath);
}
