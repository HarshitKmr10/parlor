import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Flex,
    Text,
    Button,
    Badge,
} from '@radix-ui/themes';
import AISparkle from 'components/icons/AISparkle';
import { VIEWS } from 'constants/dashboard';
import type { ViewType } from 'types/dashboard';
import SuccessDialog from './SuccessDialog';
import EditorPanel from './EditorPanel';
import Image from 'next/image';
import { useDashboard } from 'hooks/useDashboard';
import { LANGUAGE_FLAGS } from '@/config/flags';

interface TranslateViewNewProps {
    onSetView: (view: ViewType) => void;
    isLoadingForTranslate: boolean;
    showSuccessDialogForTranslate: boolean;
    setShowSuccessDialogForTranslate: (open: boolean) => void;
    isEditingForTranslate: boolean;
    setIsEditingForTranslate: (open: boolean) => void;
}

const TranslateViewNew: React.FC<TranslateViewNewProps> = ({
    onSetView,
    isLoadingForTranslate,
    showSuccessDialogForTranslate,
    setShowSuccessDialogForTranslate,
    isEditingForTranslate,
    setIsEditingForTranslate,
}) => {
    const { t } = useTranslation();
    const { selectedRecommendation: recommendation, setSelectedRecommendation } = useDashboard();
    console.log("recommendation", recommendation);

    const formatKbNumber = useCallback((name: string): string => {
        const number = (name.length % 10000).toString().padStart(8, '0');
        return `KB_${number}`;
    }, []);

    const sortedArticles = useMemo(
        () => recommendation?.kb_data ? [...recommendation.kb_data].sort((a, b) => b.score - a.score) : [],
        [recommendation?.kb_data],
    );

    const openArticle = useCallback((url: string) => {
        window.open(url, '_blank', 'noopener noreferrer');
    }, []);

    const handleContentChange = useCallback((newContent: string) => {
        setSelectedRecommendation(prev => ({
            ...prev!,
            content: newContent
        }));
        setIsEditingForTranslate(true);
    }, [setSelectedRecommendation]);

    const currentKbNumber = useMemo(
        () => sortedArticles[0] ? formatKbNumber(sortedArticles[0].name) : 'KB000000',
        [sortedArticles, formatKbNumber],
    );

    const currentKbUrl = useMemo(
        () => sortedArticles[0]?.access_url || '',
        [sortedArticles],
    );

    return (
        <Flex className="p-4 flex-1 min-h-0">
            <Flex direction="row" gap="4" className="flex-1">
                {/* Left Panel - Similar Documents */}
                <Flex direction="column" className="w-1/2 flex-1 min-h-0">
                    <Flex justify="between" p="2">
                        <Flex align="center" gap="2">
                            <AISparkle />
                            <Text size="5" weight="bold">
                                {t('knowledge_assist.aiRecommendedKB')}
                            </Text>
                            {!!recommendation.translating_to_language && (
                                <Image
                                    src={`https://flagcdn.com/${LANGUAGE_FLAGS[recommendation.translating_to_language] || recommendation.translating_to_language}.svg`}
                                    alt={`Target language: ${recommendation.translating_to_language}`}
                                    width={24}
                                    height={16}
                                    style={{
                                        border: '1px solid #e0e0e0',
                                        borderRadius: '2px',
                                    }}
                                />
                            )}
                            {isEditingForTranslate && (
                                <Badge size="1" color="orange" variant="soft">
                                    Editing
                                </Badge>
                            )}
                        </Flex>
                        <Button
                            variant="soft"
                            disabled={isLoadingForTranslate}
                            onClick={() => setIsEditingForTranslate(!isEditingForTranslate)}
                        >
                            {isEditingForTranslate ? 'Preview' : 'Edit'}
                        </Button>
                    </Flex>
                    <EditorPanel
                        content={recommendation?.content}
                        onChange={handleContentChange}
                        disabled={isLoadingForTranslate || !isEditingForTranslate}
                    />
                </Flex>

                {/* Right Panel - Original KB */}
                <Flex direction="column" className="w-1/2">
                    <Flex justify="between" p="2">
                        <Flex align="center" gap="2">
                            <Text size="5" weight="bold">
                                Original KB
                            </Text>
                            {!!recommendation.translating_from_language && (
                                <Image
                                    src={`https://flagcdn.com/${LANGUAGE_FLAGS[recommendation.translating_from_language] || recommendation.translating_from_language}.svg`}
                                    alt={`Source language: ${recommendation.translating_from_language}`}
                                    width={24}
                                    height={16}
                                    style={{
                                        border: '1px solid #e0e0e0',
                                        borderRadius: '2px',
                                    }}
                                />
                            )}
                            {/* <Badge size="1" color="gray" variant="outline">
                                View Only
                            </Badge>
                            <Text size="2" color="gray">
                                {currentKbNumber}
                            </Text> */}
                        </Flex>
                    </Flex>
                    {/* <DocumentDisplay url={currentKbUrl} /> */}
                    <EditorPanel
                        content={recommendation.kb_data[0].content}
                        onChange={() => { }}
                        disabled={true}
                    />
                </Flex>
            </Flex>

            <SuccessDialog
                open={showSuccessDialogForTranslate}
                onOpenChange={setShowSuccessDialogForTranslate}
                onClose={() => {
                    setShowSuccessDialogForTranslate(false);
                    onSetView(VIEWS.DASHBOARD);
                }}
            />
        </Flex>
    );
};

export default React.memo(TranslateViewNew);