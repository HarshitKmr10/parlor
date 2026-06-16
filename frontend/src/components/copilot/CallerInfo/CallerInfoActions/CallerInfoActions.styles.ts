/**
 * CallerInfoActions Styles
 */

export const callerInfoActionsStyles = {
  // Action button styles
  actions: {
    // Base button style
    baseButton: "flex items-center justify-center gap-2 px-2 py-1 text-clamp-xs font-medium text-white bg-transparent border border-white rounded-md hover:bg-white hover:text-[var(--accent-9)] transition-colors duration-300 cursor-pointer whitespace-nowrap",
    
    // Disabled button style
    disabledButton: "flex items-center justify-center gap-2 px-2 py-1 text-clamp-xs font-medium text-white bg-transparent border border-white rounded-md hover:bg-white hover:text-[var(--accent-9)] transition-colors duration-300 cursor-pointer whitespace-nowrap disabled:cursor-not-allowed disabled:hover:bg-[var(--gray-11)] disabled:hover:text-white",
    
    // Button variants
    createDocument: "flex items-center justify-center gap-2 px-2 py-1 text-clamp-xs font-medium text-white bg-transparent border border-white rounded-md hover:bg-white hover:text-[var(--accent-9)] transition-colors duration-300 cursor-pointer whitespace-nowrap disabled:cursor-not-allowed disabled:hover:bg-[var(--gray-11)] disabled:hover:text-white",
    
    createIncident: "flex items-center justify-center gap-2 px-2 py-1 text-clamp-xs font-medium text-white bg-transparent border border-white rounded-md hover:bg-white hover:text-[var(--accent-9)] transition-colors duration-300 cursor-pointer whitespace-nowrap",
    
    postcall: "flex items-center justify-center gap-2 px-2 py-1 text-clamp-xs font-medium text-white bg-transparent border border-white rounded-md hover:bg-white hover:text-[var(--accent-9)] transition-colors duration-300 cursor-pointer whitespace-nowrap",
    
    endCall: "flex items-center justify-center gap-2 px-2 py-1 text-clamp-xs font-medium text-white bg-transparent border border-white rounded-md hover:bg-white hover:text-[var(--accent-9)] transition-colors duration-300 cursor-pointer whitespace-nowrap disabled:cursor-not-allowed disabled:hover:bg-[var(--gray-11)] disabled:hover:text-white",
  },

  // Flex layouts
  flex: {
    actions: "gap-2 items-center flex-shrink-0 flex-wrap",
  },
} as const;

