import React, { useCallback, useRef, useMemo } from 'react';
import { useEditor, EditorContent, Extension } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import Heading from '@tiptap/extension-heading';
import Highlight from '@tiptap/extension-highlight';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import Code from '@tiptap/extension-code';
import CodeBlock from '@tiptap/extension-code-block';
import ToolBar from './ToolBar';
import { marked } from 'marked';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import Link from '@tiptap/extension-link';

import ResizeImage from 'tiptap-extension-resize-image';

// Advanced formatting extensions (install these as needed)
import Strike from '@tiptap/extension-strike';
import Underline from '@tiptap/extension-underline';
import Superscript from '@tiptap/extension-superscript';


import Dropcursor from '@tiptap/extension-dropcursor';
import Gapcursor from '@tiptap/extension-gapcursor';
import Placeholder from '@tiptap/extension-placeholder';
import Focus from '@tiptap/extension-focus';
import Typography from '@tiptap/extension-typography';

import {
  Hyperlink,
} from "@docs.plus/extension-hyperlink";

import './hyperlink.css';

const CustomHeading = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      style: {
        default: null,
        renderHTML: (attributes) => {
          const { level } = attributes;
          const levelStyles = {
            1: 'font-size: 1.25rem; font-weight: bold; margin-top: 0.75rem; margin-bottom: 0.5rem; color: #3C587F; font-family: Arial, sans-serif;', // 20px equivalent
            2: 'font-size: 1.125rem; font-weight: bold; margin-top: 0.75rem; margin-bottom: 0.5rem; color: #3C587F; font-family: Arial, sans-serif;', // 18px equivalent
            3: 'font-size: 1rem; font-weight: bold; margin-top: 0.75rem; margin-bottom: 0.5rem; color: #3C587F; font-family: Arial, sans-serif;', // 16px equivalent
          };
          return {
            style: levelStyles[level] || 'font-weight: bold; margin-top: 0.75rem; margin-bottom: 0.5rem; color: #3C587F; font-family: Arial, sans-serif;',
          };
        },
      },
    };
  },
});

const CustomCode = Code.extend({
  renderHTML({ HTMLAttributes }) {
    return [
      'code',
      {
        style: 'background-color: #f3f4f6; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.875rem; color: #374151; font-family: Arial, sans-serif;',
        ...HTMLAttributes,
      },
      0,
    ];
  },
});

const CustomCodeBlock = CodeBlock.extend({
  renderHTML({ HTMLAttributes }) {
    return [
      'pre',
      {
        style: 'display: block; padding: 0.75rem; border-radius: 0.5rem; margin-bottom: 0.75rem; font-size: 0.875rem; overflow-x: auto; white-space: pre-wrap; word-break: break-word; border: 1px solid #3C587F; background-color: #f9fafb; color: #374151; font-family: Arial, sans-serif;',
        ...HTMLAttributes,
      },
      ['code', {}, 0],
    ];
  },
});

const CustomTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      style: {
        default: 'min-width: 100%; border-collapse: collapse; border-spacing: 0; border: 1px solid #3C587F; font-family: Arial, sans-serif; font-size: 10pt;',
      },
    };
  },
});

const CustomTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      style: {
        default: 'border: 1px solid #3C587F; background-color: #f9fafb; padding: 0.5rem; text-align: left; font-weight: bold; color: #3C587F; font-family: Arial, sans-serif; font-size: 10pt;',
      },
    };
  },
});

const CustomTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      style: {
        default: 'border: 1px solid #3C587F; padding: 0.5rem; font-family: Arial, sans-serif; font-size: 10pt;',
      },
    };
  },
});

const CustomParagraph = Extension.create({
  name: 'customParagraph',
  
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph'],
        attributes: {
          style: {
            default: 'font-size: 0.875rem; margin-bottom: 0.5rem; margin-top: 0; line-height: 1.625; font-family: Arial, sans-serif;',
            renderHTML: attributes => {
              return {
                style: attributes.style,
              };
            },
          },
        },
      },
    ];
  },
});

