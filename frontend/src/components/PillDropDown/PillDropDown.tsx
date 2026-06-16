"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDownIcon, CheckIcon } from "@radix-ui/react-icons";

export type DropdownItem = {
  id: number;
  title: string;
  imageLink?: string;
  image?: React.JSX.Element;
};

interface Props {
  items?: DropdownItem[];
  image?: React.JSX.Element;
  pillPlaceholder?: string;
  placeholder?: string;
  onClick?: (item: DropdownItem) => void;
  disable?: boolean;
  multiSelect?: boolean;
  className?: string;
  selectedItems?: DropdownItem[];
  onSelectionChange?: (items: DropdownItem[]) => void;
}

const PillDropDown: React.FC<Props> = ({
  items = [],
  image,
  pillPlaceholder = "",
  placeholder = "",
  onClick,
  disable = false,
  multiSelect = false,
  className = "",
  selectedItems = [],
  onSelectionChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredItems, setFilteredItems] = useState(items);
  const [internalSelectedItems, setInternalSelectedItems] = useState<DropdownItem[]>(selectedItems);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, bottom: 0, left: 0, width: 0, openUpward: false });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Use external selectedItems if provided, otherwise use internal state
  const currentSelectedItems = selectedItems.length > 0 ? selectedItems : internalSelectedItems;

  useEffect(() => {
    if (searchTerm) {
      const filtered = items?.filter((item) =>
        item.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredItems(filtered);
    } else {
      setFilteredItems(items);
    }
  }, [searchTerm, items]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // Check if click is outside both dropdown and button
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const updateDropdownPosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const maxDropdownHeight = 288; // max-h-72 = 18rem = 288px
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;

      // Open upward if not enough space below but enough space above
      const openUpward = spaceBelow < maxDropdownHeight && spaceAbove > spaceBelow;

      setDropdownPosition({
        top: rect.bottom + 4, // Used when opening downward
        bottom: viewportHeight - rect.top + 4, // Used when opening upward
        left: rect.left,
        width: rect.width,
        openUpward,
      });
    }
  }, []);

  const toggleOpen = useCallback(() => {
    if (disable) return;
    if (!isOpen) {
      updateDropdownPosition();
    }
    setIsOpen(!isOpen);
  }, [disable, isOpen, updateDropdownPosition]);

  const handleClick = useCallback(
    (item: DropdownItem) => {
      const isChecked = currentSelectedItems.some(
        (selected) => selected.id === item.id
      );
      let updatedSelectedItems;

      if (isChecked) {
        updatedSelectedItems = currentSelectedItems.filter(
          (selected) => selected.id !== item.id
        );
      } else {
        updatedSelectedItems = [...currentSelectedItems, item];
      }

      // Update internal state if no external selectedItems provided
      if (selectedItems.length === 0) {
        setInternalSelectedItems(updatedSelectedItems);
      }

      // Call external handler if provided
      if (onSelectionChange) {
        onSelectionChange(updatedSelectedItems);
      }

      if (onClick) onClick(item);
      if (!multiSelect) setIsOpen(false);
    },
    [currentSelectedItems, onClick, multiSelect, selectedItems.length, onSelectionChange]
  );

  const getDisplayText = () => {
    if (currentSelectedItems.length === 0) {
      return pillPlaceholder;
    }
    if (multiSelect) {
      return `${currentSelectedItems.length} selected`;
    }
    return currentSelectedItems[0]?.title || pillPlaceholder;
  };

  const hasSelection = currentSelectedItems.length > 0;

  const dropdownMenu = isOpen && typeof document !== 'undefined' ? createPortal(
    <AnimatePresence>
      <motion.div
        ref={dropdownRef}
        style={{
          position: 'fixed',
          ...(dropdownPosition.openUpward
            ? { bottom: `${dropdownPosition.bottom}px` }
            : { top: `${dropdownPosition.top}px` }
          ),
          left: `${dropdownPosition.left}px`,
          minWidth: '14rem',
        }}
        className="max-h-72 bg-white shadow-lg rounded-md overflow-hidden z-[99999]"
        initial={{ opacity: 0, y: dropdownPosition.openUpward ? 10 : -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: dropdownPosition.openUpward ? 10 : -10 }}
        transition={{ duration: 0.3 }}
      >
            {/* Search Input */}
            <input
              type="text"
              className="w-full px-3 py-2 border-none border-b border-gray-200 outline-none text-sm placeholder-gray-500"
              placeholder={placeholder || "Search..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            {/* Items List */}
            <div className="max-h-60 overflow-y-auto py-1">
              {filteredItems?.map((item, index) => {
                const isChecked = currentSelectedItems.some(
                  (selected) => selected.id === item.id
                );
                
                return (
                  <div
                    onClick={() => handleClick(item)}
                    key={item.id}
                    className={`
                      flex items-center gap-2 h-8 px-3 transition-colors duration-200 rounded-md mx-1 cursor-pointer
                      ${isChecked ? 'bg-blue-50 border border-blue-200' : ''}
                      hover:bg-gray-50
                    `}
                  >
                    <div className="flex items-center gap-2 flex-1">
                      {multiSelect && (
                        <div className="flex-shrink-0 relative">
                          <input
                            type="checkbox"
                            className={`
                              w-3.5 h-3.5 rounded border-2 transition-all duration-200
                              ${isChecked 
                                ? 'bg-blue-600 border-blue-600' 
                                : 'bg-transparent border-gray-300'
                              }
                            `}
                            checked={isChecked}
                            readOnly
                          />
                          {isChecked && (
                            <CheckIcon className="w-3 h-3 text-white absolute top-0 left-0 pointer-events-none" />
                          )}
                        </div>
                      )}
                      {item?.image && (
                        <span className="flex-shrink-0">{item.image}</span>
                      )}
                      <span className={`text-sm flex-grow ${
                        isChecked ? 'text-gray-900 font-medium' : 'text-gray-700'
                      }`}>
                        {item.title}
                      </span>
                    </div>
                    
                    {!multiSelect && (
                      <div className="flex items-center justify-end gap-2">
                        {isChecked && (
                          <CheckIcon className="w-4 h-4 text-blue-600" />
                        )}
                        <span className="text-xs text-gray-400 scale-y-95">
                          {index + 1}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  ) : null;

  return (
    <>
      <div className={`relative inline-block ${className}`}>
        {/* Pill Button */}
        <button
          ref={buttonRef}
          className={`
            flex items-center gap-2 min-w-fit max-w-40 h-8 rounded-lg border transition-colors duration-300
            px-3 py-2 cursor-pointer select-none
            hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-neutral-l2 focus:ring-opacity-50
            ${hasSelection 
              ? 'border-gray-400 bg-gray-50' 
              : 'border-gray-300 bg-transparent'
            }
            ${disable ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          onClick={toggleOpen}
          disabled={disable}
        >
          {image && <span className="flex-shrink-0">{image}</span>}
          <span className={`text-sm whitespace-nowrap flex-1 text-left ${
            hasSelection ? 'text-gray-900 font-medium' : 'text-gray-500'
          }`}>
            {getDisplayText()}
          </span>
          <ChevronDownIcon 
            className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`} 
          />
        </button>
      </div>
      {dropdownMenu}
    </>
  );
};

export default PillDropDown;
