/**
 * CallerInfo Styles
 * 
 * Centralized styling for CallerInfo component and its sub-components
 */

export const callerInfoStyles = {
  // Main container styles
  container: "items-center h-full border-b border-[var(--gray-8)] bg-[var(--gray-11)] w-full px-4 py-4 gap-x-2 gap-y-6",
  
  // Header section styles
  header: {
    container: "w-full",
    userSection: "items-center h-full",
    avatar: {
      height: "2rem",
      width: "2rem",
    },
    userName: "text-white",
    copySection: "text-white cursor-pointer",
    copyIcon: "text-white transition-all duration-300",
    copyIconSuccess: "text-green-500 transition-all duration-300",
    copyText: "text-white cursor-pointer",
  },

  // Details section styles
  details: {
    container: "w-full",
    infoContainer: "w-full",
    callInfo: "text-white",
    callTypeSection: "text-white",
    durationSection: "text-white",
  },

  // Action button styles
  actions: {
    // Base button style
    baseButton: "flex items-center justify-center gap-2 px-2 py-1 text-sm font-medium text-white bg-transparent border border-white rounded-md hover:bg-white hover:text-[var(--accent-9)] transition-colors duration-300 cursor-pointer whitespace-nowrap",
    
    // Disabled button style
    disabledButton: "flex items-center justify-center gap-2 px-2 py-1 text-sm font-medium text-white bg-transparent border border-white rounded-md hover:bg-white hover:text-[var(--accent-9)] transition-colors duration-300 cursor-pointer whitespace-nowrap disabled:cursor-not-allowed disabled:hover:bg-[var(--gray-11)] disabled:hover:text-white",
    
    // Button variants
    createDocument: "flex items-center justify-center gap-2 px-2 py-1 text-sm font-medium text-white bg-transparent border border-white rounded-md hover:bg-white hover:text-[var(--accent-9)] transition-colors duration-300 cursor-pointer whitespace-nowrap disabled:cursor-not-allowed disabled:hover:bg-[var(--gray-11)] disabled:hover:text-white",
    
    createIncident: "flex items-center justify-center gap-2 px-2 py-1 text-sm font-medium text-white bg-transparent border border-white rounded-md hover:bg-white hover:text-[var(--accent-9)] transition-colors duration-300 cursor-pointer whitespace-nowrap",
    
    postcall: "flex items-center justify-center gap-2 px-2 py-1 text-sm font-medium text-white bg-transparent border border-white rounded-md hover:bg-white hover:text-[var(--accent-9)] transition-colors duration-300 cursor-pointer whitespace-nowrap",
    
    endCall: "flex items-center justify-center gap-2 px-2 py-1 text-sm font-medium text-white bg-transparent border border-white rounded-md hover:bg-white hover:text-[var(--accent-9)] transition-colors duration-300 cursor-pointer whitespace-nowrap disabled:cursor-not-allowed disabled:hover:bg-[var(--gray-11)] disabled:hover:text-white",
  },

  // Modal styles
  modals: {
    kbDialog: {
      maxWidth: 600,
      height: "80vh",
      display: "flex",
      flexDirection: "column",
    },
    
    // Skeleton loading styles
    skeleton: {
      container: "flex flex-col gap-2",
      title: { width: "80%", height: "24px" },
      line: { width: "100%", height: "16px" },
      line90: { width: "90%", height: "16px" },
      line80: { width: "80%", height: "16px" },
    },
  },

  // Layout styles
  layout: {
    mainContainer: "w-full flex-wrap",
    contentBox: "w-full flex-1 min-w-0",
    headerSection: "w-full",
    detailsActionsSection: "w-full flex-wrap",
    nestedContainer: "w-full flex-wrap",
  },

  // Text styles
  text: {
    userName: "text-white whitespace-nowrap overflow-hidden text-ellipsis",
    callType: "text-white whitespace-nowrap overflow-hidden text-ellipsis",
    duration: "text-white whitespace-nowrap overflow-hidden text-ellipsis",
    copyText: "text-white cursor-pointer whitespace-nowrap overflow-hidden text-ellipsis",
  },

  // Icon styles
  icons: {
    copyIcon: "text-white transition-all duration-300",
    copyIconSuccess: "text-green-500 transition-all duration-300",
    callIcon: "text-white",
  },

  // Flex layouts
  flex: {
    header: "gap-2 gap-y-7 items-center justify-between w-full flex-wrap",
    userSection: "items-center gap-2 flex-shrink-0",
    copySection: "gap-1 flex-col items-center text-white cursor-pointer whitespace-nowrap",
    detailsActions: "gap-2 items-center justify-between w-full flex-wrap",
    nestedDetailsActions: "gap-2 items-center justify-between w-full flex-wrap",
    callInfo: "gap-2 flex-wrap",
    callDetails: "items-center gap-4 text-white flex-wrap",
    callType: "items-center gap-2 whitespace-nowrap flex-shrink-0",
    duration: "items-center gap-2 whitespace-nowrap flex-shrink-0",
    actions: "gap-2 items-center flex-shrink-0",
    mainContent: "gap-2 w-full",
    loading: "flex flex-col gap-2",
  },
} as const;
