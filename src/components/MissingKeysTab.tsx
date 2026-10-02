import React, { useState } from 'react';

export interface MissingKeysSummary {
    modsDir: string;
    targetMod: string;
    targetLang: string;
    totalActiveMods: number;
    modsWithMissingKeys: number;
    totalMissingKeys: number;
    writeToTarget: boolean;
    updatedFilesCount: number;
    writtenToDir: string | null;
}

export interface MissingModDetail {
    ruFileExists: boolean;
    missingCount: number;
    matchedFile: string;
    sections: Record<string, Record<string, string>>;
}

export interface MissingKeysResult {
    summary: MissingKeysSummary;
    updatedFiles: Array<{
        modName: string;
        path: string;
        keysAdded: number;
        created: boolean;
    }>;
    mods: Record<string, MissingModDetail>;
}

interface MissingKeysTabProps {
    isConnected: boolean;
    defaultModsDir: string;
    defaultTargetMod: string;
    selectedLang: string;
    onUpdateMissingCount?: (count: number) => void;
}

export const MissingKeysTab: React.FC<MissingKeysTabProps> = ({
    isConnected,
    defaultModsDir,
    defaultTargetMod,
    selectedLang,
    onUpdateMissingCount
}) => {
    const [modsDir, setModsDir] = useState(defaultModsDir);
    const [targetMod, setTargetMod] = useState(defaultTargetMod);
    const [modFilter, setModFilter] = useState('');
    const [writeToTarget, setWriteToTarget] = useState(false);

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [actionStatus, setActionStatus] = useState<string | null>(null);
    const [result, setResult] = useState<MissingKeysResult | null>(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedModName, setSelectedModName] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'structured' | 'raw'>('structured');
    const [isApplyingMod, setIsApplyingMod] = useState(false);

    // Sync defaults when they arrive from server
    React.useEffect(() => {
        if (!modsDir && defaultModsDir) setModsDir(defaultModsDir);
        if (!targetMod && defaultTargetMod) setTargetMod(defaultTargetMod);
    }, [defaultModsDir, defaultTargetMod]);

    const handleResetPaths = () => {
        setModsDir(defaultModsDir);
        setTargetMod(defaultTargetMod);
        setModFilter('');
    };

    const handleScan = async () => {
        if (!isConnected) {
            setError('Локальный сервер API отключен. Запустите npm run server в консоли проекта.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setActionStatus(null);

        try {
            const response = await fetch('/api/scan-missing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    modsDir: modsDir || defaultModsDir,
                    targetMod: targetMod || defaultTargetMod,
                    lang: selectedLang,
                    modFilter: modFilter.trim() || undefined,
                    writeToTarget
                })
            });

            const data = await response.json();
            if (data.success) {
                setResult(data.result);
                if (onUpdateMissingCount) {
                    onUpdateMissingCount(data.result.summary.totalMissingKeys);
                }
                const modNames = Object.keys(data.result.mods || {});
                if (modNames.length > 0) {
                    setSelectedModName(modNames[0]);
                } else {
                    setSelectedModName(null);
                }
                if (writeToTarget) {
                    setActionStatus(`Сканирование завершено. Изменения внесены в ${data.result.updatedFiles.length} файлов.`);
                }
            } else {
                setError(data.error || 'Ошибка при сканировании недостающих ключей.');
            }
        } catch (err) {
            setError(`Ошибка соединения с сервером: ${(err as Error).message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleApplyMod = async (modName: string) => {
        if (!isConnected) return;
        setIsApplyingMod(true);
        setActionStatus(null);
        try {
            const response = await fetch('/api/apply-missing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    modName,
                    modsDir: modsDir || defaultModsDir,
                    targetMod: targetMod || defaultTargetMod,
                    lang: selectedLang
                })
            });
            const data = await response.json();
            if (data.success) {
                setActionStatus(`Ключи для мода ${modName} успешно записаны в ${targetMod}/locale/${selectedLang}/${modName}.cfg`);
                // Rescan to update state
                handleScan();
            } else {
                setError(`Не удалось применить ключи: ${data.error}`);
            }
        } catch (err) {
            setError(`Ошибка: ${(err as Error).message}`);
        } finally {
            setIsApplyingMod(false);
        }
    };

    const formatSectionsAsCfg = (sections: Record<string, Record<string, string>>) => {
        let text = '';
        for (const [sec, keys] of Object.entries(sections)) {
            text += `[${sec}]\n`;
            for (const [k, v] of Object.entries(keys)) {
                text += `${k}=${v}\n`;
            }
            text += '\n';
        }
        return text.trim();
    };

    const copyText = (content: string) => {
        navigator.clipboard.writeText(content);
        setActionStatus('Скопировано в буфер обмена');
        setTimeout(() => setActionStatus(null), 3000);
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

    const scannedMods = result ? Object.entries(result.mods) : [];
    const filteredMods = scannedMods.filter(([name]) =>
        name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const activeModData = selectedModName && result?.mods ? result.mods[selectedModName] : null;
    const activeModCfgText = activeModData ? formatSectionsAsCfg(activeModData.sections) : '';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Parameters Panel */}
            <div className="panel" style={{ padding: '1.25rem' }}>
                <h3 style={{ marginBottom: '1rem' }}>Параметры поиска недостающих ключей</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.4rem' }}>
                            Папка модов Factorio:
                        </label>
                        <input
                            type="text"
                            value={modsDir}
                            onChange={(e) => setModsDir(e.target.value)}
                            placeholder="C:\Users\...\AppData\Roaming\Factorio\mods"
                            style={{
                                width: '100%',
                                padding: '8px 10px',
                                backgroundColor: '#140f0a',
                                border: '1px solid #555',
                                borderRadius: '4px',
                                color: '#fff',
                                fontFamily: 'monospace'
                            }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.4rem' }}>
                            Целевой мод локализации:
                        </label>
                        <input
                            type="text"
                            value={targetMod}
                            onChange={(e) => setTargetMod(e.target.value)}
                            placeholder="my-texture-pack"
                            style={{
                                width: '100%',
                                padding: '8px 10px',
                                backgroundColor: '#140f0a',
                                border: '1px solid #555',
                                borderRadius: '4px',
                                color: '#fff',
                                fontFamily: 'monospace'
                            }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.4rem' }}>
                            Фильтр по конкретному моду (опционально):
                        </label>
                        <input
                            type="text"
                            value={modFilter}
                            onChange={(e) => setModFilter(e.target.value)}
                            placeholder="Все активные моды"
                            style={{
                                width: '100%',
                                padding: '8px 10px',
                                backgroundColor: '#140f0a',
                                border: '1px solid #555',
                                borderRadius: '4px',
                                color: '#fff',
                                fontFamily: 'monospace'
                            }}
                        />
                    </div>
                </div>

                <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                    <label className="checkbox-label" style={{ margin: '0' }}>
                        <input
                            type="checkbox"
                            checked={writeToTarget}
                            onChange={(e) => setWriteToTarget(e.target.checked)}
                        />
                        <span className="checkbox"></span>
                        <div>Автоматически вносить недостающие ключи в файлы целевого мода</div>
                    </label>

                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button className="button" onClick={handleResetPaths}>
                            Сбросить пути
                        </button>
                        <button className="button-orange" onClick={handleScan} disabled={isLoading || !isConnected}>
                            {isLoading ? 'Сканирование...' : 'Сканировать активные моды'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Status alerts */}
            {isLoading && (
                <div className="status-container">
                    <div className="loader"></div>
                </div>
            )}

            {error && (
                <div className="panel alert alert-error" style={{ textAlign: 'center' }}>
                    {error}
                </div>
            )}

            {actionStatus && (
                <div className="panel alert alert-success" style={{ textAlign: 'center' }}>
                    {actionStatus}
                </div>
            )}

            {!isConnected && (
                <div className="panel alert alert-warning" style={{ textAlign: 'center' }}>
                    Локальный сервер API не запущен. Для сканирования активных модов и считывания файлов запустите в терминале: <code>npm run server</code>
                </div>
            )}

            {/* Results KPI Summary */}
            {result && (
                <div className="panel" style={{ padding: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', textAlign: 'center' }}>
                        <div className="panel-hole-inner" style={{ padding: '0.75rem' }}>
                            <div style={{ color: '#aaa', fontSize: '0.9rem' }}>Активных модов</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#ffe6c0' }}>{result.summary.totalActiveMods}</div>
                        </div>
                        <div className="panel-hole-inner" style={{ padding: '0.75rem' }}>
                            <div style={{ color: '#aaa', fontSize: '0.9rem' }}>Модов с нехваткой</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: result.summary.modsWithMissingKeys > 0 ? '#ffa200' : '#2ecc71' }}>
                                {result.summary.modsWithMissingKeys}
                            </div>
                        </div>
                        <div className="panel-hole-inner" style={{ padding: '0.75rem' }}>
                            <div style={{ color: '#aaa', fontSize: '0.9rem' }}>Всего недостающих строк</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: result.summary.totalMissingKeys > 0 ? '#e74c3c' : '#2ecc71' }}>
                                {result.summary.totalMissingKeys}
                            </div>
                        </div>
                        <div className="panel-hole-inner" style={{ padding: '0.75rem' }}>
                            <div style={{ color: '#aaa', fontSize: '0.9rem' }}>Обновлено файлов</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#7dcaed' }}>{result.summary.updatedFilesCount}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Master-Detail Explorer */}
            {result && scannedMods.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1rem', minHeight: '550px' }}>
                    {/* Left: Mod list */}
                    <div className="panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column' }}>
                        <h4 style={{ marginBottom: '0.5rem' }}>Список модов ({scannedMods.length})</h4>
                        <input
                            type="text"
                            placeholder="Фильтр по названию..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '6px 10px',
                                marginBottom: '0.75rem',
                                backgroundColor: '#140f0a',
                                border: '1px solid #555',
                                borderRadius: '4px',
                                color: '#fff',
                                fontFamily: 'monospace'
                            }}
                        />

                        <div className="panel-inset" style={{ flexGrow: 1, overflowY: 'auto', maxHeight: '550px', padding: '4px' }}>
                            {filteredMods.length === 0 ? (
                                <div style={{ color: '#888', padding: '1rem', textAlign: 'center' }}>Моды не найдены</div>
                            ) : (
                                filteredMods.map(([name, modData]) => {
                                    const isSelected = selectedModName === name;
                                    return (
                                        <div
                                            key={name}
                                            onClick={() => setSelectedModName(name)}
                                            style={{
                                                padding: '8px 10px',
                                                marginBottom: '4px',
                                                cursor: 'pointer',
                                                backgroundColor: isSelected ? '#414040' : '#2a282a',
                                                borderLeft: isSelected ? '3px solid #ffa200' : '3px solid transparent',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                transition: 'background-color 0.15s'
                                            }}
                                        >
                                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '8px' }}>
                                                <div style={{ fontWeight: isSelected ? 'bold' : 'normal', color: isSelected ? '#ffe6c0' : '#fff' }}>
                                                    {name}
                                                </div>
                                                <div style={{ fontSize: '0.8rem', color: '#888' }}>
                                                    {modData.ruFileExists ? 'Есть в паке' : 'Новый файл'}
                                                </div>
                                            </div>
                                            <span className="badge" style={{ backgroundColor: '#e39827', color: '#000', fontWeight: 'bold' }}>
                                                +{modData.missingCount}
                                            </span>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Right: Mod Detail & Diff */}
                    <div className="panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column' }}>
                        {activeModData && selectedModName ? (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem', borderBottom: '1px solid #444', paddingBottom: '0.75rem' }}>
                                    <div>
                                        <h3 style={{ margin: 0, color: '#ffe6c0' }}>{selectedModName}</h3>
                                        <div style={{ color: '#888', fontSize: '0.85rem', marginTop: '2px' }}>
                                            Архив: <code>{activeModData.matchedFile}</code> | Статус: {activeModData.ruFileExists ? 'Существует в паке перевода' : 'Файл ещё не создан'}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        <button className="button" onClick={() => copyText(activeModCfgText)}>
                                            Скопировать .cfg
                                        </button>
                                        <button className="button-green" onClick={() => downloadFile(activeModCfgText, `${selectedModName}.cfg`)}>
                                            Скачать .cfg
                                        </button>
                                        {isConnected && (
                                            <button
                                                className="button-orange"
                                                onClick={() => handleApplyMod(selectedModName)}
                                                disabled={isApplyingMod}
                                            >
                                                {isApplyingMod ? 'Запись...' : 'Внести в my-texture-pack'}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                    <div style={{ color: '#ffa200', fontWeight: 'bold' }}>
                                        Отсутствующие ключи ({activeModData.missingCount})
                                    </div>
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        <button
                                            className={viewMode === 'structured' ? 'button-orange' : 'button'}
                                            onClick={() => setViewMode('structured')}
                                            style={{ padding: '4px 10px', height: '28px', minWidth: 'auto', fontSize: '0.85rem' }}
                                        >
                                            Таблица
                                        </button>
                                        <button
                                            className={viewMode === 'raw' ? 'button-orange' : 'button'}
                                            onClick={() => setViewMode('raw')}
                                            style={{ padding: '4px 10px', height: '28px', minWidth: 'auto', fontSize: '0.85rem' }}
                                        >
                                            Текст .cfg
                                        </button>
                                    </div>
                                </div>

                                {viewMode === 'structured' ? (
                                    <div className="panel-inset" style={{ flexGrow: 1, overflowY: 'auto', maxHeight: '480px', padding: '0.75rem' }}>
                                        {Object.entries(activeModData.sections).map(([sectionName, keys]) => (
                                            <div key={sectionName} style={{ marginBottom: '1.25rem' }}>
                                                <h4 style={{ color: '#ffe6c0', margin: '0 0 0.4rem 0', fontFamily: 'monospace' }}>
                                                    [{sectionName}]
                                                </h4>
                                                <table className="panel-hole" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                                                    <thead>
                                                        <tr>
                                                            <th style={{ width: '35%', padding: '6px 8px', color: '#ffa200' }}>Ключ</th>
                                                            <th style={{ padding: '6px 8px', color: '#ffa200' }}>Оригинальный текст (EN)</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {Object.entries(keys).map(([key, val]) => (
                                                            <tr key={key}>
                                                                <td className="panel-hole-inner" style={{ padding: '6px 8px', fontFamily: 'monospace', verticalAlign: 'top' }}>
                                                                    <code>{key}</code>
                                                                </td>
                                                                <td className="panel-hole-inner" style={{ padding: '6px 8px', whiteSpace: 'pre-wrap', verticalAlign: 'top' }}>
                                                                    {val}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <textarea
                                        className="panel-inset"
                                        value={activeModCfgText}
                                        readOnly
                                        style={{ flexGrow: 1, minHeight: '400px' }}
                                    />
                                )}
                            </>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>
                                Выберите мод из списка слева для просмотра отсутствующих ключей
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Empty state when scanned but no missing keys found */}
            {result && scannedMods.length === 0 && (
                <div className="panel" style={{ textAlign: 'center', padding: '3rem' }}>
                    <h3 style={{ color: '#2ecc71', marginBottom: '0.5rem' }}>Все активные моды полностью переведены</h3>
                    <p style={{ color: '#aaa' }}>
                        Проверено {result.summary.totalActiveMods} активных модов. Отсутствующих ключей не обнаружено.
                    </p>
                </div>
            )}
        </div>
    );
};
