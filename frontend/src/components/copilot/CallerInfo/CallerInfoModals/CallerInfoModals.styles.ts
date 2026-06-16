/**
 * CallerInfoModals Styles
 */

export const callerInfoModalsStyles = {
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

  // Flex layouts
  flex: {
    loading: "flex flex-col gap-2",
  },
} as const;

