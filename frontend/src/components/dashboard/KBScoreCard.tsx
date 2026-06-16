import React from 'react';
import {
  Box, Flex, Text, Card,
} from '@radix-ui/themes';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import { ScoreArc } from './ScoreArc';

interface Metrics {
  label: string;
  value: number;
  color: string;
}

interface KBScoreCardProps {
  score: number;
  clarity: number;
  correctness: number;
  keyword_coverage: number;
  engagement: number;
}

const MetricBar = ({ label, value, color }: { label: string, value: number, color: string }) => (
  <div className="w-full p-4 border border-gray-200">
    <Flex justify="between" align="center" mb="1">
      <Flex align="center" gap="1">
        <Text className="text-gray-400" size="2">{label}</Text>
        <InfoCircledIcon className="w-3 h-3 text-gray-400" />
      </Flex>
      <Text className="font-medium" size="2">{value}%</Text>
    </Flex>
    <div className="h-1 w-full bg-gray-100 rounded-full">
      <div
        className={`h-full ${color} rounded-full`}
        style={{ width: `${value}%` }}
      />
    </div>
  </div>
);

const KBScoreCard: React.FC<KBScoreCardProps> = React.memo(({
  score = 70,
  clarity = 42,
  correctness = 76,
  keyword_coverage = 67,
  engagement = 70,
}) => {
  const metrics: Metrics[] = [
    { label: 'Correctness', value: correctness, color: 'bg-red-500' },
    { label: 'Clarity', value: clarity, color: 'bg-blue-500' },
    { label: 'Keywords', value: keyword_coverage, color: 'bg-teal-500' },
    { label: 'Engagement', value: engagement, color: 'bg-indigo-500' },
  ];

  return (
    <div className="w-full bg-white border border-gray-200">
      <div className="px-3 py-1.5 flex items-center gap-2">
        <Text weight="medium" size="4">KB Score</Text>
        {/* <InfoCircledIcon className="text-gray-400 w-4 h-4" /> */}
      </div>

      <div className="flex">
        <div className="w-[40%] border-r border-gray-200 h-[120px] grid place-items-center">
          <ScoreArc score={score} />
        </div>

        <div className="w-[60%] grid grid-cols-2">
        {/* {metrics.map((metric) => (
          <div key={metric.label} className="py-1.5 px-3 border border-gray-200 flex flex-col justify-center">
            <div className="flex justify-between items-center mb-0.5">
              <div className="flex items-center gap-1">
                <Text className="text-black" size="1">{metric.label}</Text>
              </div>
              <Text size="1">{isNaN(metric.value) ? '90%' : `${metric.value}%`}</Text>
            </div>
            <div className="h-1 w-full bg-gray-100 rounded-full">
              <div
                className={`h-full ${metric.color} rounded-full`}
                style={{ width: `${isNaN(metric.value) ? '90' : metric.value}%` }}
              />
            </div>
          </div>
        ))} */}
        </div>
      </div>
    </div>
  );
});

export default KBScoreCard;
