import React from 'react';

interface ServerStatusBarProps {
    isConnected: boolean;
    defaultModsDir: string;
    defaultTargetMod: string;
    selectedLang: string;
    onChangeLang: (lang: string) => void;
}

export const ServerStatusBar: React.FC<ServerStatusBarProps> = ({
    isConnected,
    defaultModsDir,
    defaultTargetMod,
    selectedLang,
    onChangeLang
}) => {
    return (
        <div className="panel" style={{ padding: '0.75rem 1.25rem', margin: '0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className={`industrial-led ${isConnected ? 'connected' : 'disconnected'}`} />
                        <strong style={{ color: '#ffe6c0', fontSize: '0.95rem' }}>Локальный API сервер:</strong>
                        <span style={{ color: isConnected ? '#2ecc71' : '#a6a6a6', fontSize: '0.9rem', fontWeight: 600 }}>
                            {isConnected ? 'Подключен (порт 3001)' : 'Отключен (запустите npm run server)'}
                        </span>
                    </div>

                    <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>
                        Factorio 2.1+ (Space Age)
                    </span>

                    {isConnected && defaultModsDir && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.85rem', color: '#a6a6a6' }}>
                            <span>Папка:</span>
                            <span className="status-chip" title={defaultModsDir}>{defaultModsDir}</span>
                            {defaultTargetMod && (
                                <>
                                    <span>Таргет-мод:</span>
                                    <span className="status-chip" title={defaultTargetMod}>{defaultTargetMod}</span>
                                </>
                            )}
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <label htmlFor="global-target-lang" style={{ fontWeight: 'bold', color: '#ffe6c0', fontSize: '0.9rem' }}>
                        Целевой язык:
                    </label>
                    <select
                        id="global-target-lang"
                        value={selectedLang}
                        onChange={(e) => onChangeLang(e.target.value)}
                        className="factorio-select"
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
        </div>
    );
};
