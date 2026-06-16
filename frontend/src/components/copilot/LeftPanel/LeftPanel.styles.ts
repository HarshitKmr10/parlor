/**
 * LeftPanel Styles
 * 
 * Contains all styling for the LeftPanel component and its children
 */

export const leftPanelStyles = {
  // Main container styles
  container: "h-full",
  
  // CallerInfo section styles
  callerInfoSection: "flex-shrink-0",
  
  // Tabs section styles
  tabsSection: "flex-grow overflow-auto bg-[var(--accent-2)]",
  
  // Scrollable content styles
  scrollableContent: "h-full overflow-y-auto",
  
  // Hidden scrollbar styles
  hiddenScrollbar: {
    scrollbarWidth: 'none', // Firefox
    msOverflowStyle: 'none', // IE/Edge
  },
  
  // WebKit scrollbar hiding
  webkitScrollbarHidden: "[&::-webkit-scrollbar]:hidden",
} as const;