// TemporaryHighlight and LinkTooltip extensions removed due to performance issues

// Memoize extensions array outside component to prevent recreation on every render
const getExtensions = () => {
  const extensions = [
    StarterKit.configure({
      heading: false,
      code: false,
      codeBlock: false,
      strike: false,
    }),
    
    CustomParagraph,
    CustomHeading.configure({
      levels: [1, 2, 3, 4, 5, 6],
    }),
    TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),
    CustomCode,
    CustomCodeBlock,
    OrderedList.configure({
      HTMLAttributes: {
        style: 'list-style-type: decimal; margin-left: 1.25rem; font-size: 0.875rem; margin-bottom: 0.5rem; font-family: Arial, sans-serif;',
      },
    }),
    BulletList.configure({
      HTMLAttributes: {
        style: 'list-style-type: disc; margin-left: 1.25rem; font-size: 0.875rem; margin-bottom: 0.5rem; font-family: Arial, sans-serif;',
      },
    }),
    Highlight,
    ResizeImage.configure({
      inline: false,
      allowBase64: true,
      HTMLAttributes: {
        style: 'max-width: 100%; height: auto; display: block; margin: 0.5rem auto;',
      },
    }),
    Strike.configure({
      HTMLAttributes: {
        style: 'text-decoration: line-through;',
      },
    }),
    Underline,
    Superscript,
    CustomTable.configure({
      resizable: true,
      HTMLAttributes: {
        style: 'min-width: 100%; border-collapse: collapse; border-spacing: 0;',
      },
    }),
    TableRow,
    TableHeader,
    CustomTableCell,
    Link.configure({
      HTMLAttributes: {
        style: 'color: #2563eb; text-decoration: underline; font-family: Arial, sans-serif; cursor: pointer;',
      },
      openOnClick: false,
      autolink: true,
      defaultProtocol: 'https',
      protocols: ['http', 'https'],
    }),
    Hyperlink.configure({
      HTMLAttributes: {
        style: 'color: #2563eb; text-decoration: underline; font-family: Arial, sans-serif; cursor: pointer;',
      },
      openOnClick: true,
    }),
    Dropcursor.configure({
      color: '#3C587F',
      width: 2,
    }),
    Gapcursor,
    Placeholder.configure({
      placeholder: 'Start typing your content...',
      emptyEditorClass: 'is-editor-empty',
    }),
    Focus.configure({
      className: 'has-focus',
      mode: 'all',
    }),
    Typography.configure({
      openDoubleQuote: '"',
      closeDoubleQuote: '"',
      openSingleQuote: "'",
      closeSingleQuote: "'",
      emDash: '—',
      ellipsis: '…',
      copyright: '©',
      trademark: '™',
      registeredTrademark: '®',
      oneHalf: '½',
      oneQuarter: '¼',
      threeQuarters: '¾',
      plusMinus: '±',
      notEqual: '≠',
      laquo: '«',
      raquo: '»',
      multiplication: '×',
      superscriptTwo: '²',
      superscriptThree: '³',
    }),
  ];
  
  return extensions;
};

// Cache extensions array - only create once
const extensions = getExtensions();

