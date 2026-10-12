import React from 'react';
import { useI18n } from '../i18n.tsx';

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
    const { t } = useI18n();

    return (
        <div className="tabs-dock-container">
            <ul className="tabs tabs-for-panel" role="tablist">
                <li role="presentation">
                    <a
                        href="#analyzer"
                        role="tab"
                        aria-selected={activeTab === 'analyzer'}
                        className={activeTab === 'analyzer' ? 'active' : ''}
                        onClick={(e) => {
                            e.preventDefault();
                            onSelectTab('analyzer');
                        }}
                    >
                        {t('nav.analyzer')}
                    </a>
                </li>
                <li role="presentation">
                    <a
                        href="#missing"
                        role="tab"
                        aria-selected={activeTab === 'missing'}
                        className={activeTab === 'missing' ? 'active' : ''}
                        onClick={(e) => {
                            e.preventDefault();
                            onSelectTab('missing');
                        }}
                    >
                        {t('nav.missing')}
                        {missingKeysCount > 0 && (
                            <span className="badge" style={{ marginLeft: '8px' }}>
                                {missingKeysCount}
                            </span>
                        )}
                    </a>
                </li>
                <li role="presentation">
                    <a
                        href="#audit"
                        role="tab"
                        aria-selected={activeTab === 'audit'}
                        className={activeTab === 'audit' ? 'active' : ''}
                        onClick={(e) => {
                            e.preventDefault();
                            onSelectTab('audit');
                        }}
                    >
                        {t('nav.audit')}
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
