export const copilotStyles = {
  container: "h-full",
  panelsContainer: "flex flex-grow overflow-hidden relative",
  leftPanel: "w-1/2 min-w-[10rem] overflow-hidden",
  rightPanel: "w-1/2 min-w-[10rem] flex flex-col border-l border-[var(--gray-8)] overflow-hidden",
  tabsRoot: "flex h-full flex-col",
  tabsList: "flex-shrink-0",
  tabsContent: "flex-grow overflow-auto",
  tabContent: "h-full"
} as const;