const RichTextEditor = React.memo(function RichTextEditor({
  content,
  onChange,
  disabled = false,
  highlightClass = '',
}: {
  content: string;
  onChange: (content: string) => void;
  disabled?: boolean;
  highlightClass?: string;
}) {
  
  // Debounce the onChange callback to reduce re-renders during image resizing
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  const debouncedOnChange = useCallback((newContent: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      const newContentLength = newContent?.length || 0;
      const lastContentLength = lastContentPropLengthRef.current;
      
      // Guard: If we're currently loading content, ignore onChange
      if (isLoadingContentRef.current) {
       
        return;
      }
      
      // Guard: If new content is suspiciously small compared to last content prop, ignore it
      // This prevents small placeholder/empty content from overwriting large documents
      // Threshold: if new content is less than 10% of last content and last content was > 1000 chars
      if (lastContentLength > 1000 && newContentLength < lastContentLength * 0.1) {
        console.warn('[TipTap] Content changed (debounced) - IGNORED (suspicious size)', { 
          newContentLength,
          lastContentLength,
          ratio: (newContentLength / lastContentLength * 100).toFixed(2) + '%',
          reason: 'new content is suspiciously small compared to last content'
        });
        return;
      }
      
      
      onChange(newContent);
    }, 150); // 150ms debounce - adjust as needed
  }, [onChange]);

  // Helper function to detect if content is already HTML
  const isHTML = (str: string): boolean => {
    if (!str || str.trim().length === 0) {
     
      return false;
    }
    const trimmed = str.trim();

    // Check if content starts with HTML tags (more robust check)
    // Look for common HTML tags at the start: <p>, <div>, <h1>, etc.
    const htmlTagPattern = /^\s*<(p|div|h[1-6]|ul|ol|li|span|strong|em|a|img|table|tr|td|th|blockquote|pre|code|br|hr)[\s>]/i;

    // Check if content starts with markdown patterns - if so, treat as markdown
    // This takes priority over HTML structure detection to handle mixed content
    const markdownStartPattern = /^\s*(#{1,6}\s|[-*+]\s|\d+\.\s|>\s|```|!\[|\[)/;
    const startsWithMarkdown = markdownStartPattern.test(trimmed);

    if (startsWithMarkdown) {
     
      return false;
    }

    // Only treat as HTML if it starts with an HTML tag
    const startsWithHtmlTag = htmlTagPattern.test(trimmed);
    
    return startsWithHtmlTag;
  };

  // Memoize parsed content to avoid re-parsing on every render
  // For large content, parse asynchronously to prevent blocking
  const [parsedContent, setParsedContent] = React.useState<string>('');
  
  React.useEffect(() => {
    const contentLength = content?.length || 0;
    // Update content length ref when content prop changes
    if (contentLength !== lastContentPropLengthRef.current) {
     
      lastContentPropLengthRef.current = contentLength;
    }
    
    if (!content) {
      setParsedContent('');
      lastContentPropLengthRef.current = 0;
      return;
    }
    
    // If content is already HTML (from editor), use it directly
    if (isHTML(content)) {
      setParsedContent(content);
      return;
    }
    
    // Otherwise, parse as markdown
    const parseContent = async () => {
      const startTime = performance.now();
      try {
        const result = marked(content);
        // Handle both sync and async results
        const parsed = typeof result === 'string' ? result : await result;
        const endTime = performance.now();
       
        setParsedContent(parsed);
      } catch (error) {
        console.error('[TipTap] Error parsing markdown:', error);
        setParsedContent(content);
      }
    };
    
    // For small content, parse immediately
    if (content.length < 50000) {
      parseContent();
    } else {
      // For large content, parse asynchronously to prevent blocking
      const timeoutId = setTimeout(() => {
        parseContent();
      }, 0);
      
      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [content]);

  // Use ref to store editor for handlers
  const editorRef = useRef<any>(null);
  // Track last content prop to avoid unnecessary updates
  const lastContentPropRef = useRef<string>('');
  // Track last parsed content to detect when it becomes available
  const lastParsedContentRef = useRef<string>('');
  // Track last content prop length to detect suspicious content loss
  const lastContentPropLengthRef = useRef<number>(0);
  // Track if we're currently loading content to prevent onChange during load
  const isLoadingContentRef = useRef<boolean>(false);

  // Memoize editor props handlers - use ref to access editor
  const handleDrop = useCallback((view: any, event: DragEvent, slice: any, moved: boolean) => {
    
    if (!moved && event.dataTransfer?.files?.[0]) {
      const file = event.dataTransfer.files[0];
      
      // Strict image validation
      const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
      
      if (allowedImageTypes.includes(file.type)) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = e.target?.result as string;
          if (img && editorRef.current) {
            editorRef.current.chain().focus().setImage({ src: img }).run();
          } else {
            console.warn('[TipTap] Failed to load image or editor not available');
          }
        };
        reader.onerror = (error) => {
          console.error('[TipTap] Error reading dropped file:', error);
        };
        reader.readAsDataURL(file);
        return true;
      } else {
        // Show error message for invalid file types
        console.warn('[TipTap] Invalid file type dropped:', { fileType: file.type, fileName: file.name });
        return false;
      }
    }
    return false;
  }, []);

  const handlePaste = useCallback((view: any, event: ClipboardEvent) => {
    const items = Array.from(event.clipboardData?.items || []);
    
    // Strict image validation for paste
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    const imageItem = items.find(item => allowedImageTypes.includes(item.type));
    
    if (imageItem) {
      event.preventDefault();
      const file = imageItem.getAsFile();
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = e.target?.result as string;
          if (img && editorRef.current) {
            editorRef.current.chain().focus().setImage({ src: img }).run();
          } else {
            console.warn('[TipTap] Failed to load pasted image or editor not available');
          }
        };
        reader.onerror = (error) => {
          console.error('[TipTap] Error reading pasted file:', error);
        };
        reader.readAsDataURL(file);
        return true;
      } else {
        console.warn();
      }
    } else {
      console.log();
    }
    return false;
  }, []);

  const handleClick = useCallback((view: any, pos: number, event: MouseEvent) => {
    const target = event.target as HTMLElement;
    
    // Check if the clicked element is an image or inside an image
    const imageElement = target.closest('img');
    
    if (imageElement && editorRef.current) {
      // Blur the editor when image is clicked
      editorRef.current.commands.blur();
      return true;
    }
    
    return false;
  }, []);

  // Memoize editor props to prevent recreation
  const editorProps = useMemo(() => ({
    attributes: {
      style: 'border-radius: 0.375rem; background-color: #f8fafc; padding: 1.25rem; outline: none; font-size: 0.875rem; line-height: 1.625; font-family: Arial, sans-serif;',
    },
    handleDrop,
    handlePaste,
    handleClick,
  }), [handleDrop, handlePaste, handleClick]);

  // Track selection updates to trigger toolbar re-renders
  const [selectionUpdateKey, setSelectionUpdateKey] = React.useState(0);
  const toolbarUpdateTimeoutRef = useRef<NodeJS.Timeout>();

  // Debounced function to update toolbar
  const updateToolbar = useCallback(() => {
    if (toolbarUpdateTimeoutRef.current) {
      clearTimeout(toolbarUpdateTimeoutRef.current);
    }
    toolbarUpdateTimeoutRef.current = setTimeout(() => {
      setSelectionUpdateKey((prev) => prev + 1);
    }, 50); // Small delay to batch updates
  }, []);

  // Initialize editor with empty content for faster initialization
  const editor = useEditor({
    extensions,
    content: '', // Start with empty content for faster initialization
    editorProps,
    onUpdate: ({ editor }) => {
      const htmlContent = editor.getHTML();
      const lastContentLength = lastContentPropLengthRef.current;
      const isCurrentlyLoading = isLoadingContentRef.current;
      
      if (!disabled && !isCurrentlyLoading) {
        debouncedOnChange(htmlContent);
      } else if (isCurrentlyLoading) {
        console.log();
      }
      
      // Trigger toolbar update on content changes (e.g., when clicking on text)
      updateToolbar();
    },
    onSelectionUpdate: () => {
      console.log();
      // Trigger re-render of toolbar when selection changes
      updateToolbar();
    },
    onCreate: ({ editor }) => {
      console.log();
    },
    onDestroy: () => {
      console.log();
    },
    editable: !disabled,
  });

  // Update editor ref when editor changes
  React.useEffect(() => {
    if (editor) {
      editorRef.current = editor;
    }
  }, [editor]);

  // Add click listener to blur editor when image is clicked
  React.useEffect(() => {
    if (!editor) return;

    const handleImageClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Check if the clicked element is an image or inside an image
      const imageElement = target.closest('img');
      
      if (imageElement) {
        // Blur the editor when image is clicked
        editor.commands.blur();
      }
    };

    const editorElement = editor.view.dom;
    editorElement.addEventListener('click', handleImageClick);

    return () => {
      editorElement.removeEventListener('click', handleImageClick);
    };
  }, [editor]);

  // Load content into editor after initialization (optimized for large documents)
  React.useEffect(() => {
    if (!editor) {
      return;
    }
    
    const contentIsHTML = isHTML(content);
    
    // If content is HTML, use it directly (no parsing needed)
    if (contentIsHTML) {
      const contentChanged = content !== lastContentPropRef.current;
      const editorContent = editor.getHTML();
      
      if (contentChanged && content !== editorContent) {
        // Set loading flag to prevent onChange from firing during load
        isLoadingContentRef.current = true;
        
        // Use setContent with emitUpdate: false for better performance on large docs
        // This prevents triggering onChange during initial load, reducing unnecessary re-renders
        editor.commands.setContent(content, false);
        lastContentPropRef.current = content;
        lastParsedContentRef.current = content;
        lastContentPropLengthRef.current = content.length;
        
        // Clear loading flag after a short delay to allow editor to settle
        setTimeout(() => {
          isLoadingContentRef.current = false;
        }, 200);
        
      } else {
        console.log();
      }
      return;
    }
    
    // For markdown content, wait for parsing
    // If content exists but parsedContent isn't ready yet, wait for it
    if (content && content.length > 0 && !parsedContent) {
      return;
    }
    
    // Update editor when:
    // 1. Content prop has changed, OR
    // 2. ParsedContent has become available (even if content prop hasn't changed)
    const contentChanged = content !== lastContentPropRef.current;
    const parsedContentBecameAvailable = parsedContent && parsedContent !== lastParsedContentRef.current;
    const parsedContentReady = parsedContent && parsedContent.length > 0;
    const editorContent = editor.getHTML();
    
    if ((contentChanged || parsedContentBecameAvailable) && parsedContentReady && parsedContent !== editorContent) {
      // Set loading flag to prevent onChange from firing during load
      isLoadingContentRef.current = true;
      
      // Use setContent with emitUpdate: false for better performance on large docs
      // This prevents triggering onChange during initial load, reducing unnecessary re-renders
      editor.commands.setContent(parsedContent, false);
      lastContentPropRef.current = content;
      lastParsedContentRef.current = parsedContent;
      lastContentPropLengthRef.current = parsedContent.length;
      
      // Clear loading flag after a short delay to allow editor to settle
      setTimeout(() => {
        isLoadingContentRef.current = false;
      }, 200);
      
    } else {
      console.log();
    }
  }, [content, parsedContent, editor]);

  // Reset highlights when content changes
  // useEffect(() => {
  //   if (editor) {
  //     editor.commands.focus('end');
  //     editor.commands.blur();
  //   }
  // }, [content, editor]);

  React.useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled);
    }
  }, [disabled, editor]);

  // Cleanup timeouts on unmount
  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (toolbarUpdateTimeoutRef.current) {
        clearTimeout(toolbarUpdateTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
      }}
      style={{ 
        fontFamily: 'Arial, sans-serif',
        maxWidth: 'none',
        fontSize: '0.875rem',
        lineHeight: '1.25rem'
      }}
    >
      {!disabled && <ToolBar editor={editor} selectionUpdateKey={selectionUpdateKey} />}
      <EditorContent
        editor={editor}
        style={{ 
          fontFamily: 'Arial, sans-serif',
          outline: 'none'
        }}
      />
    </div>
  );
});

export default RichTextEditor;
