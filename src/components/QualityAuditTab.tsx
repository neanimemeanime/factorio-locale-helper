import React, { useState } from 'react';

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
            setError('Локальный сервер API отключен. Запустите npm run server в консоли проекта.');
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
                setError(data.error || 'Ошибка при проведении аудита качества.');
            }
        } catch (err) {
            setError(`Ошибка соединения с сервером: ${(err as Error).message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const copyText = (content: string, message: string = 'Скопировано в буфер обмена') => {
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

    const getIssueBadge = (type: LocaleIssue['type']) => {
        switch (type) {
            case 'tag_mismatch':
                return { label: 'ТЕГИ', bg: '#e39827', color: '#000' };
            case 'foreign_characters':
                return { label: 'ИЕРОГЛИФЫ', bg: '#eb5c5f', color: '#fff' };
            case 'mixed_language':
                return { label: 'СМЕСЬ', bg: '#f1c40f', color: '#000' };
            case 'untranslated_english':
                return { label: 'АНГЛИЙСКИЙ', bg: '#7dcaed', color: '#000' };
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Parameters Panel */}
            <div className="panel" style={{ padding: '1.25rem' }}>
                <h3 style={{ marginBottom: '1rem' }}>Параметры аудита качества локализации</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.4rem' }}>
                            Папка с переводами (.cfg):
                        </label>
                        <input
                            type="text"
                            value={targetPath}
                            onChange={(e) => setTargetPath(e.target.value)}
                            placeholder="C:\Users\...\my-texture-pack\locale\ru"
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
                            Папка модов Factorio (для сверки с EN):
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
                            Фильтр по конкретному моду (опционально):
                        </label>
                        <input
                            type="text"
                            value={modFilter}
                            onChange={(e) => setModFilter(e.target.value)}
                            placeholder="Например, planet-rabbasca"
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
                            Лимит замечаний:
                        </label>
                        <select
                            value={limit}
                            onChange={(e) => setLimit(Number(e.target.value))}
                            style={{
                                width: '100%',
                                padding: '8px 10px',
                                backgroundColor: '#140f0a',
                                border: '1px solid #555',
                                borderRadius: '4px',
                                color: '#fff',
                                fontFamily: 'monospace'
                            }}
                        >
                            <option value={100}>100 замечаний</option>
                            <option value={250}>250 замечаний</option>
                            <option value={500}>500 замечаний</option>
                            <option value={0}>Без лимита (все найденные)</option>
                        </select>
                    </div>
                </div>

                <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button className="button" onClick={handleResetPaths}>
                        Сбросить пути
                    </button>
                    <button className="button-orange" onClick={handleRunAudit} disabled={isLoading || !isConnected}>
                        {isLoading ? 'Проверка...' : 'Запустить аудит качества'}
                    </button>
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
                    Локальный сервер API не запущен. Для аудита файлов локализации запустите в терминале: <code>npm run server</code>
                </div>
            )}

            {/* KPI Summary Cards */}
            {result && (
                <div className="panel" style={{ padding: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', textAlign: 'center' }}>
                        <div className="panel-hole-inner" style={{ padding: '0.75rem' }}>
                            <div style={{ color: '#aaa', fontSize: '0.9rem' }}>Проверено файлов</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#ffe6c0' }}>{result.summary.totalFilesScanned}</div>
                        </div>
                        <div className="panel-hole-inner" style={{ padding: '0.75rem' }}>
                            <div style={{ color: '#aaa', fontSize: '0.9rem' }}>Всего замечаний</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: result.summary.totalIssuesFound > 0 ? '#eb5c5f' : '#2ecc71' }}>
                                {result.summary.totalIssuesFound}
                            </div>
                        </div>
                        <div className="panel-hole-inner" style={{ padding: '0.75rem' }}>
                            <div style={{ color: '#aaa', fontSize: '0.9rem' }}>Несовпадения тегов</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: result.summary.tagMismatchCount > 0 ? '#e39827' : '#2ecc71' }}>
                                {result.summary.tagMismatchCount}
                            </div>
                        </div>
                        <div className="panel-hole-inner" style={{ padding: '0.75rem' }}>
                            <div style={{ color: '#aaa', fontSize: '0.9rem' }}>Символы других языков</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: result.summary.foreignCharactersCount > 0 ? '#eb5c5f' : '#2ecc71' }}>
                                {result.summary.foreignCharactersCount}
                            </div>
                        </div>
                        <div className="panel-hole-inner" style={{ padding: '0.75rem' }}>
                            <div style={{ color: '#aaa', fontSize: '0.9rem' }}>Смесь языков</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: result.summary.mixedCount > 0 ? '#f1c40f' : '#2ecc71' }}>
                                {result.summary.mixedCount}
                            </div>
                        </div>
                        <div className="panel-hole-inner" style={{ padding: '0.75rem' }}>
                            <div style={{ color: '#aaa', fontSize: '0.9rem' }}>Без перевода (EN)</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: result.summary.untranslatedCount > 0 ? '#7dcaed' : '#2ecc71' }}>
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
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <button
                                className={activeFilter === 'all' ? 'button-orange' : 'button'}
                                onClick={() => setActiveFilter('all')}
                                style={{ padding: '6px 12px', minWidth: 'auto' }}
                            >
                                Все ({result.summary.returnedCount})
                            </button>
                            <button
                                className={activeFilter === 'tag_mismatch' ? 'button-orange' : 'button'}
                                onClick={() => setActiveFilter('tag_mismatch')}
                                style={{ padding: '6px 12px', minWidth: 'auto' }}
                            >
                                Теги и плейсхолдеры ({result.summary.tagMismatchCount})
                            </button>
                            <button
                                className={activeFilter === 'foreign_characters' ? 'button-orange' : 'button'}
                                onClick={() => setActiveFilter('foreign_characters')}
                                style={{ padding: '6px 12px', minWidth: 'auto' }}
                            >
                                Иероглифы ({result.summary.foreignCharactersCount})
                            </button>
                            <button
                                className={activeFilter === 'mixed_language' ? 'button-orange' : 'button'}
                                onClick={() => setActiveFilter('mixed_language')}
                                style={{ padding: '6px 12px', minWidth: 'auto' }}
                            >
                                Смесь языков ({result.summary.mixedCount})
                            </button>
                            <button
                                className={activeFilter === 'untranslated_english' ? 'button-orange' : 'button'}
                                onClick={() => setActiveFilter('untranslated_english')}
                                style={{ padding: '6px 12px', minWidth: 'auto' }}
                            >
                                Без перевода ({result.summary.untranslatedCount})
                            </button>
                        </div>

                        <div style={{ minWidth: '240px' }}>
                            <input
                                type="text"
                                placeholder="Поиск по строкам, ключам или моду..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '6px 10px',
                                    backgroundColor: '#140f0a',
                                    border: '1px solid #555',
                                    borderRadius: '4px',
                                    color: '#fff',
                                    fontFamily: 'monospace'
                                }}
                            />
                        </div>
                    </div>

                    {result.summary.hasMore && (
                        <div style={{ color: '#ffa200', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                            Показаны первые {result.summary.returnedCount} из {result.summary.totalIssuesFound} замечаний. Измените фильтр или увеличьте лимит для просмотра остальных.
                        </div>
                    )}

                    {/* Issues Table */}
                    <div className="table-container panel-inset" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                        {filteredIssues.length === 0 ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>
                                В выбранной категории замечаний не найдено.
                            </div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr>
                                        <th style={{ borderBottom: '1px solid #555', padding: '8px', width: '90px' }}>Категория</th>
                                        <th style={{ borderBottom: '1px solid #555', padding: '8px', width: '170px' }}>Мод / Секция</th>
                                        <th style={{ borderBottom: '1px solid #555', padding: '8px' }}>Ключ и Содержимое</th>
                                        <th style={{ borderBottom: '1px solid #555', padding: '8px', width: '140px' }}>Действия</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredIssues.map((issue, idx) => {
                                        const badge = getIssueBadge(issue.type);
                                        return (
                                            <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#313031' : '#2a292a' }}>
                                                <td style={{ borderBottom: '1px solid #444', padding: '8px', verticalAlign: 'top' }}>
                                                    <span
                                                        className="badge"
                                                        style={{
                                                            backgroundColor: badge.bg,
                                                            color: badge.color,
                                                            fontWeight: 'bold',
                                                            padding: '2px 6px',
                                                            display: 'inline-block'
                                                        }}
                                                    >
                                                        {badge.label}
                                                    </span>
                                                </td>
                                                <td style={{ borderBottom: '1px solid #444', padding: '8px', verticalAlign: 'top' }}>
                                                    <div style={{ fontWeight: 'bold', color: '#ffe6c0' }}>{issue.modName}</div>
                                                    <div style={{ color: '#888', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                                                        [{issue.section}]
                                                    </div>
                                                    <div style={{ color: '#666', fontSize: '0.75rem' }}>{issue.file}</div>
                                                </td>
                                                <td style={{ borderBottom: '1px solid #444', padding: '8px', verticalAlign: 'top' }}>
                                                    <div style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#ffa200', marginBottom: '4px' }}>
                                                        {issue.key}
                                                    </div>

                                                    {/* Issue description */}
                                                    <div style={{ color: '#eb5c5f', fontSize: '0.85rem', marginBottom: '6px' }}>
                                                        {issue.description}
                                                    </div>

                                                    {/* Comparison boxes */}
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                        {issue.originalText && (
                                                            <div style={{ fontSize: '0.85rem', color: '#aaa', backgroundColor: '#1a191a', padding: '4px 8px', borderRadius: '2px' }}>
                                                                <strong style={{ color: '#7dcaed' }}>Оригинал (EN):</strong> {issue.originalText}
                                                            </div>
                                                        )}
                                                        <div style={{ fontSize: '0.85rem', color: '#fff', backgroundColor: '#242324', padding: '4px 8px', borderRadius: '2px' }}>
                                                            <strong style={{ color: '#2ecc71' }}>Перевод (RU):</strong> {issue.text}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={{ borderBottom: '1px solid #444', padding: '8px', verticalAlign: 'top' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                        <button
                                                            className="button"
                                                            onClick={() => copyText(issue.key, `Ключ ${issue.key} скопирован`)}
                                                            style={{ padding: '3px 8px', height: '26px', minWidth: 'auto', fontSize: '0.75rem' }}
                                                        >
                                                            Ключ
                                                        </button>
                                                        <button
                                                            className="button"
                                                            onClick={() => copyText(`${issue.key}=${issue.text}`, 'Строка скопирована')}
                                                            style={{ padding: '3px 8px', height: '26px', minWidth: 'auto', fontSize: '0.75rem' }}
                                                        >
                                                            Строку
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* Zero issues empty state */}
            {result && result.summary.totalIssuesFound === 0 && (
                <div className="panel" style={{ textAlign: 'center', padding: '3rem' }}>
                    <h3 style={{ color: '#2ecc71', marginBottom: '0.5rem' }}>Замечаний к качеству перевода не обнаружено</h3>
                    <p style={{ color: '#aaa' }}>
                        Проверено {result.summary.totalFilesScanned} файлов. Все теги, плейсхолдеры и языковые нормы соблюдены.
                    </p>
                </div>
            )}
        </div>
    );
};
