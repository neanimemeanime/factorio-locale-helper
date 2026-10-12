import React, { useState, useCallback, useRef } from 'react';
import { analyzeModCore } from '../../analyzer.js';
import { useI18n } from '../i18n.tsx';

declare const JSZip: any;

export type HardcodedStringIssue = {
    file: string;
    line: number;
    code: string;
    type: 'hardcoded' | 'untranslatable';
    message: string;
};

interface ModAnalyzerTabProps {
    isConnected: boolean;
    defaultModsDir: string;
    selectedLang: string;
    prototypesDb: Set<string>;
}

export const ModAnalyzerTab: React.FC<ModAnalyzerTabProps> = ({
    isConnected,
    defaultModsDir,
    selectedLang,
    prototypesDb
}) => {
    const { t } = useI18n();
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [modName, setModName] = useState('mod');
    const [generatedCfg, setGeneratedCfg] = useState('');
    const [cleanedCfg, setCleanedCfg] = useState('');
    const [removedKeysCfg, setRemovedKeysCfg] = useState('');
    const [unusedKeysCfg, setUnusedKeysCfg] = useState('');
    const [analysisLog, setAnalysisLog] = useState('');
    const [removeUnusedKeys, setRemoveUnusedKeys] = useState(false);

    const [hardcodedIssues, setHardcodedIssues] = useState<HardcodedStringIssue[]>([]);
    const [removedVanillaKeys, setRemovedVanillaKeys] = useState<{ section: string; key: string }[]>([]);
    const [unusedKeysList, setUnusedKeysList] = useState<{ section: string; key: string }[]>([]);

    const [localModPath, setLocalModPath] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            analyzeZipFile(e.dataTransfer.files[0]);
        }
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

    const analyzeZipFile = useCallback(async (file: File) => {
        if (!file.name.endsWith('.zip')) {
            setError('Please select a mod .zip archive.');
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
            const luaFiles: { path: string; content: string }[] = [];
            const localeFiles: { [lang: string]: string[] } = {};

            const vanillaNamesText = await (await fetch('Internal_names.txt')).text();
            const vanillaNames = new Set(vanillaNamesText.split(/\r?\n/).filter(Boolean));

            for (const path in zip.files) {
                if (/[^/]+\/info\.json$/.test(path)) {
                    info = JSON.parse(await zip.files[path].async('string'));
                } else if (path.endsWith('.lua') && !zip.files[path].dir) {
                    const content = await zip.files[path].async('string');
                    luaFiles.push({ path, content });
                } else if (/\/locale\/([a-zA-Z-]+)\/.*\.cfg$/.test(path) && !zip.files[path].dir) {
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
            setError(`Error analyzing archive: ${(e as Error).message}`);
        } finally {
            setIsAnalyzing(false);
        }
    }, [removeUnusedKeys, prototypesDb]);

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
            const luaFiles: { path: string; content: string }[] = [];
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
            setError(`Error analyzing folder: ${(e as Error).message}`);
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
            const response = await fetch('/api/analyze', {
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
            setError(`Path scan failed: ${(e as Error).message}`);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleLocalSave = async () => {
        if (!localModPath || !cleanedCfg) return;
        setIsSaving(true);
        setSaveStatus(null);
        try {
            const response = await fetch('/api/save', {
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
                setSaveStatus(`Successfully saved: ${data.filePath}`);
            } else {
                setSaveStatus(`Save error: ${data.error}`);
            }
        } catch (e) {
            setSaveStatus(`Save error: ${(e as Error).message}`);
        } finally {
            setIsSaving(false);
            setTimeout(() => setSaveStatus(null), 5000);
        }
    };

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

    const [copyStatus, setCopyStatus] = useState<string | null>(null);

    const copyToClipboard = (content: string, label: string = 'Copied to clipboard') => {
        navigator.clipboard.writeText(content);
        setCopyStatus(label);
        setTimeout(() => setCopyStatus(null), 3000);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Options & Local Scan Bar */}
            <div className="panel tab-content-panel" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <label className="checkbox-label" style={{ margin: 0 }}>
                        <input
                            type="checkbox"
                            checked={removeUnusedKeys}
                            onChange={(e) => setRemoveUnusedKeys(e.target.checked)}
                        />
                        <span className="checkbox"></span>
                        <div style={{ color: '#e0e0e0', fontSize: '0.95rem' }}>
                            {t('analyzer.removeUnused')}
                        </div>
                    </label>
                </div>

                {isConnected && (
                    <div style={{ borderTop: '1px solid #444444', paddingTop: '1rem', marginTop: '1rem' }}>
                        <h4 style={{ color: '#ffa200', margin: '0 0 0.5rem 0', fontSize: '1rem' }}>
                            {t('analyzer.directFolder')}
                        </h4>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <input
                                type="text"
                                placeholder={`e.g.: ${defaultModsDir}\\my-mod`}
                                value={localModPath}
                                onChange={(e) => setLocalModPath(e.target.value)}
                                className="factorio-input"
                                style={{ flexGrow: 1, minWidth: '240px' }}
                            />
                            <button className="button-orange" onClick={handleLocalScan} disabled={isAnalyzing}>
                                {isAnalyzing ? t('missing.scanning') : t('analyzer.scanFolder')}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Drop Zone */}
            <div
                className={`drop-zone ${isDragOver ? 'drag-over' : ''}`}
                onDrop={handleDrop}
                onDragOver={handleDragEvents}
                onDragEnter={handleDragEvents}
                onDragLeave={handleDragEvents}
            >
                <input
                    type="file"
                    accept=".zip"
                    onChange={(e) => e.target.files?.[0] && analyzeZipFile(e.target.files[0])}
                    style={{ display: 'none' }}
                    ref={fileInputRef}
                />
                <input
                    type="file"
                    // @ts-ignore
                    webkitdirectory=""
                    // @ts-ignore
                    directory=""
                    multiple
                    onChange={(e) => handleFolderSelect(e.target.files)}
                    style={{ display: 'none' }}
                    ref={folderInputRef}
                />
                <div className="drop-zone-icon">
                    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#ffa200" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                </div>
                <h2>{t('analyzer.dropzone')}</h2>
                <p style={{ margin: '0.4rem 0 1rem 0' }}>{t('analyzer.or')}</p>
                <div className="button-group" style={{ justifyContent: 'center' }}>
                    <button className="button" onClick={() => fileInputRef.current?.click()}>
                        {t('analyzer.chooseZip')}
                    </button>
                    <button className="button" onClick={() => folderInputRef.current?.click()}>
                        {t('analyzer.chooseFolder')}
                    </button>
                </div>
            </div>

            {/* Status alerts */}
            {isAnalyzing && (
                <div className="status-container">
                    <div className="loader"></div>
                </div>
            )}

            {error && (
                <div className="panel alert alert-error" style={{ textAlign: 'center' }}>
                    {error}
                </div>
            )}

            {saveStatus && (
                <div className={`panel alert ${saveStatus.toLowerCase().includes('error') ? 'alert-error' : 'alert-success'}`} style={{ textAlign: 'center', padding: '0.75rem' }}>
                    {saveStatus}
                </div>
            )}

            {copyStatus && (
                <div className="panel alert alert-success" style={{ textAlign: 'center', padding: '0.75rem' }}>
                    {copyStatus}
                </div>
            )}

            {/* Results Grid */}
            {generatedCfg && (
                <div className="results-container">
                    <div className="column panel">
                        <div className="column-header">
                            <h3>{t('analyzer.sourceCfg')}</h3>
                            <div className="button-group">
                                <button className="button button-sm" onClick={() => copyToClipboard(generatedCfg)}>{t('analyzer.copyCfg')}</button>
                                <button className="button-green button-sm" onClick={() => downloadFile(generatedCfg, `${modName}.source.cfg`)}>{t('analyzer.downloadCfg')}</button>
                            </div>
                        </div>
                        <textarea className="panel-inset factorio-textarea" value={generatedCfg} readOnly></textarea>
                    </div>
                    <div className="column panel">
                        <div className="column-header">
                            <h3>{t('analyzer.cleanedCfg')}</h3>
                            <div className="button-group">
                                <button className="button button-sm" onClick={() => copyToClipboard(cleanedCfg)}>{t('analyzer.copyCfg')}</button>
                                <button className="button-green button-sm" onClick={() => downloadFile(cleanedCfg, `${modName}.cfg`)}>{t('analyzer.downloadCfg')}</button>
                                {isConnected && localModPath && (
                                    <button
                                        className="button-orange button-sm"
                                        onClick={handleLocalSave}
                                        disabled={isSaving}
                                    >
                                        {isSaving ? t('analyzer.saving') : t('analyzer.saveToFolder')}
                                    </button>
                                )}
                            </div>
                        </div>
                        <textarea className="panel-inset factorio-textarea" value={cleanedCfg} readOnly></textarea>
                        <div className="log-container panel-inset">
                            <h4>{t('analyzer.analysisLog')}</h4>
                            <p>{analysisLog}</p>
                        </div>
                        <div className="log-actions">
                            <button className="button button-sm" onClick={() => downloadFile(removedKeysCfg, `${modName}.vanilla_keys.cfg`)}>
                                {t('analyzer.downloadRemovedVanilla')}
                            </button>
                            {unusedKeysCfg && unusedKeysCfg.length > 150 && (
                                <button className="button-red button-sm" onClick={() => downloadFile(unusedKeysCfg, `${modName}.unused_keys.cfg`)}>
                                    {t('analyzer.downloadUnused')}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Hardcoded strings */}
            {hardcodedIssues.length > 0 && (
                <div className="panel">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <h3 style={{ margin: 0, color: '#ffe6c0' }}>{t('analyzer.hardcodedTitle')}</h3>
                        <span className="badge badge-warning">{hardcodedIssues.length}</span>
                    </div>
                    <p style={{ margin: '0 0 1rem 0', color: '#aaaaaa', fontSize: '0.95rem' }}>
                        {t('analyzer.hardcodedDesc')}
                    </p>
                    <div className="table-container panel-inset" style={{ maxHeight: '420px', overflowY: 'auto', padding: '4px' }}>
                        <table className="panel-hole">
                            <thead>
                                <tr>
                                    <th style={{ width: '22%' }}>{t('analyzer.colFile')}</th>
                                    <th style={{ width: '8%', textAlign: 'center' }}>{t('analyzer.colLine')}</th>
                                    <th style={{ width: '15%', textAlign: 'center' }}>{t('analyzer.colType')}</th>
                                    <th style={{ width: '25%' }}>{t('analyzer.colCode')}</th>
                                    <th>{t('analyzer.colDesc')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {hardcodedIssues.map((issue, idx) => (
                                    <tr key={idx}>
                                        <td className="panel-hole-inner" style={{ wordBreak: 'break-all', fontSize: '0.85rem' }}>{issue.file}</td>
                                        <td className="panel-hole-inner" style={{ textAlign: 'center', fontFamily: 'Consolas, monospace' }}>{issue.line}</td>
                                        <td className="panel-hole-inner" style={{ textAlign: 'center' }}>
                                            <span className={issue.type === 'untranslatable' ? 'badge badge-error' : 'badge badge-warning'}>
                                                {issue.type.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="panel-hole-inner" style={{ fontFamily: 'Consolas, monospace', color: '#ffa200', wordBreak: 'break-all' }}>
                                            {issue.code}
                                        </td>
                                        <td className="panel-hole-inner" style={{ fontSize: '0.85rem' }}>{issue.message}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Removed vanilla keys */}
            {removedVanillaKeys.length > 0 && (
                <div className="panel">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <h3 style={{ margin: 0, color: '#ffe6c0' }}>{t('analyzer.vanillaKeysFound')}</h3>
                        <span className="badge badge-info">{removedVanillaKeys.length}</span>
                    </div>
                    <div className="table-container panel-inset" style={{ maxHeight: '320px', overflowY: 'auto', padding: '4px' }}>
                        <table className="panel-hole">
                            <thead>
                                <tr>
                                    <th style={{ width: '35%' }}>{t('analyzer.colSection')}</th>
                                    <th>{t('missing.colKey')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {removedVanillaKeys.map((item, idx) => (
                                    <tr key={idx}>
                                        <td className="panel-hole-inner" style={{ fontFamily: 'Consolas, monospace', color: '#ffa200' }}>
                                            [{item.section}]
                                        </td>
                                        <td className="panel-hole-inner" style={{ fontFamily: 'Consolas, monospace' }}>
                                            {item.key}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Unused keys */}
            {unusedKeysList.length > 0 && (
                <div className="panel">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <h3 style={{ margin: 0, color: '#ffe6c0' }}>{t('analyzer.unusedKeysTitle')}</h3>
                        <span className="badge badge-error">{unusedKeysList.length}</span>
                    </div>
                    <div className="table-container panel-inset" style={{ maxHeight: '320px', overflowY: 'auto', padding: '4px' }}>
                        <table className="panel-hole">
                            <thead>
                                <tr>
                                    <th style={{ width: '35%' }}>{t('analyzer.colSection')}</th>
                                    <th>{t('missing.colKey')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {unusedKeysList.map((item, idx) => (
                                    <tr key={idx}>
                                        <td className="panel-hole-inner" style={{ fontFamily: 'Consolas, monospace', color: '#ffa200' }}>
                                            [{item.section}]
                                        </td>
                                        <td className="panel-hole-inner" style={{ fontFamily: 'Consolas, monospace' }}>
                                            {item.key}
                                        </td>
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
