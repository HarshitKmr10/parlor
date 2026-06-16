/**
 * ChatWidget Styles
 * 
 * Contains all styling for the floating chat widget
 */

export const chatWidgetStyles = {
  // Floating widget container
  floatingWidget: "fixed z-50 bottom-0 right-0 m-4",
  
  // Widget button (collapsed state) - Figma specs: 64x64, #5B5BD6, specific shadow
  widgetButton: "w-16 h-16 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 hover:scale-110",
  
  // Widget icon
  widgetIcon: "w-8 h-8 text-white",
  
  // Floating window (expanded state)
  floatingWindow: "fixed bottom-24 right-6 w-96 h-[634px] bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden",
  
  // Window header
  windowHeader: "flex items-center gap-3 p-4 border-b border-gray-200 bg-white",
  
  // Header icon
  headerIcon: "w-8 h-8 text-purple-600",
  
  // Header text
  headerText: "text-lg font-bold text-gray-900",
  
  // Chat content area
  chatContent: "flex-1 overflow-y-auto p-4",
  
  // Welcome message
  welcomeMessage: "text-2xl font-bold text-gray-900 mb-2",
  
  // Subtitle
  subtitle: "text-gray-600 mb-4",
  
  // Prompt text
  promptText: "text-sm text-gray-500 mb-6",
  
  // Suggested questions
  suggestedQuestions: "space-y-3 mb-6 mt-2",
  
  // Suggested question item
  suggestedQuestion: "flex items-center justify-between p-3  hover:bg-purple-50 rounded-lg cursor-pointer transition-colors duration-200",
  
  // Suggested question text
  suggestedQuestionText: "text-sm text-gray-700",
  
  // Arrow icon
  arrowIcon: "w-4 h-4 text-gray-400",
  
  // Ask section
  askSection: "bg-[#5B5BD6] bg-cover bg-center p-4 rounded-lg mb-6 relative overflow-hidden cursor-pointer hover:opacity-90 transition-opacity",
  
  // Ask section pattern
  askSectionPattern: "absolute inset-0 opacity-10",
  
  // Ask section content
  askSectionContent: "relative z-10 flex flex-col",
  
  // Ask section title
  askSectionTitle: "text-white font-bold text-sm mb-1",
  
  // Ask section subtitle
  askSectionSubtitle: "text-purple-100 text-sm",
  
  // Question mark icon
  questionMarkIcon: "absolute bottom-2 right-2 w-6 h-6 text-white opacity-50",
  
  // Input container
  inputContainer: "flex gap-2 p-4 border-t border-gray-200 bg-white",
  
  // Input field
  inputField: "flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent",
  
  // Send button
  sendButton: "w-10 h-10 bg-purple-600 hover:bg-purple-700 rounded-lg flex items-center justify-center text-white transition-colors duration-200",
  
  // Send icon
  sendIcon: "w-5 h-5",
  
  // Close button
  closeButton: "absolute top-4 right-4 w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center cursor-pointer transition-colors duration-200",
  
  // Close icon
  closeIcon: "w-4 h-4 text-gray-600",
  
  // Animation variants
  animationVariants: {
    collapsed: {
      scale: 1,
      opacity: 1,
    },
    expanded: {
      scale: 1,
      opacity: 1,
    },
    hidden: {
      scale: 0.8,
      opacity: 0,
    }
  }
} as const;
