/**
 * CallHeader Component Styles
 * Organized styles for the call header section displaying user information
 */

export const callHeaderStyles = {
  // Main container styles
  container: "items-center h-full",
  
  // User info section (left side)
  userInfoSection: "items-center h-full",
  
  // Avatar styles
  avatar: {
    height: "2rem",
    width: "2rem",
  },
  
  // Text styles
  userName: "text-neutral-l2",
  timestamp: "text-neutral-l2",
  
  // Menu trigger button
  menuTrigger: "rounded-full hover:bg-[var(--gray-4)] cursor-pointer",
  
  // DataList styles
  dataList: {
    header: "text-md text-[var(--gray-11)]",
    label: "font-medium text-sm text-[var(--gray-9)]",
    value: "text-sm text-[var(--gray-11)]",
    itemHover: "cursor-pointer",
  },
} as const;

