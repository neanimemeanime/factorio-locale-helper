import React, { useState } from 'react';
import { useI18n } from '../i18n.tsx';

export interface LocaleIssue {
    type: 'tag_mismatch' | 'foreign_characters' | 'mixed_language' | 'untranslated_english';
    file: string;
    modName: string;
    section: string;
    key: string;
    text: string;
    originalText?: string | null;
    missingTags?: string[];
    extraTags?: string[];
    syntaxErrors?: string[];
    languages?: string[];
    suspiciousWords?: string[];
    foreignCharacters?: string[];
    description: string;
}

export interface AuditSummary {
    targetLocaleDir: string;
    modsDir: string;
    totalFilesScanned: number;
    totalIssuesFound: number;
    tagMismatchCount: number;
    foreignCharactersCount: number;
    mixedCount: number;
    untranslatedCount: number;
    returnedCount: number;
    hasMore: boolean;
}

export interface AuditResult {
    summary: AuditSummary;
    issues: LocaleIssue[];
}

interface QualityAuditTabProps {
    isConnected: boolean;
    defaultModsDir: string;
    defaultTargetLocaleDir: string;
    onUpdateAuditCount?: (count: number) => void;
}

type FilterIssueType = 'all' | 'tag_mismatch' | 'foreign_characters' | 'mixed_language' | 'untranslated_english';

