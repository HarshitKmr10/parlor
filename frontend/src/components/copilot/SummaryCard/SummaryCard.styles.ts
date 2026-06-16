/**
 * VVA Summary Card Styles
 * 
 * Contains all styling for the VVA Summary card component
 */

export const vvaSummaryCardStyles = {
  // Main card container
  card: "bg-gradient-to-r from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-4 mb-4",
  
  // Header section
  header: "flex justify-between items-center mb-3",
  
  // VVA Summary tag
  vvaTag: "bg-purple-500 text-white px-2 py-1 rounded-full flex items-center gap-1",
  
  // Tag icon
  tagIcon: "w-3 h-3",
  
  // Tag text
  tagText: "text-xs font-medium",
  
  // Wand icon
  wandIcon: "w-4 h-4 text-purple-500",
  
  // Content section
  content: "mb-4",
  
  // Title text
  title: "text-sm font-bold text-gray-900 mb-2 block",
  
  // Description text
  description: "text-xs text-gray-700",
  
  // Footer section
  footer: "flex justify-between items-center",
  
  // Category tag
  categoryTag: "bg-gray-100 border border-gray-300 text-gray-700 px-2 py-1 rounded-full",
  
  // Category text
  categoryText: "text-xs font-medium",
  
  // Assignee section
  assigneeSection: "flex items-center gap-2",
  
  // Assignee tag
  assigneeTag: "bg-gray-100 border border-gray-300 px-2 py-1 rounded-full flex items-center gap-2",
  
  // Avatar
  avatar: "w-5 h-5 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center",
  
  // Avatar text
  avatarText: "text-xs font-bold text-white",
  
  // Assignee name
  assigneeName: "text-xs font-medium text-gray-700",
  
  // More options icon
  moreIcon: "w-3 h-3 text-gray-400",
  
  // View ticket button
  viewTicketButton: "bg-black hover:bg-gray-800 text-white px-3 py-1 flex items-center gap-1",
  
  // Button text
  buttonText: "text-xs font-medium",
  
  // Arrow icon
  arrowIcon: "w-3 h-3"
} as const;
