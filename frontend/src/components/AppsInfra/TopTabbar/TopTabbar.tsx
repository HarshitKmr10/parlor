'use client';

// ─── React & Next.js ─────────────────────────────────────────────
import React from 'react';

// ─── UI Libraries ───────────────────────────────────────────────
import { Home, Users2 } from 'lucide-react';

// ─── Styles ─────────────────────────────────────────────────────
import {
  tabsRootClass,
  tabsListClass,
  tabTriggerClass,
} from './TopTabbar.styles';

// ─── Props ──────────────────────────────────────────────────────
interface TopTabBarProps {
  activeTab: 'home' | 'ai-copilots';
  onTabChange: (value: 'home' | 'ai-copilots') => void;
}

// ─── Tab Items Configuration ────────────────────────────────────
const tabItems = [
  {
    value: 'home',
    label: 'Home',
    icon: <Home size={18} className="mr-1" />,
  },
  {
    value: 'ai-copilots',
    label: 'AI Copilots',
    icon: <Users2 size={18} className="mr-1" />,
  },
];

// ─── Component ──────────────────────────────────────────────────
const TopTabBar = ({ activeTab, onTabChange }: TopTabBarProps): JSX.Element => {
  return (
    <div className={tabsRootClass}>
      <div className={tabsListClass}>
        {tabItems.map(({ value, label, icon }) => (
          <button
            key={value}
            onClick={() => onTabChange(value as 'home' | 'ai-copilots')}
            className={`${tabTriggerClass} ${
              activeTab === value
                ? 'bg-blue-100 text-blue-600'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TopTabBar;