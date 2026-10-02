import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { analyzeModCore } from './analyzer.js';

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
    const [removedVanillaKeys, setRemovedVanillaKeys] = useState<{section: string, key: string}[]>([]);
    const [unusedKeysList, setUnusedKeysList] = useState<{section: string, key: string}[]>([]);

    const [isLocalServerConnected, setIsLocalServerConnected] = useState(false);
    const [localModPath, setLocalModPath] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<string | null>(null);
    const [selectedLang, setSelectedLang] = useState('ru'); // default to 'ru' since user requested it

    const fileInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const checkLocalServer = async () => {
            try {
                const response = await fetch('http://localhost:3001/api/status');
                const data = await response.json();
                if (data.status === 'ok') {
                    setIsLocalServerConnected(true);
                } else {
                    setIsLocalServerConnected(false);
                }
            } catch (e) {
                setIsLocalServerConnected(false);
            }
        };
        checkLocalServer();
        const interval = setInterval(checkLocalServer, 5000);
        return () => clearInterval(interval);
    }, []);

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

    const handleFolderSelect = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setIsAnalyzing(true);
        setError(null);
        setGeneratedCfg('');
        setCleanedCfg('');
        setRemovedKeysCfg('');
        setAnalysisLog('');
        setHardcodedIssues([]);
        setRemovedVanillaKeys([]);
        setUnusedKeysList([]);

        try {
            let info: any = {};
            const luaFiles: { path: string, content: string }[] = [];
            const localeFiles: { [lang: string]: string[] } = {};

            const vanillaNamesText = await (await fetch('Internal_names.txt')).text();
            const vanillaNames = new Set(vanillaNamesText.split(/\r?\n/).filter(Boolean));

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const relPath = file.webkitRelativePath.replace(/\\/g, '/');
                const parts = relPath.split('/');
                const relSubPath = parts.slice(1).join('/');

                if (relSubPath === 'info.json') {
                    info = JSON.parse(await file.text());
                } else if (relSubPath.endsWith('.lua')) {
                    const content = await file.text();
                    luaFiles.push({ path: relSubPath, content });
                } else if (relSubPath.startsWith('locale/') && relSubPath.endsWith('.cfg')) {
                    const langMatch = relSubPath.match(/^locale\/([a-zA-Z-]+)\//);
                    if (langMatch && langMatch[1]) {
                        const lang = langMatch[1];
                        if (!localeFiles[lang]) localeFiles[lang] = [];
                        localeFiles[lang].push(await file.text());
                    }
                }
            }

            const result = analyzeModCore({
                info,
                luaFiles,
                localeFiles,
                prototypesDb,
                vanillaNames,
                removeUnusedKeys
            });

            setModName(result.modName);
            setGeneratedCfg(result.generatedCfg);
            setCleanedCfg(result.cleanedCfg);
            setRemovedKeysCfg(result.removedKeysCfg);
            setUnusedKeysCfg(result.unusedKeysCfg);
            setAnalysisLog(result.analysisLog);
            setHardcodedIssues(result.hardcodedIssues);
            setRemovedVanillaKeys(result.removedVanillaKeys);
            setUnusedKeysList(result.unusedKeysList);

        } catch (e) {
            console.error(e);
            setError(`An error occurred during analysis: ${(e as Error).message}`);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleLocalScan = async () => {
        if (!localModPath) return;
        setIsAnalyzing(true);
        setError(null);
        setGeneratedCfg('');
        setCleanedCfg('');
        setRemovedKeysCfg('');
        setAnalysisLog('');
        setHardcodedIssues([]);
        setRemovedVanillaKeys([]);
        setUnusedKeysList([]);

        try {
            const response = await fetch('http://localhost:3001/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    path: localModPath,
                    removeUnused: removeUnusedKeys
                })
            });
            const data = await response.json();
            if (data.success) {
                const result = data.result;
                setModName(result.modName);
                setGeneratedCfg(result.generatedCfg);
                setCleanedCfg(result.cleanedCfg);
                setRemovedKeysCfg(result.removedKeysCfg);
                setUnusedKeysCfg(result.unusedKeysCfg);
                setAnalysisLog(result.analysisLog);
                setHardcodedIssues(result.hardcodedIssues);
                setRemovedVanillaKeys(result.removedVanillaKeys);
                setUnusedKeysList(result.unusedKeysList);
            } else {
                setError(data.error);
            }
        } catch (e) {
            setError(`Local scan failed: ${(e as Error).message}`);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleLocalSave = async () => {
        if (!localModPath || !cleanedCfg) return;
        setIsSaving(true);
        setSaveStatus(null);
        try {
            const response = await fetch('http://localhost:3001/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    path: localModPath,
                    content: cleanedCfg,
                    lang: selectedLang
                })
            });
            const data = await response.json();
            if (data.success) {
                setSaveStatus(`Saved successfully to ${data.filePath}`);
            } else {
                setSaveStatus(`Save failed: ${data.error}`);
            }
        } catch (e) {
            setSaveStatus(`Save failed: ${(e as Error).message}`);
        } finally {
            setIsSaving(false);
            setTimeout(() => setSaveStatus(null), 5000);
        }
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
        setRemovedVanillaKeys([]);
        setUnusedKeysList([]);

        try {
            const zip = await JSZip.loadAsync(file);
            let info: any = {};
            const luaFiles: { path: string, content: string }[] = [];
            const localeFiles: { [lang: string]: string[] } = {};

            const vanillaNamesText = await (await fetch('Internal_names.txt')).text();
            const vanillaNames = new Set(vanillaNamesText.split(/\r?\n/).filter(Boolean));

            for (const path in zip.files) {
                if (/[^/]+\/info\.json$/.test(path)) {
                    info = JSON.parse(await zip.files[path].async('string'));
                }
                else if (path.endsWith('.lua') && !zip.files[path].dir) {
                    const content = await zip.files[path].async('string');
                    luaFiles.push({ path, content });
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

            const result = analyzeModCore({
                info,
                luaFiles,
                localeFiles,
                prototypesDb,
                vanillaNames,
                removeUnusedKeys
            });

            setModName(result.modName);
            setGeneratedCfg(result.generatedCfg);
            setCleanedCfg(result.cleanedCfg);
            setRemovedKeysCfg(result.removedKeysCfg);
            setUnusedKeysCfg(result.unusedKeysCfg);
            setAnalysisLog(result.analysisLog);
            setHardcodedIssues(result.hardcodedIssues);
            setRemovedVanillaKeys(result.removedVanillaKeys);
            setUnusedKeysList(result.unusedKeysList);

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
                <p>Upload a <code>.zip</code> file, select an unpacked mod folder, or connect to the local server to scan a direct path.</p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                    <div className="options-panel panel" style={{ margin: 0, display: 'inline-block' }}>
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
                </div>
            </header>

            {/* Local backend & target language control panel */}
            <div className="panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{
                            display: 'inline-block',
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            backgroundColor: isLocalServerConnected ? '#2ecc71' : '#e74c3c',
                            boxShadow: isLocalServerConnected ? '0 0 8px #2ecc71' : '0 0 8px #e74c3c'
                        }}></span>
                        <strong>Local Backend Server:</strong>{' '}
                        <span style={{ color: isLocalServerConnected ? '#2ecc71' : '#aaa' }}>
                            {isLocalServerConnected ? 'Connected (Port 3001)' : 'Disconnected (Run npm run server to enable auto-save)'}
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <label htmlFor="target-lang-select" style={{ fontWeight: 'bold' }}>Target Language: </label>
                        <select 
                            id="target-lang-select"
                            value={selectedLang} 
                            onChange={(e) => setSelectedLang(e.target.value)}
                            style={{ 
                                backgroundColor: '#140f0a', 
                                color: '#ffa200', 
                                border: '1px solid #e39827', 
                                padding: '6px 12px', 
                                borderRadius: '4px',
                                fontFamily: 'monospace',
                                cursor: 'pointer'
                            }}
                        >
                            <option value="ru">Russian (ru)</option>
                            <option value="en">English (en)</option>
                            <option value="de">German (de)</option>
                            <option value="fr">French (fr)</option>
                            <option value="es">Spanish (es)</option>
                            <option value="zh-CN">Chinese (zh-CN)</option>
                        </select>
                    </div>
                </div>

                {isLocalServerConnected && (
                    <div style={{ borderTop: '1px solid #444', paddingTop: '1rem', marginTop: '0.5rem' }}>
                        <h4 style={{ color: '#ffa200', marginBottom: '0.5rem' }}>Direct Local Folder Scan & Auto-Save</h4>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <input 
                                type="text" 
                                placeholder="e.g. C:\Users\Админ\AppData\Roaming\Factorio\mods\my-mod" 
                                value={localModPath} 
                                onChange={(e) => setLocalModPath(e.target.value)}
                                aria-label="Local mod folder absolute path"
                                style={{ 
                                    flexGrow: 1, 
                                    padding: '8px 12px', 
                                    backgroundColor: '#140f0a', 
                                    border: '1px solid #555', 
                                    borderRadius: '4px',
                                    color: '#fff',
                                    fontFamily: 'monospace'
                                }}
                            />
                            <button className="button-orange" onClick={handleLocalScan} disabled={isAnalyzing}>
                                {isAnalyzing ? 'Scanning...' : 'Scan Folder Path'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div
                className={`drop-zone panel-inset ${isDragOver ? 'drag-over' : ''}`}
                onDrop={handleDrop}
                onDragOver={handleDragEvents}
                onDragEnter={handleDragEvents}
                onDragLeave={handleDragEvents}
            >
                <input
                    type="file"
                    accept=".zip"
                    onChange={(e) => handleFileSelect(e.target.files)}
                    style={{ display: 'none' }}
                    ref={fileInputRef}
                />
                <input
                    type="file"
                    webkitdirectory=""
                    directory=""
                    multiple
                    onChange={(e) => handleFolderSelect(e.target.files)}
                    style={{ display: 'none' }}
                    ref={folderInputRef}
                />
                <h2>Drag & Drop your .zip file here</h2>
                <p style={{ margin: '0.5rem 0' }}>or select source format</p>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '0.75rem' }}>
                    <button className="button" onClick={() => fileInputRef.current?.click()}>
                        Choose .zip Mod File
                    </button>
                    <button className="button" onClick={() => folderInputRef.current?.click()}>
                        Choose Mod Folder
                    </button>
                </div>
            </div>

            <div className="status-container">
                {isAnalyzing && <div className="loader" aria-label="Analyzing..."></div>}
                {error && <div className="error-message panel alert alert-error">{error}</div>}
            </div>

            {saveStatus && (
                <div className={`panel alert ${saveStatus.startsWith('Save failed') ? 'alert-error' : 'alert-success'}`} style={{ textAlign: 'center', padding: '0.75rem' }}>
                    {saveStatus}
                </div>
            )}

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
                                {isLocalServerConnected && localModPath && (
                                    <button 
                                        className="button-orange" 
                                        onClick={handleLocalSave} 
                                        disabled={isSaving}
                                    >
                                        {isSaving ? 'Saving...' : 'Save to Mod Folder'}
                                    </button>
                                )}
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

            {removedVanillaKeys.length > 0 && (
                <div className="panel" style={{ marginTop: '2rem' }}>
                    <h3>Found Vanilla Keys ({removedVanillaKeys.length})</h3>
                    <p style={{marginBottom: '1rem'}}>
                        These keys were found in the mod's locale files but are already provided by the base game.
                    </p>
                    <div className="table-container panel-inset" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr>
                                    <th style={{ borderBottom: '1px solid #555', padding: '8px' }}>Section</th>
                                    <th style={{ borderBottom: '1px solid #555', padding: '8px' }}>Key</th>
                                </tr>
                            </thead>
                            <tbody>
                                {removedVanillaKeys.map((item, idx) => (
                                    <tr key={idx}>
                                        <td style={{ borderBottom: '1px solid #444', padding: '8px', whiteSpace: 'nowrap' }}>{item.section}</td>
                                        <td style={{ borderBottom: '1px solid #444', padding: '8px', fontFamily: 'monospace' }}>{item.key}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {unusedKeysList.length > 0 && (
                <div className="panel" style={{ marginTop: '2rem' }}>
                    <h3>Unused Keys ({unusedKeysList.length})</h3>
                    <p style={{marginBottom: '1rem'}}>
                        These keys were found in the mod's locale files but do not appear to be used in any scripts or prototypes.
                    </p>
                    <div className="table-container panel-inset" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr>
                                    <th style={{ borderBottom: '1px solid #555', padding: '8px' }}>Section</th>
                                    <th style={{ borderBottom: '1px solid #555', padding: '8px' }}>Key</th>
                                </tr>
                            </thead>
                            <tbody>
                                {unusedKeysList.map((item, idx) => (
                                    <tr key={idx}>
                                        <td style={{ borderBottom: '1px solid #444', padding: '8px', whiteSpace: 'nowrap' }}>{item.section}</td>
                                        <td style={{ borderBottom: '1px solid #444', padding: '8px', fontFamily: 'monospace' }}>{item.key}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

const container = document.getElementById('root');
const root = ReactDOM.createRoot(container!);
root.render(<App />);