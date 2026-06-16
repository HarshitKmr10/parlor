/**
 * CallerInfoDetails Styles
 */

export const callerInfoDetailsStyles = {
  // Details section styles
  details: {
    container: "w-full",
    infoContainer: "w-full",
    callInfo: "text-neutral-1",
    callTypeSection: "text-neutral-1",
    durationSection: "text-neutral-1",
  },

  // Text styles
  text: {
    callType: "text-neutral-1 whitespace-nowrap overflow-hidden text-ellipsis",
    duration: "text-neutral-1 whitespace-nowrap overflow-hidden text-ellipsis",
  },

  // Flex layouts
  flex: {
    callInfo: "gap-2 flex-wrap mb-1",
    callDetails: "items-center gap-4 text-neutral-1 flex-wrap",
    callType: "items-center gap-1 whitespace-nowrap flex-shrink-0",
    duration: "items-center gap-1 whitespace-nowrap flex-shrink-0",
  },
} as const;

