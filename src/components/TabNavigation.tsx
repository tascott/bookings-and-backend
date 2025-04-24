'use client';

import React, { useState } from 'react';
import styles from '@/app/page.module.css';

// Define types for tab items and component props
type TabItem = {
  id: string;
  label: string;
  content: React.ReactNode;
};

interface TabNavigationProps {
  tabs: TabItem[];
  defaultTabId?: string;
}

export default function TabNavigation({ tabs, defaultTabId }: TabNavigationProps) {
  // Use the defaultTabId if provided, otherwise use the first tab's id
  const [activeTabId, setActiveTabId] = useState<string>(
    defaultTabId || (tabs.length > 0 ? tabs[0].id : '')
  );

  // Find the active tab content
  const activeTabContent = tabs.find((tab) => tab.id === activeTabId)?.content;

  return (
    <div className={styles.tabsContainer}>
      <div className={styles.tabsNav}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.tabButton} ${activeTabId === tab.id ? styles.active : ''}`}
            onClick={() => setActiveTabId(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className={styles.tabContent}>
        {activeTabContent}
      </div>
    </div>
  );
}