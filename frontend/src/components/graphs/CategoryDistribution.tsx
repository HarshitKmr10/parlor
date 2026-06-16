'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import {
  Flex, Box, Text, Tooltip, IconButton,
} from '@radix-ui/themes';
import { InfoCircledIcon } from '@radix-ui/react-icons';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

interface CategoryDistributionProps {
  labels: string[];
  datapoints: number[];
}

export function CategoryDistribution({ labels, datapoints }: CategoryDistributionProps) {
  // Generate colors based on the Radix UI accent color scheme
  const generateColors = (count: number) => {
    const chartColors = [
      '#5753C6', '#5B5BD6', '#9B9EF0', '#B8BAF8', '#CBCDFF',
      '#E6E7FF', '#F0F1FE', '#F8F8FF', '#FDFDFF',
    ];
    return Array.from({ length: count }, (_, i) => chartColors[i % chartColors.length]);
  };

  const colors = generateColors(labels.length);

  // Sort the data in descending order
  const sortedData = labels.map((label, index) => ({
    label,
    value: datapoints[index],
    color: colors[index],
  })).sort((a, b) => b.value - a.value);

  // Calculate dynamic height based on the number of categories
  const dynamicHeight = Math.max(300, sortedData.length * 30);

  return (
    <Box className="bg-[var(--gray-1)] p-4 rounded-lg shadow-sm">
      <Flex align="center" justify="between" mb="3">
        <Text size="5" weight="medium" color="gray">
          Article Inventory Overview in %
        </Text>
        <Tooltip content="Distribution of articles across different categories">
          <IconButton size="1" variant="ghost">
            <InfoCircledIcon />
          </IconButton>
        </Tooltip>
      </Flex>
      <Plot
        data={[
          {
            type: 'bar',
            x: sortedData.map((item) => item.value),
            y: sortedData.map((item) => item.label),
            orientation: 'h',
            marker: {
              color: sortedData.map((item) => item.color),
            },
            text: sortedData.map((item) => item.value.toString()),
            textposition: 'outside',
            hoverinfo: 'none',
          },
        ]}
        layout={{
          showlegend: false,
          margin: {
            t: 10, b: 20, l: 150, r: 50, // Increased right margin
          },
          height: dynamicHeight,
          xaxis: {
            showgrid: false,
            zeroline: false,
            showticklabels: false,
            range: [0, Math.max(...sortedData.map((item) => item.value)) * 1.1], // Extend x-axis range by 10%
          },
          yaxis: {
            automargin: true,
          },
          bargap: 0.3,
          paper_bgcolor: 'rgba(0,0,0,0)',
          plot_bgcolor: 'rgba(0,0,0,0)',
        }}
        config={{
          displayModeBar: false,
        }}
        useResizeHandler
        style={{ width: '100%', height: `${dynamicHeight}px`, minHeight: `${dynamicHeight}px` }}
      />
    </Box>
  );
}
