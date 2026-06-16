'use client';

import * as React from 'react';
import {
  List, Heading1, Heading2, Heading3, Code, Bold, Italic, ListOrdered, ImageIcon,
  Strikethrough, Underline, 
   AlignLeft, AlignCenter, AlignRight, Link2
} from 'lucide-react';

import { cva } from 'class-variance-authority';
import * as TogglePrimitive from '@radix-ui/react-toggle';
import * as Tooltip from '@radix-ui/react-tooltip';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const toggleVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-muted hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-transparent data-[state=on]:bg-blue-100 data-[state=on]:text-blue-700',
        outline:
          'border border-input bg-transparent shadow-sm hover:bg-[var(--accent-9)] hover:text-accent-foreground data-[state=on]:bg-blue-100 data-[state=on]:text-blue-700',
      },
      size: {
        default: 'h-9 px-3',
        sm: 'h-8 px-2',
        lg: 'h-10 px-3',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

const Toggle = React.forwardRef(
  ({
    className, variant, size, ...props
  }, ref) => (
    <TogglePrimitive.Root
      ref={ref}
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  ),
);

export default function ToolBar({ editor, selectionUpdateKey = 0 }) {
  const imageInputRef = React.useRef(null);

  // Note: All hooks must be called before any early returns
  // The useMemo below will handle the case when editor is null

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0];

    if (file) {
      // Strict image validation
      const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
      
      if (allowedImageTypes.includes(file.type)) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = e.target?.result;
          if (img) {
            editor.chain().focus().setImage({ src: img }).run();
          }
        };
        reader.readAsDataURL(file);
      } else {
        // Show error for invalid file types
        alert(`Invalid file type: ${file.type}\nOnly image files (JPEG, PNG, GIF, WebP, SVG) are allowed.`);
      }
    }
    // Reset input value to allow uploading the same image again
    event.target.value = '';
  };

  const handleLink = React.useCallback(() => {
    if (!editor) return;
    
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('Enter URL:', previousUrl || 'https://');

    // cancelled
    if (url === null) {
      return;
    }

    // empty
    if (url === '' || url === 'https://') {
      editor.chain().focus().unsetLink().run();
      return;
    }

    // Add protocol if missing
    let finalUrl = url;
    if (!url.match(/^https?:\/\//)) {
      finalUrl = `https://${url}`;
    }

    // Check if text is selected
    const { from, to } = editor.state.selection;
    const hasSelection = from !== to;

    if (hasSelection) {
      // If text is selected, make it a link
      editor.chain().focus().setLink({ href: finalUrl }).run();
    } else {
      // If no text selected, insert a link with the URL as text
      editor.chain().focus().insertContent(`<a href="${finalUrl}">${finalUrl}</a>`).run();
    }
  }, [editor]);

  // Re-evaluate Options array when selection changes (selectionUpdateKey changes)
  // This ensures active states are updated when user selects different elements
  const Options = React.useMemo(() => {
    // Early return if no editor
    if (!editor) return [];
    
    return [
    // Headings
    {
      icon: <Heading1 className="size-4" />,
      onClick: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      preesed: editor.isActive('heading', { level: 1 }),
      tooltip: 'Heading 1',
    },
    {
      icon: <Heading2 className="size-4" />,
      onClick: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      preesed: editor.isActive('heading', { level: 2 }),
      tooltip: 'Heading 2',
    },
    {
      icon: <Heading3 className="size-4" />,
      onClick: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      preesed: editor.isActive('heading', { level: 3 }),
      tooltip: 'Heading 3',
    },
    
    // Text formatting
    {
      icon: <Bold className="size-4" />,
      onClick: () => editor.chain().focus().toggleBold().run(),
      preesed: editor.isActive('bold'),
      tooltip: 'Bold (Ctrl+B)',
    },
    {
      icon: <Italic className="size-4" />,
      onClick: () => editor.chain().focus().toggleItalic().run(),
      preesed: editor.isActive('italic'),
      tooltip: 'Italic (Ctrl+I)',
    },
    {
      icon: <Strikethrough className="size-4" />,
      onClick: () => editor.chain().focus().toggleStrike().run(),
      preesed: editor.isActive('strike'),
      tooltip: 'Strikethrough',
    },
    {
      icon: <Underline className="size-4" />,
      onClick: () => editor.chain().focus().toggleUnderline().run(),
      preesed: editor.isActive('underline'),
      tooltip: 'Underline (Ctrl+U)',
    },
    
    {
      icon: <span className="text-xs">X²</span>,
      onClick: () => editor.chain().focus().toggleSuperscript().run(),
      preesed: editor.isActive('superscript'),
      tooltip: 'Superscript',
    },
    
    // Text alignment
    {
      icon: <AlignLeft className="size-4" />,
      onClick: () => editor.chain().focus().setTextAlign('left').run(),
      preesed: editor.isActive({ textAlign: 'left' }),
      tooltip: 'Align Left',
    },
    {
      icon: <AlignCenter className="size-4" />,
      onClick: () => editor.chain().focus().setTextAlign('center').run(),
      preesed: editor.isActive({ textAlign: 'center' }),
      tooltip: 'Align Center',
    },
    {
      icon: <AlignRight className="size-4" />,
      onClick: () => editor.chain().focus().setTextAlign('right').run(),
      preesed: editor.isActive({ textAlign: 'right' }),
      tooltip: 'Align Right',
    },

    // Lists
    {
      icon: <List className="size-4" />,
      onClick: () => editor.chain().focus().toggleBulletList().run(),
      preesed: editor.isActive('bulletList'),
      tooltip: 'Bullet List',
    },
    {
      icon: <ListOrdered className="size-4" />,
      onClick: () => editor.chain().focus().toggleOrderedList().run(),
      preesed: editor.isActive('orderedList'),
      tooltip: 'Numbered List',
    },
    // Code
    {
      icon: <Code className="size-4" />,
      onClick: () => editor.chain().focus().toggleCodeBlock().run(),
      preesed: editor.isActive('codeBlock'),
      tooltip: 'Code Block',
    },
    
    // Media
    {
      icon: <ImageIcon className="size-4" />,
      onClick: () => imageInputRef.current?.click(),
      preesed: false,
      tooltip: 'Insert Image',
    },

    // Links
    {
      icon: <Link2 className="size-4" />,
      onClick: () => {
        if (editor.isActive('link')) {
          // If already a link, remove it
          editor.chain().focus().unsetLink().run();
        } else {
          // If not a link, add one
          handleLink();
        }
      },
      preesed: editor.isActive('link'),
      tooltip: editor.isActive('link') ? 'Remove Link' : 'Insert Link',
    },
    
    ];
  }, [editor, selectionUpdateKey, handleLink]);

  // Early return after all hooks (React rules: hooks must be called in same order)
  if (!editor) return null;

  return (
    <Tooltip.Provider>
      <div className="border rounded-md p-1.5 mb-1 bg-slate-50 gap-1 sticky top-0 z-50 bg-white flex flex-wrap">
        {Options.map((option, i) => (
          <Tooltip.Root key={i}>
            <Tooltip.Trigger asChild>
              <Toggle
                size="sm"
                pressed={option.preesed}
                onPressedChange={option.onClick}
              >
                {option.icon}
              </Toggle>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                className="bg-gray-900 text-white px-2 py-1 text-xs rounded shadow-lg z-50"
                sideOffset={5}
              >
                {option.tooltip}
                <Tooltip.Arrow className="fill-gray-900" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        ))}
        <input
          type="file"
          ref={imageInputRef}
          onChange={handleImageUpload}
          accept="image/*"
          className="hidden"
        />
      </div>
    </Tooltip.Provider>
  );
}
