import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  CartesianGrid,
  Tooltip,
  ComposedChart,
  Area,
} from 'recharts';
import {
  Box, Text, Flex, IconButton, Spinner,
} from '@radix-ui/themes';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import { useTranslation } from 'react-i18next';
import AISparkle from 'components/icons/AISparkle';

export interface KBQualityData {
  date: string;
  totalKBs: number;
  createdKBs: number;
  deduplicatedKBs: number;
}

interface KBQualityGraphProps {
  data: KBQualityData[];
  isLoading: boolean;
}

const CustomTooltip = ({ active, payload }) => {
  const { t } = useTranslation();
  
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-[#455678] rounded-xl p-3 shadow-lg">
      {payload.map((item, index) => {
        let color = '';
        let label = '';

        switch (item.dataKey) {
          case 'totalKBs':
            color = '#3B82F6';
            label = t('knowledge_assist.totalDocuments');
            break;
          case 'createdKBs':
            color = '#EAB308';
            label = t('knowledge_assist.newDocuments');
            break;
          case 'deduplicatedKBs':
            color = '#64748B';
            label = t('knowledge_assist.duplicateDocuments');
            break;
        }

        return (
          <div key={index} className="flex items-center gap-2 mb-1">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-white text-sm">
              {item.value}
              {' '}
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
};

function KBQualityGraph({ data, isLoading }: KBQualityGraphProps) {
  const { t } = useTranslation();
  
  return (
    <Box className="w-full h-[323px] p-4 bg-white rounded-[12px] shadow-[0_4px_9.9px_rgba(91,91,214,0.2)]">
      <Flex justify="between" align="start" mb="4">
        <Flex align="center" gap="2">
          <Text size="5" weight="medium" color="gray">
            {t('knowledge_assist.kbQualityOverTime')}
          </Text>
          <AISparkle />
          <IconButton size="1" variant="ghost">
            <InfoCircledIcon />
          </IconButton>
        </Flex>
        <Flex direction="row" gap="2">
          <Flex align="center" gap="2">
            <Box className="w-8 h-2 rounded-full bg-[#4F46E5]" />
            <Text size="2">{t('knowledge_assist.totalNoOfDocuments')}</Text>
          </Flex>
          <Flex align="center" gap="2">
            <Box className="w-8 h-2 rounded-full bg-[#EAB308]" />
            <Text size="2">{t('knowledge_assist.createNewDocuments')}</Text>
          </Flex>
          <Flex align="center" gap="2">
            <Box className="w-8 h-2 rounded-full bg-[#64748B]" />
            <Text size="2">{t('knowledge_assist.duplicateDocuments')}</Text>
          </Flex>
        </Flex>
      </Flex>

      {isLoading ? (
        <Flex align="center" justify="center" style={{ height: '90%' }}>
          <Spinner size="2" />
        </Flex>
      ) : (
        <ResponsiveContainer width="100%" height="90%">
          <ComposedChart
            data={data}
            margin={{
              top: 0, right: 30, left: -30, bottom: 0,
            }}
          >
            <defs>
              <linearGradient id="totalKBsGradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#FEF0FD" stopOpacity={1} />
                <stop offset="47%" stopColor="#F0F9FF" stopOpacity={1} />
                <stop offset="95%" stopColor="#F0F9FF" stopOpacity={0.35} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#E2E8F0"
            />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748B', fontSize: 12 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748B', fontSize: 12 }}
              domain={[0, 'dataMax + 20']}
            />
            <Tooltip
              // @ts-ignore
              content={<CustomTooltip />}
              cursor={{ strokeDasharray: '3 3' }}
            />
            <Area
              type="monotone"
              dataKey="totalKBs"
              stroke="#3B82F6"
              strokeWidth={2}
              fill="url(#totalKBsGradient)"
              dot={false}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="createdKBs"
              stroke="#EAB308"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="deduplicatedKBs"
              stroke="#64748B"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </Box>
  );
}

export default KBQualityGraph;
