import React, { useState, useEffect, useRef } from 'react';
import { Flex, Text } from '@radix-ui/themes';
import { Cross2Icon, MagnifyingGlassIcon, CheckCircledIcon, ChevronDownIcon } from '@radix-ui/react-icons';

export interface MultiSelectOption {
  id: string;
  name: string;
  description?: string;
  [key: string]: any; // Allow additional properties
}

interface LockedItem {
  id: string;
  name: string;
}

// Stable default so useEffect dependency doesn't change every render
const EMPTY_LOCKED_ITEMS: LockedItem[] = [];

interface MultiSelectDropdownProps {
  options: MultiSelectOption[];
  selectedIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  label?: string;
  disabled?: boolean;
  isLoading?: boolean;
  emptyMessage?: string;
  noResultsMessage?: string;
  showSelectedCount?: boolean;
  className?: string;
  compactMode?: boolean; // Show count instead of chips in the trigger button
  lockedItems?: LockedItem[]; // Items that show as chips but can't be removed (e.g., auto-assigned roles)
}

const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  options,
  selectedIds,
  onSelectionChange,
  placeholder = 'Select items...',
  searchPlaceholder = 'Search...',
  label,
  disabled = false,
  isLoading = false,
  emptyMessage = 'No items available',
  noResultsMessage = 'No items found',
  showSelectedCount = true,
  className = '',
  compactMode = false,
  lockedItems = EMPTY_LOCKED_ITEMS,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState<MultiSelectOption[]>(options);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0, openUpward: false });
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Filter options based on search query and exclude locked items
  useEffect(() => {
    const lockedIds = new Set(lockedItems.map(item => item.id));
    // Exclude locked items from selectable options
    const availableOptions = options.filter(option => !lockedIds.has(option.id));

    if (searchQuery.trim() === '') {
      setFilteredOptions(availableOptions);
    } else {
      const filtered = availableOptions.filter(option =>
        option.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredOptions(filtered);
    }
  }, [options, searchQuery, lockedItems]);

  // Update dropdown position when it opens or window resizes
  useEffect(() => {
    const DROPDOWN_HEIGHT = 260; // Approximate height: search (56px) + list (200px max)

    const updatePosition = () => {
      if (triggerRef.current && showDropdown) {
        const rect = triggerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;

        // Open upward if not enough space below and more space above
        const openUpward = spaceBelow < DROPDOWN_HEIGHT && spaceAbove > spaceBelow;

        setDropdownPosition({
          top: openUpward ? rect.top - 4 : rect.bottom + 4,
          left: rect.left,
          width: rect.width,
          openUpward,
        });
      }
    };

    if (showDropdown) {
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
    }

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [showDropdown]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  const handleOptionSelect = (option: MultiSelectOption) => {
    if (selectedIds.includes(option.id)) {
      // Deselect if already selected
      onSelectionChange(selectedIds.filter(id => id !== option.id));
    } else {
      // Select if not selected
      onSelectionChange([...selectedIds, option.id]);
    }
    // Keep dropdown open and don't clear search
  };

  const handleRemoveOption = (optionId: string) => {
    onSelectionChange(selectedIds.filter(id => id !== optionId));
  };

  const getSelectedOptions = () => {
    return options.filter(option => selectedIds.includes(option.id));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowDropdown(false);
      setSearchQuery('');
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setShowDropdown(true);
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {!!label && (
        <Text as="label" size="2" weight="medium" className="mb-2 block">
          {label}
        </Text>
      )}

      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setShowDropdown(!showDropdown);
        }}
        disabled={disabled || isLoading}
        className="w-full px-3 py-2 rounded-md border border-[var(--gray-6)]
          text-sm focus:outline-none focus:ring-2 focus:ring-[var(--violet-8)]
          focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed
          bg-white min-h-[38px] flex items-center justify-between gap-2"
      >
        <div className="flex-1 flex items-center gap-2 flex-wrap min-h-[22px]">
          {selectedIds.length === 0 && lockedItems.length === 0 ? (
            <span className="text-gray-500">{placeholder}</span>
          ) : compactMode ? (
            <span className="text-[var(--blue-11)]">
              {selectedIds.length + lockedItems.length} role{(selectedIds.length + lockedItems.length) !== 1 ? 's' : ''} selected
            </span>
          ) : (
            <>
              {/* Locked items (non-removable, purple) */}
              {lockedItems.map((item) => (
                <Flex
                  key={`locked-${item.id}`}
                  align="center"
                  gap="1"
                  className="bg-[var(--violet-3)] text-[var(--violet-11)] border border-[var(--violet-6)] rounded-full px-2 py-0.5"
                >
                  <Text size="1" className="text-xs">{item.name}</Text>
                </Flex>
              ))}
              {/* Selected items (removable, blue) */}
              {getSelectedOptions().map((option) => (
                <Flex
                  key={option.id}
                  align="center"
                  gap="1"
                  className="bg-[var(--blue-3)] text-[var(--blue-11)] border border-[var(--blue-6)] rounded-full px-2 py-0.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveOption(option.id);
                  }}
                >
                  <Text size="1" className="text-xs">{option.name}</Text>
                  <Cross2Icon height="12" width="12" className="cursor-pointer hover:text-[var(--blue-12)]" />
                </Flex>
              ))}
            </>
          )}
        </div>
        <ChevronDownIcon
          height="16"
          width="16"
          className={`text-gray-500 transition-transform flex-shrink-0 ${showDropdown ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Content - uses fixed positioning but stays in DOM tree for event capture */}
      {showDropdown && !isLoading && (
        <div
          id="multiselect-dropdown-portal"
          className="bg-white border border-[var(--gray-6)] rounded-md shadow-lg"
          style={{
            position: 'fixed',
            ...(dropdownPosition.openUpward
              ? { bottom: window.innerHeight - dropdownPosition.top }
              : { top: dropdownPosition.top }),
            left: dropdownPosition.left,
            width: dropdownPosition.width,
            zIndex: 9999,
          }}
        >
          {/* Search Input Inside Dropdown */}
          <div className="p-2 border-b border-[var(--gray-6)]">
            <div className="relative">
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
                className="w-full px-3 py-2 pl-8 rounded-md border border-[var(--gray-6)]
                  text-sm focus:outline-none focus:ring-2 focus:ring-[var(--violet-8)]
                  focus:border-transparent"
              />
              <div className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none">
                <MagnifyingGlassIcon height="16" width="16" className="text-gray-500" />
              </div>
            </div>
          </div>

          {/* Results List */}
          <div
            style={{ maxHeight: 200, overflowY: 'auto', overscrollBehavior: 'contain' }}
          >
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-sm text-gray-500 text-center">
                {searchQuery ? noResultsMessage : emptyMessage}
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = selectedIds.includes(option.id);
                return (
                  <div
                    key={option.id}
                    onClick={() => handleOptionSelect(option)}
                    className={`p-3 hover:bg-[var(--gray-2)] cursor-pointer border-b border-[var(--gray-3)] last:border-b-0 flex items-center justify-between ${
                      isSelected ? 'bg-[var(--blue-2)]' : ''
                    }`}
                  >
                    <div className="flex-1">
                      <Text size="2" className={isSelected ? 'font-medium' : ''}>
                        {option.name}
                      </Text>
                      {Boolean(option.description) && (
                        <Text size="1" color="gray" className="block mt-1">
                          {option.description}
                        </Text>
                      )}
                    </div>
                    {isSelected && (
                      <CheckCircledIcon className="text-[var(--blue-11)] w-5 h-5 ml-2" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Selected Count Footer */}
          {showSelectedCount && selectedIds.length > 0 && (
            <div className="p-2 border-t border-[var(--gray-6)] bg-[var(--gray-1)] flex-shrink-0">
              <Text size="1" color="gray">
                {selectedIds.length} item{selectedIds.length !== 1 ? 's' : ''} selected
              </Text>
            </div>
          )}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="text-sm text-gray-500 mt-2">Loading...</div>
      )}
    </div>
  );
};

export default MultiSelectDropdown;
