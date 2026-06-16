import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { PlotParams } from 'react-plotly.js';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

export interface ScatterLineGraphData {
  height?: number;
  xAxis: string[];
  tickValues?: [number][];
  lines: {
    yAxis: number[];
    name: string;
    color: string;
    fillColor: string;
  }[];
}

export const ScatterLineGraph = ({ graphData, height = 300, tickValues = [0, 100, 200, 300] }: { graphData: ScatterLineGraphData, height?: number, tickValues?: number[] }) => {
  const data = useMemo(() => graphData.lines.reduce<PlotParams['data']>((tempData, line) => [
    ...tempData,
    {
      x: graphData.xAxis,
      y: line.yAxis,
      type: 'scatter',
      mode: 'lines+markers',
      name: line.name,
      line: {
        color: line.color,
        width: 2,
      },
      fill: 'tozeroy',
      fillcolor: line.fillColor,
    },
  ], []), [graphData]);

  const layout: PlotParams['layout'] = {
    autosize: true,
    height,
    xaxis: {
      showgrid: false,
      zeroline: false,
    },
    yaxis: {
      range: [0, tickValues[tickValues.length - 1]],
      tickvals: tickValues,
      showgrid: true,
      gridcolor: '#E5E5E5',
    },
    margin: {
      l: 40,
      r: 40,
      t: 40,
      b: 30,
    },
    paper_bgcolor: 'white',
    plot_bgcolor: 'white',
    showlegend: true,
    legend: {
      orientation: 'h',
      y: 1.2,
      x: 0.66,
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
