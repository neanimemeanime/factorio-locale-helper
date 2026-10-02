import React, { useState, useCallback, useRef } from 'react';
import { analyzeModCore } from '../../analyzer.js';

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
            setError('Пожалуйста, выберите архив .zip с модом.');
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
            setError(`Ошибка при анализе архива: ${(e as Error).message}`);
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
            setError(`Ошибка при анализе папки: ${(e as Error).message}`);
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
            setError(`Сканирование пути не удалось: ${(e as Error).message}`);
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
                setSaveStatus(`Успешно сохранено: ${data.filePath}`);
            } else {
                setSaveStatus(`Ошибка сохранения: ${data.error}`);
            }
        } catch (e) {
            setSaveStatus(`Ошибка сохранения: ${(e as Error).message}`);
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

    const copyToClipboard = (content: string) => {
        navigator.clipboard.writeText(content);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Options */}
            <div className="panel" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <label className="checkbox-label" style={{ margin: 0 }}>
                        <input
                            type="checkbox"
                            checked={removeUnusedKeys}
                            onChange={(e) => setRemoveUnusedKeys(e.target.checked)}
                        />
                        <span className="checkbox"></span>
                        <div>Удалять неиспользуемые ключи из чистого .cfg (Внимание: может удалить динамические ключи)</div>
                    </label>
                </div>

                {isConnected && (
                    <div style={{ borderTop: '1px solid #444', paddingTop: '0.75rem', marginTop: '0.75rem' }}>
                        <h4 style={{ color: '#ffa200', marginBottom: '0.5rem' }}>Прямой анализ локальной папки и автосохранение</h4>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <input
                                type="text"
                                placeholder={`Например: ${defaultModsDir}\\my-mod`}
                                value={localModPath}
                                onChange={(e) => setLocalModPath(e.target.value)}
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
                                {isAnalyzing ? 'Сканирование...' : 'Сканировать папку'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Drop Zone */}
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
                    onChange={(e) => e.target.files?.[0] && analyzeZipFile(e.target.files[0])}
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
                <h2>Перетащите .zip файл мода сюда</h2>
                <p style={{ margin: '0.5rem 0' }}>или выберите источник вручную</p>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '0.75rem' }}>
                    <button className="button" onClick={() => fileInputRef.current?.click()}>
                        Выбрать .zip файл
                    </button>
                    <button className="button" onClick={() => folderInputRef.current?.click()}>
                        Выбрать распакованную папку
                    </button>
                </div>
            </div>

            {/* Status alerts */}
            {isAnalyzing && (
                <div className="status-container">
                    <div className="loader"></div>
                </div>
            )}

            {error && <div className="panel alert alert-error">{error}</div>}

            {saveStatus && (
                <div className={`panel alert ${saveStatus.startsWith('Ошибка') ? 'alert-error' : 'alert-success'}`} style={{ textAlign: 'center', padding: '0.75rem' }}>
                    {saveStatus}
                </div>
            )}

            {/* Results Grid */}
            {generatedCfg && (
                <div className="results-container">
                    <div className="column panel">
                        <div className="column-header">
                            <h3>Исходный .cfg мода</h3>
                            <div className="actions">
                                <button className="button" onClick={() => copyToClipboard(generatedCfg)}>Копировать</button>
                                <button className="button-green" onClick={() => downloadFile(generatedCfg, `${modName}.source.cfg`)}>Скачать</button>
                            </div>
                        </div>
                        <textarea className="panel-inset" value={generatedCfg} readOnly></textarea>
                    </div>
                    <div className="column panel">
                        <div className="column-header">
                            <h3>Очищенный .cfg (Только мод)</h3>
                            <div className="actions">
                                <button className="button" onClick={() => copyToClipboard(cleanedCfg)}>Копировать</button>
                                <button className="button-green" onClick={() => downloadFile(cleanedCfg, `${modName}.cfg`)}>Скачать</button>
                                {isConnected && localModPath && (
                                    <button
                                        className="button-orange"
                                        onClick={handleLocalSave}
                                        disabled={isSaving}
                                    >
                                        {isSaving ? 'Сохранение...' : 'Сохранить в папку'}
                                    </button>
                                )}
                            </div>
                        </div>
                        <textarea className="panel-inset" value={cleanedCfg} readOnly></textarea>
                        <div className="log-container panel-inset">
                            <h4>Журнал анализа (Удаленные ванильные ключи)</h4>
                            <p>{analysisLog}</p>
                        </div>
                        <div className="log-actions">
                            <button className="button" onClick={() => downloadFile(removedKeysCfg, `${modName}.vanilla_keys.cfg`)}>
                                Скачать удаленные ванильные ключи
                            </button>
                            {unusedKeysCfg && unusedKeysCfg.length > 150 && (
                                <button className="button-red" onClick={() => downloadFile(unusedKeysCfg, `${modName}.unused_keys.cfg`)}>
                                    Скачать неиспользуемые ключи
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Hardcoded strings */}
            {hardcodedIssues.length > 0 && (
                <div className="panel" style={{ marginTop: '1rem' }}>
                    <h3>Захардкоженные и нелокализуемые строки ({hardcodedIssues.length})</h3>
                    <p style={{ marginBottom: '1rem', color: '#ccc' }}>
                        Эти строки найдены в Lua-скриптах и могут требовать добавления в локализацию.
                    </p>
                    <div className="table-container panel-inset" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr>
                                    <th style={{ borderBottom: '1px solid #555', padding: '8px' }}>Файл</th>
                                    <th style={{ borderBottom: '1px solid #555', padding: '8px' }}>Строка</th>
                                    <th style={{ borderBottom: '1px solid #555', padding: '8px' }}>Тип</th>
                                    <th style={{ borderBottom: '1px solid #555', padding: '8px' }}>Код</th>
                                    <th style={{ borderBottom: '1px solid #555', padding: '8px' }}>Описание</th>
                                </tr>
                            </thead>
                            <tbody>
                                {hardcodedIssues.map((issue, idx) => (
                                    <tr key={idx}>
                                        <td style={{ borderBottom: '1px solid #444', padding: '8px', whiteSpace: 'nowrap' }}>{issue.file}</td>
                                        <td style={{ borderBottom: '1px solid #444', padding: '8px' }}>{issue.line}</td>
                                        <td style={{ borderBottom: '1px solid #444', padding: '8px' }}>
                                            <span style={{ color: issue.type === 'untranslatable' ? '#eb5c5f' : '#ffa200' }}>
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
                </div>
            )}

            {/* Removed vanilla keys */}
            {removedVanillaKeys.length > 0 && (
                <div className="panel" style={{ marginTop: '1rem' }}>
                    <h3>Найденные ванильные ключи ({removedVanillaKeys.length})</h3>
                    <div className="table-container panel-inset" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr>
                                    <th style={{ borderBottom: '1px solid #555', padding: '8px' }}>Секция</th>
                                    <th style={{ borderBottom: '1px solid #555', padding: '8px' }}>Ключ</th>
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

            {/* Unused keys */}
            {unusedKeysList.length > 0 && (
                <div className="panel" style={{ marginTop: '1rem' }}>
                    <h3>Неиспользуемые ключи ({unusedKeysList.length})</h3>
                    <div className="table-container panel-inset" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr>
                                    <th style={{ borderBottom: '1px solid #555', padding: '8px' }}>Секция</th>
                                    <th style={{ borderBottom: '1px solid #555', padding: '8px' }}>Ключ</th>
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
