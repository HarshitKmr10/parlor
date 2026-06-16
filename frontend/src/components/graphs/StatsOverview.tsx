import React from 'react';
import {
  Flex, Box, Text, IconButton, Tooltip,
  Spinner,
} from '@radix-ui/themes';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import { useRouter } from 'next/navigation';
import DuplicateArticleStatsIcon from 'components/icons/DuplicateArticleStatsIcon';
import TotalOutdatedArticlesIcon from 'components/icons/TotalOutdatedArtcilesIcon';
import TotalUnusedArticlesIcon from 'components/icons/TotalUnusedActiclesIcon';
import KBWithoutTranslationIcon from 'components/icons/KBWithoutTranslationIcon';
import TicketsWithoutKBIcon from 'components/icons/TicketsWithoutKBIcon';
import TicketsWithAvailableKBIcon from 'components/icons/TicketsWithAvailableKBIcon';

interface Stat {
  key: string;
  label: string;
  value: string;
  tooltip?: string;
  isLoading: boolean;
  disabled?: boolean;
}

const ICON_BY_KEY: Record<string, React.ComponentType> = {
  duplicate_articles: DuplicateArticleStatsIcon,
  articles_without_translation: KBWithoutTranslationIcon,
  low_scoring: TotalUnusedArticlesIcon,
  new_documents_from_tickets: TotalOutdatedArticlesIcon,
  tickets_without_kb: TicketsWithoutKBIcon,
  tickets_missing_kb_links: TicketsWithAvailableKBIcon,
};

const ROUTE_BY_KEY: Record<string, string> = {
  duplicate_articles: '/knowledge/collections?tab=deduplicated',
  articles_without_translation: '/knowledge/collections?tab=translated',
  low_scoring: '/knowledge/collections?tab=lowscoring',
  new_documents_from_tickets: '/knowledge/collections?tab=create',
  tickets_without_kb: '/knowledge/dashboard/tickets?type=without-kb',
  tickets_missing_kb_links: '/knowledge/dashboard/tickets?type=with-kb',
};

function StatItem({
  statKey, label, value, tooltip, isLoading, disabled,
}: Stat & { statKey: string }) {
  const router = useRouter();
  const Icon = ICON_BY_KEY[statKey];
  const route = ROUTE_BY_KEY[statKey];

  const handleClick = () => {
    if (!disabled && route) router.push(route);
  };

  return (
    <Box
      className={`flex relative flex-1 p-4 rounded-[12px] bg-gradient-to-r from-[var(--accent-9)] to-[var(--accent-11)] shadow-[0_4px_9.9px_rgba(91,91,214,0.2)] overflow-hidden ${
        disabled ? 'opacity-60 cursor-not-allowed' : route ? 'cursor-pointer hover:opacity-90' : ''
      } transition-opacity`}
      onClick={!disabled && route ? handleClick : undefined}
    >
      {/* Main content */}
      <Flex direction="column" justify="between" className="flex-1 z-10 relative">
        <Flex align="center" gap="1">
          <Text size="3" weight="regular" className="text-white line-clamp-2">
            {label}
          </Text>
          {!!tooltip && (
            <Tooltip content={tooltip}>
              <IconButton size="1" variant="ghost">
                <InfoCircledIcon className="text-white" />
              </IconButton>
            </Tooltip>
          )}
        </Flex>
        <Flex align="end" className='flex'>
          {isLoading ? (
            <div className="mt-2 h-[44px] w-[100px] bg-white/20 animate-pulse rounded" />
          ) : (
            <Text size="8" weight="bold" className="text-white mt-2">
              {value}
            </Text>
          )}
        </Flex>
      </Flex>

      {/* Icon positioned at bottom right without padding */}
      <div className="absolute right-0 bottom-0">
        {Icon ? <Icon /> : null}
      </div>
    </Box>
  );
}

interface StatsOverviewProps {
  stats: Stat[];
  isLoading: boolean;
}

export function StatsOverview({ stats, isLoading }: StatsOverviewProps) {
  return (
    <Flex gap="4" className="rounded-md p-4">
      {stats.map((stat) => (
        <StatItem key={stat.key} {...stat} statKey={stat.key} isLoading={isLoading} />
      ))}
    </Flex>
  );
}
