'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button, Text, Flex } from '@radix-ui/themes';
import { ChevronRight, X } from 'lucide-react';
import ProgressCircle from '@/components/dashboard/ProgressCircle';

export interface FilterState {
  scoreRanges: string[];
  collectionIds: string[];
  languages: string[];
  hasDuplicate: boolean | null;
}

interface FilterDropdownProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  collections: Array<{ id: string; name: string }>;
  isLoadingCollections?: boolean;
  submenuPosition?: 'left' | 'right' | 'auto'; // Position of child dropdown relative to parent
  activeTab?: string; // Active tab to control filter visibility
}

interface ScoreRange {
  label: string;
  min: number;
  max: number;
  color: string;
  representativeScore: number; // Score value to display in ProgressCircle
}

interface Language {
  code: string;
  label: string;
  flag: string;
}

const scoreRanges: ScoreRange[] = [
  { label: '0 - 25', min: 0, max: 25, color: 'bg-red-500', representativeScore: 12 },
  { label: '25 - 50', min: 25, max: 50, color: 'bg-orange-500', representativeScore: 37 },
  { label: '50 - 75', min: 50, max: 75, color: 'bg-yellow-500', representativeScore: 62 },
  { label: '75 - 90', min: 75, max: 90, color: 'bg-blue-500', representativeScore: 82 },
  { label: '90+', min: 90, max: 100, color: 'bg-green-500', representativeScore: 95 },
];

const languages: Language[] = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'fr', label: 'French', flag: '🇫🇷' },
  { code: 'de', label: 'German', flag: '🇩🇪' },
  { code: 'es', label: 'Spanish', flag: '🇪🇸' },
];

