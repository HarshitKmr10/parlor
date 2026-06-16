import React, { useState } from 'react';

type TabDetails = {
  name: string;
  component: React.ReactNode;
};

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

type Props = {
  tabs: TabDetails[];
};

function Tabs({ tabs }: Props) {
  const [activeTab, setActiveTab] = useState(0);
  const currentTab = tabs[activeTab];

  return (
    <div className="flex flex-col h-full">
      {/* Tabs container */}
      <div className="">
        <nav className="flex">
          {tabs.map((tab, index) => (
            <button
              key={tab.name}
              onClick={() => setActiveTab(index)}
              className={classNames(
                'flex-grow text-center px-3 py-2 text-sm font-medium cursor-pointer',
                activeTab === index
                  ? 'text-[#4E80EE] border-b-2 border-[#4E80EE]'
                  : 'text-[#8F9BBA]  border-b-2 border-[#8F9BBA]',
              )}
              aria-current={activeTab === index ? 'page' : undefined}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>
      <div className="flex-grow overflow-y-auto">{currentTab.component}</div>
    </div>
  );
}

export default Tabs;
