import { Box, Flex, Text } from '@radix-ui/themes';
import dynamic from 'next/dynamic';
import { PlotParams } from 'react-plotly.js';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

export interface DonutPiechartProps {
  section: {
    value: number;
    label: string;
    markerColor: string;
  }[];
  annotationValue: number | string;
  annotationText: string;
  height?: number;
}

export const DonutPiechart = ({ chartData }: { chartData: DonutPiechartProps }) => {
  const {
    section, annotationValue, annotationText, height = 300,
  } = chartData;

  const data: PlotParams['data'] = [
    {
      values: section.map((s) => s.value),
      labels: section.map((s) => s.label),
      type: 'pie',
      hole: 0.7,
      marker: {
        colors: section.map((s) => s.markerColor),
      },
      textinfo: 'none',
      hoverinfo: 'label+percent',
    },
  ];

  const layout: PlotParams['layout'] = {
    autosize: true,
    width: height,
    height,
    showlegend: false,
    annotations: [{
      text: annotationValue.toString(),
      x: 0.5,
      y: 0.52,
      font: {
        size: 30,
        weight: 600,
      },
      showarrow: false,
    },
    {
      text: annotationText,
      x: 0.5,
      y: 0.4,
      font: {
        size: 12,
        color: '#C0C1C2',
      },
      showarrow: false,
    }],
    margin: {
      l: 10,
      r: 10,
      t: 30,
      b: 10,
    },
  };

  const config: PlotParams['config'] = {
    displayModeBar: false, // Hides the plotly toolbar
    responsive: false,
    frameMargins: 0,
  };

  return (
    <Flex direction="row" align="center" gap="4">
      <Plot
        data={data}
        layout={layout}
        config={config}
      />
      <Flex direction="column" gap="2">
        {section.map((item) => (
          <Flex key={item.value} direction="row" gap="2" wrap="nowrap" align="start">
            <Box className="w-6 h-1.5 rounded-full mt-2" style={{ backgroundColor: item.markerColor }} />
            <Flex direction="column" gap="1">
              <Text size="2" className="text-gray-700">
                {item.label}
              </Text>
              <Text size="2" weight="bold">
                {`${item.value}%`}
              </Text>
            </Flex>
          </Flex>
        ))}
      </Flex>
    </Flex>
  );
};
