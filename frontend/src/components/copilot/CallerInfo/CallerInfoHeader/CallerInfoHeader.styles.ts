/**
 * CallerInfoHeader Styles
 */

export const callerInfoHeaderStyles = {
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

  // Text styles
  text: {
    userName: "text-neutral-1 whitespace-nowrap overflow-hidden text-ellipsis",
    copyText: "text-neutral-1 cursor-pointer whitespace-nowrap overflow-hidden text-ellipsis",
  },

  // Icon styles
  icons: {
    copyIcon: "text-white transition-all duration-300",
    copyIconSuccess: "text-green-500 transition-all duration-300",
  },

  // Flex layouts
  flex: {
    header: "items-center w-full flex-wrap mb-1",
    userSection: "items-center flex-shrink flex-wrap min-w-0",
    copySection: "gap-1 items-center text-white cursor-pointer whitespace-nowrap flex-shrink-0",
  },
} as const;

