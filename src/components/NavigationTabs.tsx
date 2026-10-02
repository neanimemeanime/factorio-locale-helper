import React from 'react';

export type TabType = 'analyzer' | 'missing' | 'audit';

interface NavigationTabsProps {
    activeTab: TabType;
    onSelectTab: (tab: TabType) => void;
    missingKeysCount?: number;
    auditIssuesCount?: number;
}

export const NavigationTabs: React.FC<NavigationTabsProps> = ({
    activeTab,
    onSelectTab,
    missingKeysCount = 0,
    auditIssuesCount = 0
}) => {
    return (
        <div style={{ marginTop: '1rem', marginBottom: '0' }}>
            <ul className="tabs tabs-for-panel" style={{ margin: '0', display: 'flex', gap: '4px' }}>
                <li>
                    <a
                        href="#"
                        className={activeTab === 'analyzer' ? 'active' : ''}
                        onClick={(e) => {
                            e.preventDefault();
                            onSelectTab('analyzer');
                        }}
                    >
                        Анализ мода
                    </a>
                </li>
                <li>
                    <a
                        href="#"
                        className={activeTab === 'missing' ? 'active' : ''}
                        onClick={(e) => {
                            e.preventDefault();
                            onSelectTab('missing');
                        }}
                    >
                        Недостающие ключи
                        {missingKeysCount > 0 && (
                            <span className="badge" style={{ marginLeft: '8px' }}>
                                {missingKeysCount}
                            </span>
                        )}
                    </a>
                </li>
                <li>
                    <a
                        href="#"
                        className={activeTab === 'audit' ? 'active' : ''}
                        onClick={(e) => {
                            e.preventDefault();
                            onSelectTab('audit');
                        }}
                    >
                        Аудит качества
                        {auditIssuesCount > 0 && (
                            <span className="badge" style={{ marginLeft: '8px' }}>
                                {auditIssuesCount}
                            </span>
                        )}
                    </a>
                </li>
            </ul>
        </div>
    );
};
