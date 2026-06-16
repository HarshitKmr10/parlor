'use client';

// ─── Imports ─────────────────────────────────────────────────────
import { Box, Flex, Text } from '@radix-ui/themes';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

// ─── Hooks ───────────────────────────────────────────────────────
import { useCvaIssueCategoryDataV2 } from 'hooks/useCvaIssueCategoryDataV2';

// ─── Styles ──────────────────────────────────────────────────────
import * as styles from './CategoryBarChart.styles';

// ─── Types ───────────────────────────────────────────────────────
interface CategoryBarChartProps {
  orgId: string;
  timeframe: string;
}

const MAX_BAR_HEIGHT = 100;

// ─── Component ───────────────────────────────────────────────────
const CategoryBarChart = ({ orgId, timeframe }: CategoryBarChartProps) => {
  const { data, loading } = useCvaIssueCategoryDataV2(orgId, timeframe);

  const noData = !loading && (!data || data.length === 0);

  return (
    <Box className={styles.container}>
      {/* Header */}
      <Flex align="center" justify="between" className={styles.header}>
        <Text size="5" weight="medium">
          Issue Categories by Volume
        </Text>
        <Flex align="center" className="gap-2">
          <Box className={styles.legendDot} />
          <Text size="1" className={styles.labelColor}>
            Total Issues
          </Text>
        </Flex>
      </Flex>

      {/* Chart or fallback UI */}
      <Box className={`${styles.chartWrapper} ${loading || noData ? '' : 'left-[-2.5rem]'}`}>
        {loading ? (
          <Box className="h-[241px] w-full animate-pulse rounded-md bg-gray-100" />
        ) : noData ? (
          <Flex align={"center"} justify={"center"} className="h-[241px]">
            <Text size="2" color="gray">No data found</Text>
          </Flex>
        ) : (
          <ResponsiveContainer width="105%" height="100%">
            <BarChart data={data} barCategoryGap="20%">
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#4B5563' }} />
              <YAxis tick={{ fontSize: 12, fill: '#4B5563' }} domain={[0, MAX_BAR_HEIGHT]} />
              <Tooltip
                contentStyle={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}
                itemStyle={{ color: '#4B5563', fontSize: 12 }}
                labelStyle={{ color: '#4B5563', fontSize: 12 }}
              />
              <Bar
                dataKey="count"
                fill="#6366F1"
                fillOpacity={0.6}
                radius={[4, 4, 0, 0]}
                barSize={46}
                background={{ fill: '#D6DBED66' }}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Box>
    </Box>
  );
};

export default CategoryBarChart;