export const QualityAuditTab: React.FC<QualityAuditTabProps> = ({
    isConnected,
    defaultModsDir,
    defaultTargetLocaleDir,
    onUpdateAuditCount
}) => {
    const { t } = useI18n();
    const [targetPath, setTargetPath] = useState(defaultTargetLocaleDir);
    const [modsDir, setModsDir] = useState(defaultModsDir);
    const [modFilter, setModFilter] = useState('');
    const [limit, setLimit] = useState(100);

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [actionStatus, setActionStatus] = useState<string | null>(null);
    const [result, setResult] = useState<AuditResult | null>(null);

    const [activeFilter, setActiveFilter] = useState<FilterIssueType>('all');
    const [searchQuery, setSearchQuery] = useState('');

    React.useEffect(() => {
        if (!targetPath && defaultTargetLocaleDir) setTargetPath(defaultTargetLocaleDir);
        if (!modsDir && defaultModsDir) setModsDir(defaultModsDir);
    }, [defaultTargetLocaleDir, defaultModsDir]);

    const handleResetPaths = () => {
        setTargetPath(defaultTargetLocaleDir);
        setModsDir(defaultModsDir);
        setModFilter('');
    };

    const handleRunAudit = async () => {
        if (!isConnected) {
            setError('Local API server is disconnected. Run npm run server in your project console.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setActionStatus(null);

        try {
            const response = await fetch('/api/audit-quality', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetPath: targetPath || defaultTargetLocaleDir,
                    modsDir: modsDir || defaultModsDir,
                    modFilter: modFilter.trim() || undefined,
                    issueType: 'all',
                    limit
                })
            });

            const data = await response.json();
            if (data.success) {
                setResult(data.result);
                if (onUpdateAuditCount) {
                    onUpdateAuditCount(data.result.summary.totalIssuesFound);
                }
            } else {
                setError(data.error || 'Error running locale quality audit.');
            }
        } catch (err) {
            setError(`Server connection error: ${(err as Error).message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const copyText = (content: string, message: string = 'Copied to clipboard') => {
        navigator.clipboard.writeText(content);
        setActionStatus(message);
        setTimeout(() => setActionStatus(null), 3000);
    };

    // Filter issues by category and instant search query
    const filteredIssues = (result?.issues || []).filter((issue) => {
        if (activeFilter !== 'all' && issue.type !== activeFilter) {
            return false;
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const inKey = issue.key.toLowerCase().includes(q);
            const inSection = issue.section.toLowerCase().includes(q);
            const inMod = issue.modName.toLowerCase().includes(q);
            const inText = issue.text.toLowerCase().includes(q);
            const inOrig = (issue.originalText || '').toLowerCase().includes(q);
            const inDesc = issue.description.toLowerCase().includes(q);
            return inKey || inSection || inMod || inText || inOrig || inDesc;
        }
        return true;
    });

    const renderBadge = (type: LocaleIssue['type']) => {
        switch (type) {
            case 'tag_mismatch':
                return <span className="badge badge-warning">{t('audit.badgeTags')}</span>;
            case 'foreign_characters':
                return <span className="badge badge-error">{t('audit.badgeForeign')}</span>;
            case 'mixed_language':
                return <span className="badge badge-yellow">{t('audit.badgeMixed')}</span>;
            case 'untranslated_english':
                return <span className="badge badge-info">{t('audit.badgeUntranslated')}</span>;
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Parameters Panel */}
            <div className="panel tab-content-panel" style={{ padding: '1.25rem' }}>
                <h3 style={{ margin: '0 0 1rem 0', color: '#ffe6c0' }}>{t('audit.optionsTitle')}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.4rem', color: '#ffe6c0' }}>
                            {t('audit.targetDirLabel')}:
                        </label>
                        <input
                            type="text"
                            className="factorio-input"
                            value={targetPath}
                            onChange={(e) => setTargetPath(e.target.value)}
                            placeholder="C:\Users\...\locale-mod\locale\ru"
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.4rem', color: '#ffe6c0' }}>
                            {t('audit.modsDirLabel')}:
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
                            {t('audit.filterModLabel')}:
                        </label>
                        <input
                            type="text"
                            className="factorio-input"
                            value={modFilter}
                            onChange={(e) => setModFilter(e.target.value)}
                            placeholder={t('audit.filterPlaceholder')}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.4rem', color: '#ffe6c0' }}>
                            {t('audit.issueLimitLabel')}:
                        </label>
                        <select
                            value={limit}
                            onChange={(e) => setLimit(Number(e.target.value))}
                            className="factorio-select"
                            style={{ width: '100%' }}
                        >
                            <option value={100}>{t('audit.limit100')}</option>
                            <option value={250}>{t('audit.limit250')}</option>
                            <option value={500}>{t('audit.limit500')}</option>
                            <option value={0}>{t('audit.limitAll')}</option>
                        </select>
                    </div>
                </div>

                <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div className="button-group">
                        <button className="button" onClick={handleResetPaths}>
                            {t('audit.resetPaths')}
                        </button>
                        <button className="button-orange" onClick={handleRunAudit} disabled={isLoading || !isConnected}>
                            {isLoading ? t('audit.auditing') : t('audit.runBtn')}
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
                    {t('audit.serverOffline')}
                </div>
            )}

            {/* KPI Summary Cards */}
            {result && (
                <div className="panel" style={{ padding: '0.85rem' }}>
                    <div className="kpi-grid">
                        <div className="panel-hole-inner kpi-card">
                            <div className="kpi-title">{t('audit.kpiFilesAudited')}</div>
                            <div className="kpi-value" style={{ color: '#ffe6c0' }}>
                                {result.summary.totalFilesScanned}
                            </div>
                        </div>
                        <div className="panel-hole-inner kpi-card">
                            <div className="kpi-title">{t('audit.kpiTotalIssues')}</div>
                            <div className="kpi-value" style={{ color: result.summary.totalIssuesFound > 0 ? '#eb5c5f' : '#2ecc71' }}>
                                {result.summary.totalIssuesFound}
                            </div>
                        </div>
                        <div className="panel-hole-inner kpi-card">
                            <div className="kpi-title">{t('audit.kpiTagMismatch')}</div>
                            <div className="kpi-value" style={{ color: result.summary.tagMismatchCount > 0 ? '#ffa200' : '#2ecc71' }}>
                                {result.summary.tagMismatchCount}
                            </div>
                        </div>
                        <div className="panel-hole-inner kpi-card">
                            <div className="kpi-title">{t('audit.kpiForeignChars')}</div>
                            <div className="kpi-value" style={{ color: result.summary.foreignCharactersCount > 0 ? '#eb5c5f' : '#2ecc71' }}>
                                {result.summary.foreignCharactersCount}
                            </div>
                        </div>
                        <div className="panel-hole-inner kpi-card">
                            <div className="kpi-title">{t('audit.kpiMixedLang')}</div>
                            <div className="kpi-value" style={{ color: result.summary.mixedCount > 0 ? '#f1c40f' : '#2ecc71' }}>
                                {result.summary.mixedCount}
                            </div>
                        </div>
                        <div className="panel-hole-inner kpi-card">
                            <div className="kpi-title">{t('audit.kpiUntranslated')}</div>
                            <div className="kpi-value" style={{ color: result.summary.untranslatedCount > 0 ? '#7dcaed' : '#2ecc71' }}>
                                {result.summary.untranslatedCount}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Category Filter Pills and Search */}
            {result && result.summary.totalIssuesFound > 0 && (
                <div className="panel" style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                        <div className="button-group">
                            <button
                                className={activeFilter === 'all' ? 'button-orange button-sm' : 'button button-sm'}
                                onClick={() => setActiveFilter('all')}
                            >
                                {t('audit.filterAll')} ({result.summary.returnedCount})
                            </button>
                            <button
                                className={activeFilter === 'tag_mismatch' ? 'button-orange button-sm' : 'button button-sm'}
                                onClick={() => setActiveFilter('tag_mismatch')}
                            >
                                {t('audit.filterTags')} ({result.summary.tagMismatchCount})
                            </button>
                            <button
                                className={activeFilter === 'foreign_characters' ? 'button-orange button-sm' : 'button button-sm'}
                                onClick={() => setActiveFilter('foreign_characters')}
                            >
                                {t('audit.filterForeign')} ({result.summary.foreignCharactersCount})
                            </button>
                            <button
                                className={activeFilter === 'mixed_language' ? 'button-orange button-sm' : 'button button-sm'}
                                onClick={() => setActiveFilter('mixed_language')}
                            >
                                {t('audit.filterMixed')} ({result.summary.mixedCount})
                            </button>
                            <button
                                className={activeFilter === 'untranslated_english' ? 'button-orange button-sm' : 'button button-sm'}
                                onClick={() => setActiveFilter('untranslated_english')}
                            >
                                {t('audit.filterUntranslated')} ({result.summary.untranslatedCount})
                            </button>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '260px', flexGrow: 1, maxWidth: '420px' }}>
                            <input
                                type="text"
                                placeholder={t('audit.searchPlaceholder')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="factorio-input"
                            />
                            {searchQuery.trim() && (
                                <span className="badge badge-warning" style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                                    {t('audit.foundCount')}: {filteredIssues.length}
                                </span>
                            )}
                        </div>
                    </div>

                    {result.summary.hasMore && (
                        <div style={{ color: '#ffa200', fontSize: '0.85rem', marginBottom: '0.75rem', fontWeight: 600 }}>
                            {t('audit.showingFirst')} {result.summary.returnedCount} {t('audit.of')} {result.summary.totalIssuesFound} {t('audit.issues')}
                        </div>
                    )}

                    {/* Issues Table */}
                    <div className="table-container panel-inset" style={{ maxHeight: '600px', overflowY: 'auto', padding: '4px' }}>
                        {filteredIssues.length === 0 ? (
                            <div style={{ padding: '2.5rem', textAlign: 'center', color: '#888888' }}>
                                {t('audit.noIssuesCategory')}
                            </div>
                        ) : (
                            <table className="panel-hole">
                                <thead>
                                    <tr>
                                        <th style={{ width: '110px', textAlign: 'center' }}>{t('audit.colCategory')}</th>
                                        <th style={{ width: '180px' }}>{t('audit.colModSection')}</th>
                                        <th>{t('audit.colKeyContent')}</th>
                                        <th style={{ width: '110px', textAlign: 'center' }}>{t('audit.colActions')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredIssues.map((issue, idx) => (
                                        <tr key={idx}>
                                            <td className="panel-hole-inner" style={{ textAlign: 'center', verticalAlign: 'top' }}>
                                                {renderBadge(issue.type)}
                                            </td>
                                            <td className="panel-hole-inner" style={{ verticalAlign: 'top' }}>
                                                <div style={{ fontWeight: 'bold', color: '#ffe6c0', fontSize: '0.95rem' }}>{issue.modName}</div>
                                                <div style={{ color: '#ffa200', fontSize: '0.85rem', fontFamily: 'Consolas, monospace', marginTop: '2px' }}>
                                                    [{issue.section}]
                                                </div>
                                                <div style={{ color: '#888888', fontSize: '0.75rem', marginTop: '2px', wordBreak: 'break-all' }}>{issue.file}</div>
                                            </td>
                                            <td className="panel-hole-inner" style={{ verticalAlign: 'top' }}>
                                                <div style={{ fontFamily: 'Consolas, monospace', fontWeight: 'bold', color: '#ffa200', marginBottom: '4px', fontSize: '0.95rem' }}>
                                                    {issue.key}
                                                </div>

                                                <div style={{ color: '#eb5c5f', fontSize: '0.85rem', marginBottom: '6px', fontWeight: 600 }}>
                                                    {issue.description}
                                                </div>

                                                {issue.missingTags && issue.missingTags.length > 0 && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', marginBottom: '6px' }}>
                                                        <span style={{ fontSize: '0.8rem', color: '#a6a6a6' }}>{t('audit.missingTags')}:</span>
                                                        {issue.missingTags.map((tag, tIdx) => (
                                                            <span key={tIdx} className="badge badge-error" style={{ fontFamily: 'Consolas, monospace' }}>
                                                                {tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}

                                                {issue.suspiciousWords && issue.suspiciousWords.length > 0 && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', marginBottom: '6px' }}>
                                                        <span style={{ fontSize: '0.8rem', color: '#a6a6a6' }}>{t('audit.words')}:</span>
                                                        {issue.suspiciousWords.map((word, wIdx) => (
                                                            <span key={wIdx} className="badge badge-yellow" style={{ fontFamily: 'Consolas, monospace' }}>
                                                                {word}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}

                                                {issue.foreignCharacters && issue.foreignCharacters.length > 0 && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', marginBottom: '6px' }}>
                                                        <span style={{ fontSize: '0.8rem', color: '#a6a6a6' }}>{t('audit.chars')}:</span>
                                                        {issue.foreignCharacters.map((char, cIdx) => (
                                                            <span key={cIdx} className="badge badge-error" style={{ fontFamily: 'Consolas, monospace' }}>
                                                                {char}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}

                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                    {issue.originalText && (
                                                        <div className="diff-box diff-box-original">
                                                            <strong style={{ color: '#7dcaed', marginRight: '6px' }}>{t('audit.original')}:</strong>
                                                            <span>{issue.originalText}</span>
                                                        </div>
                                                    )}
                                                    <div className="diff-box diff-box-translated">
                                                        <strong style={{ color: '#5eb663', marginRight: '6px' }}>{t('audit.translation')}:</strong>
                                                        <span>{issue.text}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="panel-hole-inner" style={{ textAlign: 'center', verticalAlign: 'top' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                                                    <button
                                                        className="button button-sm"
                                                        style={{ width: '80px' }}
                                                        onClick={() => copyText(issue.key, t('missing.copiedKey'))}
                                                        title="Copy key name"
                                                    >
                                                        {t('audit.copyKeyBtn')}
                                                    </button>
                                                    <button
                                                        className="button button-sm"
                                                        style={{ width: '80px' }}
                                                        onClick={() => copyText(`${issue.key}=${issue.text}`, t('missing.copiedString'))}
                                                        title="Copy string (key=value)"
                                                    >
                                                        {t('audit.copyStringBtn')}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* Zero issues empty state */}
            {result && result.summary.totalIssuesFound === 0 && (
                <div className="panel" style={{ textAlign: 'center', padding: '3rem' }}>
                    <h3 style={{ color: '#2ecc71', margin: '0 0 0.5rem 0' }}>{t('audit.noIssuesTitle')}</h3>
                    <p style={{ color: '#aaaaaa', margin: 0 }}>
                        {t('audit.noIssuesDesc')}
                    </p>
                </div>
            )}
        </div>
    );
};
