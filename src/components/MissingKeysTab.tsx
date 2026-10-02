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

    const copyText = (content: string, message: string = 'Скопировано в буфер обмена') => {
        navigator.clipboard.writeText(content);
        setActionStatus(message);
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
            <div className="panel tab-content-panel" style={{ padding: '1.25rem' }}>
                <h3 style={{ margin: '0 0 1rem 0', color: '#ffe6c0' }}>Параметры поиска недостающих ключей</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.4rem', color: '#ffe6c0' }}>
                            Папка модов Factorio:
                        </label>
                        <input
                            type="text"
                            className="factorio-input"
                            value={modsDir}
                            onChange={(e) => setModsDir(e.target.value)}
                            placeholder="C:\Users\...\AppData\Roaming\Factorio\mods"
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.4rem', color: '#ffe6c0' }}>
                            Целевой мод локализации:
                        </label>
                        <input
                            type="text"
                            className="factorio-input"
                            value={targetMod}
                            onChange={(e) => setTargetMod(e.target.value)}
                            placeholder="my-texture-pack"
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.4rem', color: '#ffe6c0' }}>
                            Фильтр по конкретному моду (опционально):
                        </label>
                        <input
                            type="text"
                            className="factorio-input"
                            value={modFilter}
                            onChange={(e) => setModFilter(e.target.value)}
                            placeholder="Все активные моды"
                        />
                    </div>
                </div>

                <div style={{ marginTop: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                    <label className="checkbox-label" style={{ margin: 0 }}>
                        <input
                            type="checkbox"
                            checked={writeToTarget}
                            onChange={(e) => setWriteToTarget(e.target.checked)}
                        />
                        <span className="checkbox"></span>
                        <div style={{ color: '#e0e0e0', fontSize: '0.95rem' }}>
                            Автоматически вносить недостающие ключи в файлы целевого мода
                        </div>
                    </label>

                    <div className="button-group">
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
                <div className="panel" style={{ padding: '0.85rem' }}>
                    <div className="kpi-grid">
                        <div className="panel-hole-inner kpi-card">
                            <div className="kpi-title">Активных модов</div>
                            <div className="kpi-value" style={{ color: '#ffe6c0' }}>
                                {result.summary.totalActiveMods}
                            </div>
                        </div>
                        <div className="panel-hole-inner kpi-card">
                            <div className="kpi-title">Модов с нехваткой</div>
                            <div className="kpi-value" style={{ color: result.summary.modsWithMissingKeys > 0 ? '#ffa200' : '#2ecc71' }}>
                                {result.summary.modsWithMissingKeys}
                            </div>
                        </div>
                        <div className="panel-hole-inner kpi-card">
                            <div className="kpi-title">Всего недостающих строк</div>
                            <div className="kpi-value" style={{ color: result.summary.totalMissingKeys > 0 ? '#eb5c5f' : '#2ecc71' }}>
                                {result.summary.totalMissingKeys}
                            </div>
                        </div>
                        <div className="panel-hole-inner kpi-card">
                            <div className="kpi-title">Обновлено файлов</div>
                            <div className="kpi-value" style={{ color: '#7dcaed' }}>
                                {result.summary.updatedFilesCount}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Master-Detail Explorer */}
            {result && scannedMods.length > 0 && (
                <div className="master-detail-container">
                    {/* Left: Mod list */}
                    <div className="panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <h4 style={{ margin: 0, color: '#ffe6c0' }}>Список модов</h4>
                            <span className="badge badge-warning">{scannedMods.length}</span>
                        </div>
                        <input
                            type="text"
                            placeholder="Фильтр по названию..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="factorio-input"
                            style={{ marginBottom: '0.75rem' }}
                        />

                        <div className="panel-inset" style={{ flexGrow: 1, overflowY: 'auto', maxHeight: '520px', padding: '4px' }}>
                            {filteredMods.length === 0 ? (
                                <div style={{ color: '#888888', padding: '1.5rem', textAlign: 'center' }}>
                                    Моды не найдены
                                </div>
                            ) : (
                                filteredMods.map(([name, modData]) => {
                                    const isSelected = selectedModName === name;
                                    return (
                                        <div
                                            key={name}
                                            tabIndex={0}
                                            role="button"
                                            aria-pressed={isSelected}
                                            onClick={() => setSelectedModName(name)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    setSelectedModName(name);
                                                }
                                            }}
                                            className={`mod-list-item ${isSelected ? 'selected' : ''}`}
                                        >
                                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '8px' }}>
                                                <div style={{ fontWeight: isSelected ? 700 : 600, color: isSelected ? '#ffe6c0' : '#ffffff', fontSize: '0.95rem' }}>
                                                    {name}
                                                </div>
                                                <div style={{ marginTop: '2px' }}>
                                                    {modData.ruFileExists ? (
                                                        <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>В паке</span>
                                                    ) : (
                                                        <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>Новый файл</span>
                                                    )}
                                                </div>
                                            </div>
                                            <span className="badge badge-warning" style={{ fontWeight: 'bold' }}>
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
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem', borderBottom: '1px solid #444444', paddingBottom: '0.75rem' }}>
                                    <div>
                                        <h3 style={{ margin: 0, color: '#ffe6c0', fontSize: '1.3rem' }}>{selectedModName}</h3>
                                        <div style={{ color: '#888888', fontSize: '0.85rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            <span>Архив:</span>
                                            <span className="status-chip">{activeModData.matchedFile}</span>
                                            <span>|</span>
                                            <span>Статус: {activeModData.ruFileExists ? 'Существует в паке перевода' : 'Файл ещё не создан'}</span>
                                        </div>
                                    </div>
                                    <div className="button-group">
                                        <button className="button button-sm" onClick={() => copyText(activeModCfgText)}>
                                            Скопировать .cfg
                                        </button>
                                        <button className="button-green button-sm" onClick={() => downloadFile(activeModCfgText, `${selectedModName}.cfg`)}>
                                            Скачать .cfg
                                        </button>
                                        {isConnected && (
                                            <button
                                                className="button-orange button-sm"
                                                onClick={() => handleApplyMod(selectedModName)}
                                                disabled={isApplyingMod}
                                            >
                                                {isApplyingMod ? 'Запись...' : `Внести в ${targetMod}`}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                    <div style={{ color: '#ffa200', fontWeight: 'bold', fontSize: '1rem' }}>
                                        Отсутствующие ключи ({activeModData.missingCount})
                                    </div>
                                    <div className="button-group">
                                        <button
                                            className={viewMode === 'structured' ? 'button-orange button-sm' : 'button button-sm'}
                                            onClick={() => setViewMode('structured')}
                                        >
                                            Таблица
                                        </button>
                                        <button
                                            className={viewMode === 'raw' ? 'button-orange button-sm' : 'button button-sm'}
                                            onClick={() => setViewMode('raw')}
                                        >
                                            Текст .cfg
                                        </button>
                                    </div>
                                </div>

                                {viewMode === 'structured' ? (
                                    <div className="panel-inset" style={{ flexGrow: 1, overflowY: 'auto', maxHeight: '460px', padding: '0.75rem' }}>
                                        {Object.entries(activeModData.sections).map(([sectionName, keys]) => (
                                            <div key={sectionName} style={{ marginBottom: '1.25rem' }}>
                                                <div className="section-header-bar">
                                                    <span>[{sectionName}]</span>
                                                    <span className="badge">{Object.keys(keys).length}</span>
                                                </div>
                                                <table className="panel-hole">
                                                    <thead>
                                                        <tr>
                                                            <th style={{ width: '30%' }}>Ключ</th>
                                                            <th style={{ width: '55%' }}>Оригинальный текст (EN)</th>
                                                            <th style={{ width: '15%', textAlign: 'center' }}>Действия</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {Object.entries(keys).map(([key, val]) => (
                                                            <tr key={key}>
                                                                <td className="panel-hole-inner" style={{ fontFamily: 'Consolas, monospace', color: '#ffa200', wordBreak: 'break-all' }}>
                                                                    {key}
                                                                </td>
                                                                <td className="panel-hole-inner" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                                                    {val}
                                                                </td>
                                                                <td className="panel-hole-inner" style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                                                    <div className="button-group" style={{ justifyContent: 'center' }}>
                                                                        <button
                                                                            className="button button-sm"
                                                                            onClick={() => copyText(key, `Ключ ${key} скопирован`)}
                                                                            title="Скопировать имя ключа"
                                                                        >
                                                                            Ключ
                                                                        </button>
                                                                        <button
                                                                            className="button button-sm"
                                                                            onClick={() => copyText(`${key}=${val}`, `Строка ${key} скопирована`)}
                                                                            title="Скопировать строку (ключ=значение)"
                                                                        >
                                                                            Строка
                                                                        </button>
                                                                    </div>
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
                                        className="panel-inset factorio-textarea"
                                        value={activeModCfgText}
                                        readOnly
                                        style={{ flexGrow: 1, minHeight: '440px' }}
                                    />
                                )}
                            </>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: '#888888' }}>
                                Выберите мод из списка слева для просмотра отсутствующих ключей
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Empty state when scanned but no missing keys found */}
            {result && scannedMods.length === 0 && (
                <div className="panel" style={{ textAlign: 'center', padding: '3rem' }}>
                    <h3 style={{ color: '#2ecc71', margin: '0 0 0.5rem 0' }}>Все активные моды полностью переведены</h3>
                    <p style={{ color: '#aaaaaa', margin: 0 }}>
                        Проверено {result.summary.totalActiveMods} активных модов. Отсутствующих ключей не обнаружено.
                    </p>
                </div>
            )}
        </div>
    );
};
