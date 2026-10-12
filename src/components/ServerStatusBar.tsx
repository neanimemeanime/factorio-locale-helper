import React from 'react';
import { useI18n } from '../i18n.tsx';

interface ServerStatusBarProps {
    isConnected: boolean;
    defaultModsDir: string;
    defaultTargetMod: string;
    defaultSteamDataDir?: string;
    selectedLang: string;
    onChangeLang: (lang: string) => void;
}

export const ServerStatusBar: React.FC<ServerStatusBarProps> = ({
    isConnected,
    defaultModsDir,
    defaultTargetMod,
    defaultSteamDataDir,
    selectedLang,
    onChangeLang
}) => {
    const { uiLang, setUiLang, t } = useI18n();

    return (
        <div className="panel" style={{ padding: '0.75rem 1.25rem', margin: '0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className={`industrial-led ${isConnected ? 'connected' : 'disconnected'}`} />
                        <strong style={{ color: '#ffe6c0', fontSize: '0.95rem' }}>{t('status.server')}:</strong>
                        <span style={{ color: isConnected ? '#2ecc71' : '#a6a6a6', fontSize: '0.9rem', fontWeight: 600 }}>
                            {isConnected ? `${t('status.online')} (port 3001)` : t('status.offline')}
                        </span>
                    </div>

                    <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>
                        Factorio 2.1+ (Space Age)
                    </span>

                    {isConnected && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', fontSize: '0.85rem', color: '#a6a6a6' }}>
                            {defaultModsDir && (
                                <>
                                    <span>{t('status.modsDir')}:</span>
                                    <span className="status-chip" title={defaultModsDir}>{defaultModsDir}</span>
                                </>
                            )}
                            {defaultTargetMod && (
                                <>
                                    <span>{t('status.targetMod')}:</span>
                                    <span className="status-chip" title={defaultTargetMod}>{defaultTargetMod}</span>
                                </>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <span>{t('status.gameData')}:</span>
                                <span
                                    className={`status-chip ${defaultSteamDataDir ? 'badge-success' : ''}`}
                                    title={defaultSteamDataDir || t('status.notDetected')}
                                    style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                >
                                    {defaultSteamDataDir ? 'Detected' : t('status.notDetected')}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                    {/* Factorio-style Interface Language Toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ color: '#ffe6c0', fontSize: '0.85rem', fontWeight: 600 }}>
                            {t('status.uiLang')}:
                        </span>
                        <div className="button-group" style={{ margin: 0 }}>
                            <button
                                type="button"
                                className={uiLang === 'en' ? 'button-orange button-sm' : 'button button-sm'}
                                onClick={() => setUiLang('en')}
                                style={{ padding: '2px 9px', minWidth: '36px', height: '26px', fontWeight: uiLang === 'en' ? 700 : 400 }}
                            >
                                EN
                            </button>
                            <button
                                type="button"
                                className={uiLang === 'ru' ? 'button-orange button-sm' : 'button button-sm'}
                                onClick={() => setUiLang('ru')}
                                style={{ padding: '2px 9px', minWidth: '36px', height: '26px', fontWeight: uiLang === 'ru' ? 700 : 400 }}
                            >
                                RU
                            </button>
                        </div>
                    </div>

                    {/* Target Locale Language Selector */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <label htmlFor="global-target-lang" style={{ fontWeight: 'bold', color: '#ffe6c0', fontSize: '0.85rem' }}>
                            {t('status.targetLang')}:
                        </label>
                        <select
                            id="global-target-lang"
                            value={selectedLang}
                            onChange={(e) => onChangeLang(e.target.value)}
                            className="factorio-select"
                            style={{ height: '26px', padding: '2px 8px', fontSize: '0.85rem' }}
                        >
                            <option value="en">English (en)</option>
                            <option value="ru">Russian (ru)</option>
                            <option value="de">German (de)</option>
                            <option value="fr">French (fr)</option>
                            <option value="es">Spanish (es)</option>
                            <option value="zh-CN">Chinese (zh-CN)</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
    );
};