export default function FilterDropdown({
  filters,
  onFiltersChange,
  collections,
  isLoadingCollections = false,
  submenuPosition = 'right',
  activeTab = 'allkbs',
}: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const [collectionSearchQuery, setCollectionSearchQuery] = useState('');
  const [calculatedPosition, setCalculatedPosition] = useState<'left' | 'right'>('right');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);

  const hasActiveFilters =
    filters.scoreRanges.length > 0 ||
    filters.collectionIds.length > 0 ||
    filters.languages.length > 0 ||
    filters.hasDuplicate !== null;

  const activeFilterCount =
    filters.scoreRanges.length +
    filters.collectionIds.length +
    filters.languages.length +
    (filters.hasDuplicate !== null ? 1 : 0);

  // Filter collections based on search
  const filteredCollections =
    collectionSearchQuery.trim() === ''
      ? collections
      : collections.filter((c) =>
          c.name.toLowerCase().includes(collectionSearchQuery.toLowerCase()),
        );

  // Filter score ranges based on active tab
  const availableScoreRanges = activeTab === 'lowscoring'
    ? scoreRanges.filter(range => range.max <= 75)
    : scoreRanges;

  // Clear invalid score filters when switching to low scoring tab
  useEffect(() => {
    if (activeTab === 'lowscoring') {
      const invalidScoreRanges = filters.scoreRanges.filter(
        label => !availableScoreRanges.some(range => range.label === label)
      );
      if (invalidScoreRanges.length > 0) {
        onFiltersChange({
          ...filters,
          scoreRanges: filters.scoreRanges.filter(
            label => availableScoreRanges.some(range => range.label === label)
          ),
        });
      }
    }
  }, [activeTab, filters, onFiltersChange, availableScoreRanges]);

  // Calculate submenu position based on available space
  useEffect(() => {
    if (submenuPosition === 'auto' && dropdownRef.current && isOpen && activeSubmenu) {
      const dropdownRect = dropdownRef.current.getBoundingClientRect();
      const submenuWidth = 256; // w-64 = 256px
      const viewportWidth = window.innerWidth;
      const spaceOnRight = viewportWidth - dropdownRect.right;
      const spaceOnLeft = dropdownRect.left;

      // Choose position based on available space
      if (spaceOnRight >= submenuWidth) {
        setCalculatedPosition('right');
      } else if (spaceOnLeft >= submenuWidth) {
        setCalculatedPosition('left');
      } else {
        // Default to right if neither side has enough space
        setCalculatedPosition('right');
      }
    } else if (submenuPosition !== 'auto') {
      setCalculatedPosition(submenuPosition);
    }
  }, [submenuPosition, isOpen, activeSubmenu]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveSubmenu(null);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleClearAll = () => {
    onFiltersChange({
      scoreRanges: [],
      collectionIds: [],
      languages: [],
      hasDuplicate: null,
    });
    setIsOpen(false);
    setActiveSubmenu(null);
  };

  const toggleScoreRange = (range: string) => {
    const newRanges = filters.scoreRanges.includes(range)
      ? filters.scoreRanges.filter((r) => r !== range)
      : [...filters.scoreRanges, range];
    onFiltersChange({ ...filters, scoreRanges: newRanges });
  };

  const toggleCollection = (collectionId: string) => {
    const newCollections = filters.collectionIds.includes(collectionId)
      ? filters.collectionIds.filter((id) => id !== collectionId)
      : [...filters.collectionIds, collectionId];
    onFiltersChange({ ...filters, collectionIds: newCollections });
  };

  const toggleLanguage = (langCode: string) => {
    const newLanguages = filters.languages.includes(langCode)
      ? filters.languages.filter((l) => l !== langCode)
      : [...filters.languages, langCode];
    onFiltersChange({ ...filters, languages: newLanguages });
  };

  const setHasDuplicate = (value: boolean | null) => {
    onFiltersChange({ ...filters, hasDuplicate: value });
    setActiveSubmenu(null);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="2"
        onClick={() => setIsOpen(!isOpen)}
        className={`relative cursor-pointer ${hasActiveFilters ? 'text-blue-600' : 'text-gray-600'}`}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 15 15"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="mr-1"
        >
          <path
            d="M5.5 3C4.67157 3 4 3.67157 4 4.5C4 5.32843 4.67157 6 5.5 6C6.32843 6 7 5.32843 7 4.5C7 3.67157 6.32843 3 5.5 3ZM3 5C3.01671 5 3.03323 4.99918 3.04952 4.99758C3.28022 6.1399 4.28967 7 5.5 7C6.71033 7 7.71978 6.1399 7.95048 4.99758C7.96677 4.99918 7.98329 5 8 5H13.5C13.7761 5 14 4.77614 14 4.5C14 4.22386 13.7761 4 13.5 4H8C7.98329 4 7.96677 4.00082 7.95048 4.00242C7.71978 2.86009 6.71033 2 5.5 2C4.28967 2 3.28022 2.86009 3.04952 4.00242C3.03323 4.00082 3.01671 4 3 4H1.5C1.22386 4 1 4.22386 1 4.5C1 4.77614 1.22386 5 1.5 5H3ZM11.9505 10.9976C11.7198 12.1399 10.7103 13 9.5 13C8.28967 13 7.28022 12.1399 7.04952 10.9976C7.03323 10.9992 7.01671 11 7 11H1.5C1.22386 11 1 10.7761 1 10.5C1 10.2239 1.22386 10 1.5 10H7C7.01671 10 7.03323 10.0008 7.04952 10.0024C7.28022 8.8601 8.28967 8 9.5 8C10.7103 8 11.7198 8.8601 11.9505 10.0024C11.9668 10.0008 11.9833 10 12 10H13.5C13.7761 10 14 10.2239 14 10.5C14 10.7761 13.7761 11 13.5 11H12C11.9833 11 11.9668 10.9992 11.9505 10.9976ZM8 10.5C8 9.67157 8.67157 9 9.5 9C10.3284 9 11 9.67157 11 10.5C11 11.3284 10.3284 12 9.5 12C8.67157 12 8 11.3284 8 10.5Z"
            fill="currentColor"
            fillRule="evenodd"
            clipRule="evenodd"
          />
        </svg>
        Filter
        {hasActiveFilters && (
          <div className="ml-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-600 px-1">
            <Text style={{ fontSize: '10px' }} className="text-white">
              {activeFilterCount}
            </Text>
          </div>
        )}
      </Button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-2 w-64 rounded-md border border-[var(--gray-6)] bg-white shadow-lg">
          {/* Search input */}
          <div className="border-b border-[var(--gray-6)] p-2">
            <input
              type="text"
              placeholder="Filter"
              className="w-full rounded-md border-none bg-[var(--gray-2)] px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--violet-8)]"
              autoFocus
            />
          </div>

          {/* Filter options */}
          <div className="max-h-80 overflow-y-auto py-1">
            {/* Score filter */}
            <div
              className={`cursor-pointer px-3 py-2 hover:bg-[var(--gray-2)] ${
                activeSubmenu === 'score' ? 'bg-[var(--gray-2)]' : ''
              }`}
              onClick={() => setActiveSubmenu(activeSubmenu === 'score' ? null : 'score')}
            >
              <Flex justify="between" align="center">
                <Flex align="center" gap="2">
                  <Text size="2">Score</Text>
                  {filters.scoreRanges.length > 0 && (
                    <div className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-600 px-1">
                      <Text style={{ fontSize: '10px' }} className="text-white">
                        {filters.scoreRanges.length}
                      </Text>
                    </div>
                  )}
                </Flex>
                <ChevronRight className="h-4 w-4" />
              </Flex>
            </div>

            {/* Collection filter */}
            <div
              className={`cursor-pointer px-3 py-2 hover:bg-[var(--gray-2)] ${
                activeSubmenu === 'collection' ? 'bg-[var(--gray-2)]' : ''
              }`}
              onClick={() => setActiveSubmenu(activeSubmenu === 'collection' ? null : 'collection')}
            >
              <Flex justify="between" align="center">
                <Flex align="center" gap="2">
                  <Text size="2">Collection</Text>
                  {filters.collectionIds.length > 0 && (
                    <div className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-600 px-1">
                      <Text style={{ fontSize: '10px' }} className="text-white">
                        {filters.collectionIds.length}
                      </Text>
                    </div>
                  )}
                </Flex>
                <ChevronRight className="h-4 w-4" />
              </Flex>
            </div>

            {/* Languages filter */}
            <div
              className={`cursor-pointer px-3 py-2 hover:bg-[var(--gray-2)] ${
                activeSubmenu === 'languages' ? 'bg-[var(--gray-2)]' : ''
              }`}
              onClick={() => setActiveSubmenu(activeSubmenu === 'languages' ? null : 'languages')}
            >
              <Flex justify="between" align="center">
                <Flex align="center" gap="2">
                  <Text size="2">Languages</Text>
                  {filters.languages.length > 0 && (
                    <div className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-600 px-1">
                      <Text style={{ fontSize: '10px' }} className="text-white">
                        {filters.languages.length}
                      </Text>
                    </div>
                  )}
                </Flex>
                <ChevronRight className="h-4 w-4" />
              </Flex>
            </div>

            {/* Duplicate KB filter - hide on deduplicated tab */}
            {activeTab !== 'deduplicated' && (
              <div
                className={`cursor-pointer px-3 py-2 hover:bg-[var(--gray-2)] ${
                  activeSubmenu === 'duplicate' ? 'bg-[var(--gray-2)]' : ''
                }`}
                onClick={() => setActiveSubmenu(activeSubmenu === 'duplicate' ? null : 'duplicate')}
              >
                <Flex justify="between" align="center">
                  <Flex align="center" gap="2">
                    <Text size="2">Duplicate KB</Text>
                    {filters.hasDuplicate !== null && (
                      <div className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-600 px-1">
                        <Text style={{ fontSize: '10px' }} className="text-white">
                          1
                        </Text>
                      </div>
                    )}
                  </Flex>
                  <ChevronRight className="h-4 w-4" />
                </Flex>
              </div>
            )}
          </div>

          {/* Clear all button */}
          {hasActiveFilters && (
            <div className="border-t border-[var(--gray-6)] p-2">
              <Button
                variant="ghost"
                size="2"
                onClick={handleClearAll}
                className="w-full justify-center text-sm text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                Clear all
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Separate adjacent submenu dropdown - Linear style */}
      {isOpen && activeSubmenu !== null && (
        <div
          ref={submenuRef}
          className={`absolute top-0 z-50 mt-2 w-64 rounded-md border border-[var(--gray-6)] bg-white shadow-lg ${
            calculatedPosition === 'right'
              ? 'left-[calc(100%+0.25rem)]'
              : 'right-[calc(100%+0.25rem)]'
          }`}
        >
          {activeSubmenu === 'score' && (
            <>
              <div className="border-b border-[var(--gray-6)] px-3 py-2">
                <Text size="2" weight="medium">
                  Score
                </Text>
              </div>
              <div className="py-1">
                {availableScoreRanges.map((range) => {
                  const isSelected = filters.scoreRanges.includes(range.label);
                  return (
                    <div
                      key={range.label}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleScoreRange(range.label);
                      }}
                      className={`flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-[var(--gray-2)] ${
                        isSelected ? 'bg-[var(--blue-2)]' : ''
                      }`}
                    >
                      <ProgressCircle progress={range.representativeScore} size={20} />
                      <Text size="2" className={isSelected ? 'font-medium' : ''}>
                        {range.label}
                      </Text>
                      {isSelected && (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 15 15"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className="ml-auto text-[var(--blue-11)]"
                        >
                          <path
                            d="M11.4669 3.72684C11.7558 3.91574 11.8369 4.30308 11.648 4.59198L7.39799 11.092C7.29783 11.2452 7.13556 11.3467 6.95402 11.3699C6.77247 11.3931 6.58989 11.3355 6.45446 11.2124L3.70446 8.71241C3.44905 8.48022 3.43023 8.08494 3.66242 7.82953C3.89461 7.57412 4.28989 7.55529 4.5453 7.78749L6.75292 9.79441L10.6018 3.90792C10.7907 3.61902 11.178 3.53795 11.4669 3.72684Z"
                            fill="currentColor"
                            fillRule="evenodd"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {activeSubmenu === 'collection' && (
            <>
              <div className="border-b border-[var(--gray-6)] p-2">
                <input
                  type="text"
                  placeholder="Search collections..."
                  value={collectionSearchQuery}
                  onChange={(e) => setCollectionSearchQuery(e.target.value)}
                  className="w-full rounded-md border border-[var(--gray-6)] px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--violet-8)]"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className="max-h-60 overflow-y-auto py-1">
                {isLoadingCollections ? (
                  <div className="p-3 text-center text-sm text-gray-500">Loading...</div>
                ) : filteredCollections.length === 0 ? (
                  <div className="p-3 text-center text-sm text-gray-500">
                    {collectionSearchQuery ? 'No collections found' : 'No collections available'}
                  </div>
                ) : (
                  filteredCollections.map((collection) => {
                    const isSelected = filters.collectionIds.includes(collection.id);
                    return (
                      <div
                        key={collection.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCollection(collection.id);
                        }}
                        className={`flex cursor-pointer items-center justify-between px-3 py-2 hover:bg-[var(--gray-2)] ${
                          isSelected ? 'bg-[var(--blue-2)]' : ''
                        }`}
                      >
                        <Text size="2" className={isSelected ? 'font-medium' : ''}>
                          {collection.name}
                        </Text>
                        {isSelected && (
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 15 15"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            className="text-[var(--blue-11)]"
                          >
                            <path
                              d="M11.4669 3.72684C11.7558 3.91574 11.8369 4.30308 11.648 4.59198L7.39799 11.092C7.29783 11.2452 7.13556 11.3467 6.95402 11.3699C6.77247 11.3931 6.58989 11.3355 6.45446 11.2124L3.70446 8.71241C3.44905 8.48022 3.43023 8.08494 3.66242 7.82953C3.89461 7.57412 4.28989 7.55529 4.5453 7.78749L6.75292 9.79441L10.6018 3.90792C10.7907 3.61902 11.178 3.53795 11.4669 3.72684Z"
                              fill="currentColor"
                              fillRule="evenodd"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}

          {activeSubmenu === 'languages' && (
            <>
              <div className="border-b border-[var(--gray-6)] px-3 py-2">
                <Text size="2" weight="medium">
                  Languages
                </Text>
              </div>
              <div className="py-1">
                {languages.map((lang) => {
                  const isSelected = filters.languages.includes(lang.code);
                  return (
                    <div
                      key={lang.code}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLanguage(lang.code);
                      }}
                      className={`flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-[var(--gray-2)] ${
                        isSelected ? 'bg-[var(--blue-2)]' : ''
                      }`}
                    >
                      <span className="text-lg">{lang.flag}</span>
                      <Text size="2" className={isSelected ? 'font-medium' : ''}>
                        {lang.label}
                      </Text>
                      {isSelected && (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 15 15"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className="ml-auto text-[var(--blue-11)]"
                        >
                          <path
                            d="M11.4669 3.72684C11.7558 3.91574 11.8369 4.30308 11.648 4.59198L7.39799 11.092C7.29783 11.2452 7.13556 11.3467 6.95402 11.3699C6.77247 11.3931 6.58989 11.3355 6.45446 11.2124L3.70446 8.71241C3.44905 8.48022 3.43023 8.08494 3.66242 7.82953C3.89461 7.57412 4.28989 7.55529 4.5453 7.78749L6.75292 9.79441L10.6018 3.90792C10.7907 3.61902 11.178 3.53795 11.4669 3.72684Z"
                            fill="currentColor"
                            fillRule="evenodd"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {activeSubmenu === 'duplicate' && (
            <>
              <div className="border-b border-[var(--gray-6)] px-3 py-2">
                <Text size="2" weight="medium">
                  Duplicate KB
                </Text>
              </div>
              <div className="py-1">
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setHasDuplicate(true);
                  }}
                  className={`flex cursor-pointer items-center justify-between px-3 py-2 hover:bg-[var(--gray-2)] ${
                    filters.hasDuplicate === true ? 'bg-[var(--blue-2)]' : ''
                  }`}
                >
                  <Text size="2" className={filters.hasDuplicate === true ? 'font-medium' : ''}>
                    Has Duplicates
                  </Text>
                  {filters.hasDuplicate === true && (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 15 15"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="text-[var(--blue-11)]"
                    >
                      <path
                        d="M11.4669 3.72684C11.7558 3.91574 11.8369 4.30308 11.648 4.59198L7.39799 11.092C7.29783 11.2452 7.13556 11.3467 6.95402 11.3699C6.77247 11.3931 6.58989 11.3355 6.45446 11.2124L3.70446 8.71241C3.44905 8.48022 3.43023 8.08494 3.66242 7.82953C3.89461 7.57412 4.28989 7.55529 4.5453 7.78749L6.75292 9.79441L10.6018 3.90792C10.7907 3.61902 11.178 3.53795 11.4669 3.72684Z"
                        fill="currentColor"
                        fillRule="evenodd"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setHasDuplicate(false);
                  }}
                  className={`flex cursor-pointer items-center justify-between px-3 py-2 hover:bg-[var(--gray-2)] ${
                    filters.hasDuplicate === false ? 'bg-[var(--blue-2)]' : ''
                  }`}
                >
                  <Text size="2" className={filters.hasDuplicate === false ? 'font-medium' : ''}>
                    No Duplicates
                  </Text>
                  {filters.hasDuplicate === false && (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 15 15"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="text-[var(--blue-11)]"
                    >
                      <path
                        d="M11.4669 3.72684C11.7558 3.91574 11.8369 4.30308 11.648 4.59198L7.39799 11.092C7.29783 11.2452 7.13556 11.3467 6.95402 11.3699C6.77247 11.3931 6.58989 11.3355 6.45446 11.2124L3.70446 8.71241C3.44905 8.48022 3.43023 8.08494 3.66242 7.82953C3.89461 7.57412 4.28989 7.55529 4.5453 7.78749L6.75292 9.79441L10.6018 3.90792C10.7907 3.61902 11.178 3.53795 11.4669 3.72684Z"
                        fill="currentColor"
                        fillRule="evenodd"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
