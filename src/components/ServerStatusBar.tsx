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
        <div className="panel" style={{ padding: '1rem', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span
                            style={{
                                display: 'inline-block',
                                width: '10px',
                                height: '10px',
                                borderRadius: '50%',
                                backgroundColor: isConnected ? '#2ecc71' : '#e74c3c',
                                boxShadow: isConnected ? '0 0 6px #2ecc71' : '0 0 6px #e74c3c'
                            }}
                        />
                        <strong>Локальный сервер API:</strong>
                        <span style={{ color: isConnected ? '#2ecc71' : '#aaa' }}>
                            {isConnected ? 'Подключен (порт 3001)' : 'Отключен (запустите npm run server)'}
                        </span>
                    </div>

                    {isConnected && defaultModsDir && (
                        <div style={{ color: '#888', fontSize: '0.9rem', marginLeft: '0.5rem' }}>
                            <span>Папка Factorio: </span>
                            <code style={{ fontSize: '0.85rem' }}>{defaultModsDir}</code>
                            {defaultTargetMod && (
                                <>
                                    <span style={{ marginLeft: '0.75rem' }}>Таргет-мод: </span>
                                    <code style={{ fontSize: '0.85rem' }}>{defaultTargetMod}</code>
                                </>
                            )}
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label htmlFor="global-target-lang" style={{ fontWeight: 'bold' }}>
                        Целевой язык:
                    </label>
                    <select
                        id="global-target-lang"
                        value={selectedLang}
                        onChange={(e) => onChangeLang(e.target.value)}
                        style={{
                            backgroundColor: '#140f0a',
                            color: '#ffa200',
                            border: '1px solid #e39827',
                            padding: '4px 10px',
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
        </div>
    );
};
