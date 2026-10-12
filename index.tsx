import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { I18nProvider, useI18n } from './src/i18n.tsx';
import { NavigationTabs, TabType } from './src/components/NavigationTabs.tsx';
import { ServerStatusBar } from './src/components/ServerStatusBar.tsx';
import { ModAnalyzerTab } from './src/components/ModAnalyzerTab.tsx';
import { MissingKeysTab } from './src/components/MissingKeysTab.tsx';
import { QualityAuditTab } from './src/components/QualityAuditTab.tsx';

const App: React.FC = () => {
    const { t } = useI18n();
    const [activeTab, setActiveTab] = useState<TabType>('analyzer');
    const [isLocalServerConnected, setIsLocalServerConnected] = useState(false);
    const [selectedLang, setSelectedLang] = useState('ru');

    const [defaultModsDir, setDefaultModsDir] = useState('');
    const [defaultTargetMod, setDefaultTargetMod] = useState('locale-mod');
    const [defaultTargetLocaleDir, setDefaultTargetLocaleDir] = useState('');
    const [defaultSteamDataDir, setDefaultSteamDataDir] = useState('');

    const [prototypesDb, setPrototypesDb] = useState<Set<string>>(new Set());
    const [missingKeysCount, setMissingKeysCount] = useState<number>(0);
    const [auditIssuesCount, setAuditIssuesCount] = useState<number>(0);

    // Check server status and load defaults
    useEffect(() => {
        let isMounted = true;
        const checkLocalServer = async () => {
            try {
                const response = await fetch('/api/status');
                if (!response.ok) throw new Error('Status not ok');
                const data = await response.json();
                if (data.status === 'ok') {
                    if (isMounted) setIsLocalServerConnected(true);
                    // Fetch default paths
                    try {
                        const defResp = await fetch('/api/defaults');
                        if (defResp.ok) {
                            const defData = await defResp.json();
                            if (isMounted) {
                                if (defData.modsDir) setDefaultModsDir(defData.modsDir);
                                if (defData.targetMod) setDefaultTargetMod(defData.targetMod);
                                if (defData.targetLocaleDir) setDefaultTargetLocaleDir(defData.targetLocaleDir);
                                if (defData.steamDataDir) setDefaultSteamDataDir(defData.steamDataDir);
                            }
                        }
                    } catch (_) {}
                } else {
                    if (isMounted) setIsLocalServerConnected(false);
                }
            } catch (e) {
                if (isMounted) setIsLocalServerConnected(false);
            }
        };

        checkLocalServer();
        const interval = setInterval(checkLocalServer, 5000);
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    // Load Prototypes.txt
    useEffect(() => {
        const fetchPrototypes = async () => {
            try {
                const response = await fetch('Prototypes.txt');
                const text = await response.text();
                const names = new Set(text.split(/\r?\n/).filter(Boolean));
                setPrototypesDb(names);
            } catch (e) {
                console.error('Could not load Prototypes.txt', e);
            }
        };
        fetchPrototypes();
    }, []);

    return (
        <div className="app-container">
            <header>
                <h1>{t('app.title')}</h1>
                <p>{t('app.subtitle')}</p>
            </header>

            <ServerStatusBar
                isConnected={isLocalServerConnected}
                defaultModsDir={defaultModsDir}
                defaultTargetMod={defaultTargetMod}
                defaultSteamDataDir={defaultSteamDataDir}
                selectedLang={selectedLang}
                onChangeLang={setSelectedLang}
            />

            <NavigationTabs
                activeTab={activeTab}
                onSelectTab={setActiveTab}
                missingKeysCount={missingKeysCount}
                auditIssuesCount={auditIssuesCount}
            />

            <div className="tab-viewport">
                {activeTab === 'analyzer' && (
                    <ModAnalyzerTab
                        isConnected={isLocalServerConnected}
                        defaultModsDir={defaultModsDir}
                        selectedLang={selectedLang}
                        prototypesDb={prototypesDb}
                    />
                )}

                {activeTab === 'missing' && (
                    <MissingKeysTab
                        isConnected={isLocalServerConnected}
                        defaultModsDir={defaultModsDir}
                        defaultTargetMod={defaultTargetMod}
                        selectedLang={selectedLang}
                        onUpdateMissingCount={setMissingKeysCount}
                    />
                )}

                {activeTab === 'audit' && (
                    <QualityAuditTab
                        isConnected={isLocalServerConnected}
                        defaultModsDir={defaultModsDir}
                        defaultTargetLocaleDir={defaultTargetLocaleDir}
                        onUpdateAuditCount={setAuditIssuesCount}
                    />
                )}
            </div>
        </div>
    );
};

const container = document.getElementById('root');
const root = ReactDOM.createRoot(container!);
root.render(
    <I18nProvider>
        <App />
    </I18nProvider>
);