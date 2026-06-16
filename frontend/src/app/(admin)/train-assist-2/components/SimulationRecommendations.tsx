'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Flex, Heading, Text, IconButton, Badge } from '@radix-ui/themes';
import { Sparkles, MoreHorizontal, TrendingUp } from 'lucide-react';
import { getSimulationThemesForGuide } from '@/hooks/train-assist/useSimulation';

interface Props {
  guideIds: string[];
  onClick?: (guideId: string, tab: string) => void;
}

interface ThemeWithGuideId {
  guideId: string;
  theme: any; 
}

export default function SimulationRecommendations({ guideIds, onClick }: Props) {
  const { t } = useTranslation();
  const [simulations, setSimulations] = useState<ThemeWithGuideId[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchSimulations = async () => {
      setLoading(true);
      let combined: ThemeWithGuideId[] = [];

      try {
        for (const id of guideIds) {
          const themes = await getSimulationThemesForGuide(id);
          if (!isMounted) return;

          const withGuideId = themes.map((theme) => ({
            guideId: id,
            theme,
          }));

          combined = [...combined, ...withGuideId];

          if (combined.length >= 3) {
            combined = combined.slice(0, 3);
            break;
          }
        }

        if (isMounted) {
          setSimulations(combined);
          setError(null);
        }
      } catch (err: any) {
        console.error(err);
        if (isMounted) setError(t('train_assist.failedToLoadSimulationThemes'));
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchSimulations();

    return () => {
      isMounted = false;
    };
  }, [guideIds]);

  return (
    <Box className="space-y-4 px-2">
      {loading && <Text size="2">{t('train_assist.loadingSimulations')}</Text>}
      {!!error && (
        <Text size="2" color="red">
          {error}
        </Text>
      )}

      {simulations.length > 0 && (
        <>
          <Flex align="center" justify="between" className="mb-2">
            <Flex gap="2" align="center">
              <Sparkles className="h-6 w-6 text-yellow-500" />
              <Heading as="h2" weight="medium" className="text-iris-11">
                {t('train_assist.aiRecommendationsTitle')}
              </Heading>
              <Badge className="flex items-center gap-1 rounded-sm bg-[#E7F0FF] px-3 py-1 text-[12px] font-semibold text-[#3E63DD]">
                <TrendingUp className="h-3 w-3" />
                {simulations.length}
              </Badge>
            </Flex>
          </Flex>

          {simulations.map(({ guideId, theme }) => (
            <Box
              key={theme.id}
              className="cursor-pointer rounded-lg bg-[#f7f8fa] p-3 transition hover:shadow-sm"
              onClick={() => onClick?.(guideId, `&tab=simulation`)}
            >
              <Flex justify="between" align="start" className="mb-1">
                <Text size="1" weight="medium" className="flex gap-1 text-iris-9">
                  {t('train_assist.chatSimulation')}
                </Text>
                <IconButton size="1" variant="ghost">
                  <MoreHorizontal className="h-4 w-4 text-gray-500" />
                </IconButton>
              </Flex>
              <Box>
                <Text size="2" weight="medium" className="mb-1 text-gray-900">
                  {theme.title}
                </Text>
                <br />
                <Text size="2" color="gray" className="mb-2">
                  {theme.description}
                </Text>
              </Box>
            </Box>
          ))}
        </>
      )}
    </Box>
  );
}