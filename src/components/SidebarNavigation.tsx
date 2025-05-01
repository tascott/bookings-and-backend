'use client';

import React, { useState } from 'react';
import styles from './SidebarNavigation.module.css'; // We'll create this CSS module

// Define types for tab items and component props (keeping 'tabs' name for consistency for now)
type TabItem = {
  id: string;
  label: string;
  content: React.ReactNode;
};

interface SidebarNavigationProps {
  tabs: TabItem[];
  defaultTabId?: string;
}

export default function SidebarNavigation({ tabs, defaultTabId }: SidebarNavigationProps) {
  // Use the defaultTabId if provided, otherwise use the first tab's id
  const [activeTabId, setActiveTabId] = useState<string>(
    defaultTabId || (tabs.length > 0 ? tabs[0].id : '')
  );

  // Find the active tab content
  const activeTabContent = tabs.find((tab) => tab.id === activeTabId)?.content;

  return (
    <div className={styles.layoutContainer}>
      <div className={styles.sidebarNav}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.sidebarButton} ${activeTabId === tab.id ? styles.active : ''}`}
            onClick={() => setActiveTabId(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className={styles.mainContent}>
        {activeTabContent}
      </div>
    </div>
  );
}