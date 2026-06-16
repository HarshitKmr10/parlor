import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { PlotParams } from 'react-plotly.js';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

export interface GroupBarGraphProps {
  xAxis: string[];
  bars: {
    name: string;
    yAxis: number[];
    color: string;
  }[];
  tickValues?: number[];
}

export const GroupBarGraph = ({ graphData }: { graphData: GroupBarGraphProps }) => {
  const { xAxis, bars, tickValues = [0, 50, 100, 150, 200] } = graphData;

  const data = useMemo((): PlotParams['data'] => bars.map((bar) => ({
    name: bar.name,
    type: 'bar',
    x: xAxis,
    y: bar.yAxis,
    marker: { color: bar.color },
  })), [bars, xAxis]);

  const layout: PlotParams['layout'] = {
    autosize: true,
    height: 250,
    barmode: 'group',
    bargap: 0.6,
    bargroupgap: 0.1,
    xaxis: {
      tickangle: 0,
      showgrid: false,
    },
    yaxis: {
      range: [0, tickValues?.[tickValues.length - 1]],
      tickvals: tickValues,
      showgrid: true,
      gridcolor: '#E5E5E5',
    },
    margin: {
      l: 40,
      r: 20,
      t: 40,
      b: 30,
    },
    paper_bgcolor: 'white',
    plot_bgcolor: 'white',
    showlegend: true,
    legend: {
      orientation: 'h',
      y: 1.2,
      x: 0.4,
    },
  };

  const config: PlotParams['config'] = {
    displayModeBar: false,
    responsive: true,
    frameMargins: 0,
  };

  return (
      <Plot
        data={data}
        layout={layout}
        config={config}
      />
  );
};
