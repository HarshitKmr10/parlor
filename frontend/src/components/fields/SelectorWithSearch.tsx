import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Flex, Text } from "@radix-ui/themes";
import * as Select from "@radix-ui/react-select";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "@radix-ui/react-icons";
import { MdClose } from "react-icons/md";
import clsx from "clsx";

type SelectorWithSearchProps = {
    label: string;
    items: Record<string, string>[];
    itemValueKey: string;
    itemNameKey: string;
    selectedItemValue: string;
    required?: boolean;
    onChange: (value: string) => void;
    maxContentHeight?: string;
    contentWidth?: string;
}

const ITEM_COUNT_TO_SHOW_SEARCH = 20;

export const SelectorWithSearch = ({ items, itemValueKey = 'value', itemNameKey = 'name', selectedItemValue, onChange, label, required = false, maxContentHeight, contentWidth }: SelectorWithSearchProps) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Prevent list item selection from stealing focus
    const handleSearchInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault(); // Prevent default focus behavior
        }
    };
    
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        // Ensure input keeps focus
        setTimeout(() => {
            searchInputRef.current?.focus();
        }, 10);
    };
    
    const getFilteredItems = useCallback((items: Record<string, string>[]) => {
        if (!debouncedSearchTerm) return items;
        return items.filter(item => 
            item?.name?.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
        );
    }, [debouncedSearchTerm]);

    // Debounce search term with cleanup
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 300); // 300ms delay

        return () => clearTimeout(timer);
    }, [searchTerm]);

    const contentStyle = useMemo(() => {
        return {
            maxHeight: maxContentHeight ?? "300px",
            width: contentWidth ?? "200px"
        };
    }, [maxContentHeight, contentWidth]);
    
    return (
        <Flex direction="column" gap="1">
            <Text size="2" weight="bold">
                {label}
                {required && <span className="text-red-500">*</span>}
            </Text>
            <Select.Root 
                value={selectedItemValue}
                onValueChange={(value) => {
                    onChange(value);
                    setSearchTerm("");
                }}>
                <Select.Trigger className="w-full text-sm rounded-lg border border-[var(--gray-7)] py-2 px-4 flex flex-row items-center justify-between placeholder:text-[var(--gray-7)]">
                    <Select.Value placeholder={`Select ${label}`} />
                    <Select.Icon className="SelectIcon">
                        <ChevronDownIcon />
                    </Select.Icon>
                </Select.Trigger>
                <Select.Content 
                    className={clsx("overflow-auto bg-white rounded-lg shadow-lg border border-gray-200 z-20")}
                    style={contentStyle}
                    position="popper"
                    sideOffset={5}>
                    <Select.ScrollUpButton className="flex items-center justify-center h-[25px] bg-white text-gray-700 z-30 cursor-pointer">
                        <ChevronUpIcon />
                    </Select.ScrollUpButton>
                    <Select.Viewport className="p-2">
                        {items?.length > ITEM_COUNT_TO_SHOW_SEARCH && (
                            <Flex direction="row" gap="2" align="center" justify="between" className="sticky -top-3 bg-white p-2 z-50">
                                <input
                                    ref={searchInputRef}
                                    className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:iris-10"
                                    placeholder="Search..."
                                    value={searchTerm}
                                    onChange={handleSearchChange}
                                    onKeyDown={handleSearchInputKeyDown}
                                    onClick={(e) => e.stopPropagation()}
                                />
                                {!!searchTerm && <MdClose className="cursor-pointer right-4 top-[18px] absolute" onClick={() => {
                                    onChange("");
                                    setSearchTerm("");
                                }} />}
                            </Flex>
                        )}
                        {getFilteredItems(items).map((item: Record<string, string>) => (
                            <Select.Item 
                                key={item?.[itemValueKey] ?? item?.value} 
                                value={item?.[itemValueKey] ?? item?.value}
                                className="relative flex items-center px-2 py-2 justify-between  rounded-md text-sm text-[var(--gray-11)] hover:bg-[var(--iris-3)] focus:bg-[var(--iris-3)] cursor-pointer outline-none"
                            >
                                <Select.ItemText>{item?.[itemNameKey]}</Select.ItemText>
                                <Select.ItemIndicator className="inline-flex items-center">
                                    <CheckIcon className="w-4 h-4" />
                                </Select.ItemIndicator>
                            </Select.Item>
                        ))}
                    </Select.Viewport>
                    <Select.ScrollDownButton className="flex items-center justify-center h-[25px] bg-white text-gray-700 z-30 cursor-pointer">
                        <ChevronDownIcon />
                    </Select.ScrollDownButton>
                </Select.Content>
            </Select.Root>
        </Flex>
    );
};