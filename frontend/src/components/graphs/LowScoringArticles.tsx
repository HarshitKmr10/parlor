'use client';

import React from 'react';
import {
  Box, Text, Flex, Tooltip, IconButton, Spinner,
} from '@radix-ui/themes';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import ProgressCircle from 'components/dashboard/ProgressCircle';

interface Article {
  id?: string;
  name: string;
  score: number;
  usageCount: number;
}

interface LowScoringArticlesProps {
  articles: Article[];
  isLoading: boolean;
}

export function LowScoringArticles({ articles, isLoading }: LowScoringArticlesProps) {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <Box className="w-full p-4 bg-white h-[323px] rounded-[12px] shadow-[0_4px_9.9px_rgba(91,91,214,0.2)] flex flex-col">
      <Flex align="center" justify="between" mb="2">
        <Flex align="center" gap="2">
          <Text size="5" weight="medium" color="gray">
            {t('knowledge_assist.lowScoring')}
          </Text>
          <Tooltip content={t('knowledge_assist.lowScoringTooltip')}>
            <IconButton size="1" variant="ghost">
              <InfoCircledIcon className="text-[var(--accent-9)]" />
            </IconButton>
          </Tooltip>
        </Flex>
      </Flex>

      <Box className="flex-grow overflow-auto">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <Spinner size="2" />
          </div>
        ) : (
          articles.map((article, index) => (
            <Flex
              key={article.id || index}
              align="start"
              className="py-1 hover:bg-blue-50 cursor-pointer"
              onClick={() => article.id && router.push(`/knowledge/editor/edit-document?id=${article.id}`)}
            >
              <Tooltip content={(article.score * 10)?.toString() || '0'}>
                <Box style={{ marginRight: '8px' }}>
                  <ProgressCircle progress={article.score * 10 || 0} size={20} />
                </Box>
              </Tooltip>
              {article.id ? (
                <TooltipPrimitive.Provider>
                  <TooltipPrimitive.Root delayDuration={200}>
                    <TooltipPrimitive.Trigger asChild>
                      <Text size="2" className="flex-1 truncate">
                        {article.name}
                      </Text>
                    </TooltipPrimitive.Trigger>
                    <TooltipPrimitive.Portal>
                      <TooltipPrimitive.Content
                        className="rounded-sm bg-gray-900 px-3 py-2 text-sm text-white shadow-lg z-50"
                        side="top"
                        sideOffset={5}
                        onPointerDownOutside={(e) => e.preventDefault()}
                      >
                        <a
                          href={`/knowledge/editor/edit-document?id=${article.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                          style={{
                            color: 'white',
                            textDecoration: 'underline',
                            cursor: 'pointer',
                            display: 'block',
                          }}
                        >
                          {article.name}
                        </a>
                        <TooltipPrimitive.Arrow className="fill-gray-900" />
                      </TooltipPrimitive.Content>
                    </TooltipPrimitive.Portal>
                  </TooltipPrimitive.Root>
                </TooltipPrimitive.Provider>
              ) : (
                <Tooltip content={article.name}>
                  <Text size="2" className="flex-1 truncate">
                    {article.name}
                  </Text>
                </Tooltip>
              )}
            </Flex>
          ))
        )}
      </Box>
    </Box>
  );
}
