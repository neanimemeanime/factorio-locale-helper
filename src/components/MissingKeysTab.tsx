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
            setError('Local API server is disconnected. Run npm run server in your project console.');
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
                    setActionStatus(`Scan completed. Merged changes into ${data.result.updatedFiles.length} file(s).`);
                }
            } else {
                setError(data.error || 'Error scanning for missing keys.');
            }
        } catch (err) {
            setError(`Server connection error: ${(err as Error).message}`);
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
                setActionStatus(`Keys for mod ${modName} successfully written to ${targetMod}/locale/${selectedLang}/${modName}.cfg`);
                handleScan();
            } else {
                setError(`Failed to apply keys: ${data.error}`);
            }
        } catch (err) {
            setError(`Error: ${(err as Error).message}`);
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

    const copyText = (content: string, message: string = 'Copied to clipboard') => {
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
                <h3 style={{ margin: '0 0 1rem 0', color: '#ffe6c0' }}>Missing Keys Scanner Options</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.4rem', color: '#ffe6c0' }}>
                            Factorio Mods Directory:
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
                            Target Localization Mod:
                        </label>
                        <input
                            type="text"
                            className="factorio-input"
                            value={targetMod}
                            onChange={(e) => setTargetMod(e.target.value)}
                            placeholder="locale-mod"
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.4rem', color: '#ffe6c0' }}>
                            Filter Specific Mod (optional):
                        </label>
                        <input
                            type="text"
                            className="factorio-input"
                            value={modFilter}
                            onChange={(e) => setModFilter(e.target.value)}
                            placeholder="All active mods"
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
                            Automatically append missing keys into target mod files
                        </div>
                    </label>

                    <div className="button-group">
                        <button className="button" onClick={handleResetPaths}>
                            Reset Paths
                        </button>
                        <button className="button-orange" onClick={handleScan} disabled={isLoading || !isConnected}>
                            {isLoading ? 'Scanning...' : 'Scan Active Mods'}
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
                    Local API server is not running. To scan active mods and inspect files, run in console: <code>npm run server</code>
                </div>
            )}

            {/* Results KPI Summary */}
            {result && (
                <div className="panel" style={{ padding: '0.85rem' }}>
                    <div className="kpi-grid">
                        <div className="panel-hole-inner kpi-card">
                            <div className="kpi-title">Active Mods</div>
                            <div className="kpi-value" style={{ color: '#ffe6c0' }}>
                                {result.summary.totalActiveMods}
                            </div>
                        </div>
                        <div className="panel-hole-inner kpi-card">
                            <div className="kpi-title">Mods With Missing Keys</div>
                            <div className="kpi-value" style={{ color: result.summary.modsWithMissingKeys > 0 ? '#ffa200' : '#2ecc71' }}>
                                {result.summary.modsWithMissingKeys}
                            </div>
                        </div>
                        <div className="panel-hole-inner kpi-card">
                            <div className="kpi-title">Total Missing Keys</div>
                            <div className="kpi-value" style={{ color: result.summary.totalMissingKeys > 0 ? '#eb5c5f' : '#2ecc71' }}>
                                {result.summary.totalMissingKeys}
                            </div>
                        </div>
                        <div className="panel-hole-inner kpi-card">
                            <div className="kpi-title">Files Updated</div>
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
                            <h4 style={{ margin: 0, color: '#ffe6c0' }}>Mod List</h4>
                            <span className="badge badge-warning">{scannedMods.length}</span>
                        </div>
                        <input
                            type="text"
                            placeholder="Filter by name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="factorio-input"
                            style={{ marginBottom: '0.75rem' }}
                        />

                        <div className="panel-inset" style={{ flexGrow: 1, overflowY: 'auto', maxHeight: '520px', padding: '4px' }}>
                            {filteredMods.length === 0 ? (
                                <div style={{ color: '#888888', padding: '1.5rem', textAlign: 'center' }}>
                                    No mods found
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
                                                        <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>In Pack</span>
                                                    ) : (
                                                        <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>New File</span>
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
                                            <span>Archive:</span>
                                            <span className="status-chip">{activeModData.matchedFile}</span>
                                            <span>|</span>
                                            <span>Status: {activeModData.ruFileExists ? 'Exists in localization pack' : 'File not created yet'}</span>
                                        </div>
                                    </div>
                                    <div className="button-group">
                                        <button className="button button-sm" onClick={() => copyText(activeModCfgText)}>
                                            Copy .cfg
                                        </button>
                                        <button className="button-green button-sm" onClick={() => downloadFile(activeModCfgText, `${selectedModName}.cfg`)}>
                                            Download .cfg
                                        </button>
                                        {isConnected && (
                                            <button
                                                className="button-orange button-sm"
                                                onClick={() => handleApplyMod(selectedModName)}
                                                disabled={isApplyingMod}
                                            >
                                                {isApplyingMod ? 'Writing...' : `Merge into ${targetMod}`}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                    <div style={{ color: '#ffa200', fontWeight: 'bold', fontSize: '1rem' }}>
                                        Missing Keys ({activeModData.missingCount})
                                    </div>
                                    <div className="button-group">
                                        <button
                                            className={viewMode === 'structured' ? 'button-orange button-sm' : 'button button-sm'}
                                            onClick={() => setViewMode('structured')}
                                        >
                                            Table
                                        </button>
                                        <button
                                            className={viewMode === 'raw' ? 'button-orange button-sm' : 'button button-sm'}
                                            onClick={() => setViewMode('raw')}
                                        >
                                            Raw .cfg
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
                                                            <th style={{ width: '30%' }}>Key</th>
                                                            <th style={{ width: '55%' }}>Original Text (EN)</th>
                                                            <th style={{ width: '15%', textAlign: 'center' }}>Actions</th>
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
                                                                            onClick={() => copyText(key, `Key ${key} copied`)}
                                                                            title="Copy key name"
                                                                        >
                                                                            Key
                                                                        </button>
                                                                        <button
                                                                            className="button button-sm"
                                                                            onClick={() => copyText(`${key}=${val}`, `String ${key} copied`)}
                                                                            title="Copy string (key=value)"
                                                                        >
                                                                            String
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
                                Select a mod from the list on the left to view missing keys
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Empty state when scanned but no missing keys found */}
            {result && scannedMods.length === 0 && (
                <div className="panel" style={{ textAlign: 'center', padding: '3rem' }}>
                    <h3 style={{ color: '#2ecc71', margin: '0 0 0.5rem 0' }}>All active mods are fully localized</h3>
                    <p style={{ color: '#aaaaaa', margin: 0 }}>
                        Checked {result.summary.totalActiveMods} active mod(s). No missing keys detected.
                    </p>
                </div>
            )}
        </div>
    );
};
