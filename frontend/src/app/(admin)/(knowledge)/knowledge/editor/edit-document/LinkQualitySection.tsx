import React, { useState } from 'react';
import { Box, Flex, Button, Text, Badge } from '@radix-ui/themes';
import { ChevronRight, AlertCircle, ShieldAlert, X } from 'lucide-react';

export interface LinkSuggestion {
    id: string;
    category: string;
    type: 'broken_link' | 'insecure_link';
    severity: 'error' | 'warning' | 'info';
    message: string;
    details: {
        url: string;
        link_text: string;
        http_status?: number;
    };
    location: {
        type: string;
        url: string;
    };
    metadata: {
        created_at: string;
        source: string;
        version: string;
    };
}

interface LinkQualitySectionProps {
    suggestions: LinkSuggestion[];
    onFixLink: (suggestion: LinkSuggestion) => void;
    onDismissLink: (suggestionId: string) => void;
    t: any;
}

const LinkQualitySection: React.FC<LinkQualitySectionProps> = ({ suggestions, onFixLink, onDismissLink, t }) => {
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        errors: true,
        warnings: false,
    });

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    // Group suggestions by severity
    const errorSuggestions = suggestions.filter(s => s.severity === 'error');
    const warningSuggestions = suggestions.filter(s => s.severity === 'warning');

    // Further group by type
    const groupByType = (items: LinkSuggestion[]) => {
        return items.reduce((acc, item) => {
            if (!acc[item.type]) acc[item.type] = [];
            acc[item.type].push(item);
            return acc;
        }, {} as Record<string, LinkSuggestion[]>);
    };

    const errorsByType = groupByType(errorSuggestions);
    const warningsByType = groupByType(warningSuggestions);

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'broken_link': return 'Broken Links';
            case 'insecure_link': return 'Insecure Links';
            default: return type;
        }
    };

    const getSeverityIcon = (severity: string) => {
        switch (severity) {
            case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />;
            case 'warning': return <ShieldAlert className="h-4 w-4 text-yellow-500" />;
            default: return <AlertCircle className="h-4 w-4 text-blue-500" />;
        }
    };

    if (suggestions.length === 0) {
        return null;
    }

    return (
        <div className="mt-4 space-y-2">
            <Text className="text-md font-medium text-gray-700">
                Link Quality
            </Text>

            {/* Errors Section */}
            {errorSuggestions.length > 0 && (
                <div className="space-y-2">
                    <div
                        className="flex cursor-pointer items-center justify-between rounded-md border border-red-200 bg-red-50 p-2 transition-colors hover:bg-red-100"
                        onClick={() => toggleSection('errors')}
                    >
                        <Flex align="center" gap="2">
                            <AlertCircle className="h-4 w-4 text-red-500" />
                            <Text size="2" weight="medium" className="text-red-700">
                                Errors ({errorSuggestions.length})
                            </Text>
                        </Flex>
                        <ChevronRight
                            className={`h-4 w-4 text-red-700 transition-transform ${expandedSections.errors ? 'rotate-90' : ''}`}
                        />
                    </div>

                    {expandedSections.errors && (
                        <div className="ml-4 space-y-3">
                            {Object.entries(errorsByType).map(([type, items]) => (
                                <div key={type} className="space-y-2">
                                    <Text size="2" weight="medium" className="text-gray-600">
                                        {getTypeLabel(type)} ({items.length})
                                    </Text>
                                    {items.map((suggestion) => (
                                        <div
                                            key={suggestion.id}
                                            className="rounded-md border border-[#E4E4FB] bg-white p-3 transition-shadow hover:shadow-sm"
                                        >
                                            <Flex direction="column" gap="2">
                                                <Flex align="start" justify="between">
                                                    <Flex direction="column" gap="1" className="flex-1">
                                                        <Flex align="center" gap="2">
                                                            {getSeverityIcon(suggestion.severity)}
                                                            <Text size="2" weight="medium" className="text-gray-800">
                                                                {suggestion.message}
                                                            </Text>
                                                        </Flex>
                                                        <Text size="1" className="break-all text-[var(--iris-9)] underline">
                                                            {suggestion.details.url}
                                                        </Text>
                                                        {Boolean(suggestion.details.link_text) && (
                                                            <Text size="1" className="text-gray-500">
                                                                Link text: "{suggestion.details.link_text}"
                                                            </Text>
                                                        )}
                                                        {Boolean(suggestion.details.http_status) && (
                                                            <Badge size="1" color="red" variant="soft">
                                                                HTTP {suggestion.details.http_status}
                                                            </Badge>
                                                        )}
                                                    </Flex>
                                                    <Button
                                                        size="1"
                                                        variant="ghost"
                                                        onClick={() => onDismissLink(suggestion.id)}
                                                        className="cursor-pointer"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                </Flex>
                                                <Flex gap="2" mt="1">
                                                    <Button
                                                        size="1"
                                                        variant="soft"
                                                        onClick={() => onFixLink(suggestion)}
                                                        className="cursor-pointer"
                                                    >
                                                        Fix
                                                    </Button>
                                                </Flex>
                                            </Flex>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Warnings Section */}
            {warningSuggestions.length > 0 && (
                <div className="space-y-2">
                    <div
                        className="flex cursor-pointer items-center justify-between rounded-md border border-yellow-200 bg-yellow-50 p-2 transition-colors hover:bg-yellow-100"
                        onClick={() => toggleSection('warnings')}
                    >
                        <Flex align="center" gap="2">
                            <ShieldAlert className="h-4 w-4 text-yellow-600" />
                            <Text size="2" weight="medium" className="text-yellow-700">
                                Warnings ({warningSuggestions.length})
                            </Text>
                        </Flex>
                        <ChevronRight
                            className={`h-4 w-4 text-yellow-700 transition-transform ${expandedSections.warnings ? 'rotate-90' : ''}`}
                        />
                    </div>

                    {expandedSections.warnings && (
                        <div className="ml-4 space-y-3">
                            {Object.entries(warningsByType).map(([type, items]) => (
                                <div key={type} className="space-y-2">
                                    <Text size="2" weight="medium" className="text-gray-600">
                                        {getTypeLabel(type)} ({items.length})
                                    </Text>
                                    {items.map((suggestion) => (
                                        <div
                                            key={suggestion.id}
                                            className="rounded-md border border-[#E4E4FB] bg-white p-3 transition-shadow hover:shadow-sm"
                                        >
                                            <Flex direction="column" gap="2">
                                                <Flex align="start" justify="between">
                                                    <Flex direction="column" gap="1" className="flex-1">
                                                        <Flex align="center" gap="2">
                                                            {getSeverityIcon(suggestion.severity)}
                                                            <Text size="2" weight="medium" className="text-gray-800">
                                                                {suggestion.message}
                                                            </Text>
                                                        </Flex>
                                                        <Text size="1" className="break-all text-[var(--iris-9)] underline">
                                                            {suggestion.details.url}
                                                        </Text>
                                                        {Boolean(suggestion.details.link_text) && (
                                                            <Text size="1" className="text-gray-500">
                                                                Link text: "{suggestion.details.link_text}"
                                                            </Text>
                                                        )}
                                                    </Flex>
                                                    <Button
                                                        size="1"
                                                        variant="ghost"
                                                        onClick={() => onDismissLink(suggestion.id)}
                                                        className="cursor-pointer"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                </Flex>
                                                <Flex gap="2" mt="1">
                                                    <Button
                                                        size="1"
                                                        variant="soft"
                                                        onClick={() => onFixLink(suggestion)}
                                                        className="cursor-pointer"
                                                    >
                                                        Fix
                                                    </Button>
                                                </Flex>
                                            </Flex>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default LinkQualitySection;
