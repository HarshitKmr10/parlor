import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { useTranslation } from 'react-i18next';

function CPUUsageChart({ data }) {
  const { t } = useTranslation();
  
  function CustomizedDot(props) {
    const { cx, cy, payload } = props;
    if (payload.Anomaly) {
      return (
        <svg x={cx - 6} y={cy - 6} width={12} height={12} fill="red">
          <g transform="rotate(45 6 6)">
            <rect x="5" y="0" width="2" height="12" />
            <rect x="0" y="5" width="12" height="2" />
          </g>
        </svg>
      );
    }
    return null;
  }

  const minValue = Math.min(
    ...data.map((item) => Math.min(
      item['CPU Utilization (%)'],
      item['Running Median'],
      item['Lower Threshold'],
    )),
  );
  const maxValue = Math.max(
    ...data.map((item) => Math.max(
      item['CPU Utilization (%)'],
      item['Running Median'],
      item['Upper Threshold'],
    )),
  );

  const yAxisMin = Math.max(0, Math.floor(minValue) - 5);
  const yAxisMax = Math.min(100, Math.ceil(maxValue) + 5);

  return (
    <div style={{ width: '100%', height: '450px' }}>
      <h3 style={{ textAlign: 'center' }}>{t('observability.cpuUsage')}</h3>
      <ResponsiveContainer>
        <LineChart
          data={data}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="Time"
            tickFormatter={(timeStr) => new Date(timeStr).toLocaleTimeString()}
            angle={-90}
            textAnchor="end"
            height={60}
            interval="preserveStartEnd"
          />
          <YAxis domain={[yAxisMin, yAxisMax]} />
          <Tooltip
            labelFormatter={(label) => new Date(label).toLocaleString()}
            contentStyle={{ backgroundColor: '#333', border: 'none' }}
            itemStyle={{ color: '#fff' }}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            wrapperStyle={{ position: 'relative', marginTop: '10px' }}
          />
          <ReferenceLine
            y={79}
            stroke="black"
            strokeWidth={1}
            // label={{ value: "80% CPU Usage", position: "right" }}
          />
          <Line
            type="linear"
            dataKey="CPU Utilization (%)"
            stroke="#8884d8"
            strokeWidth={3}
            dot={<CustomizedDot />}
            activeDot={{ r: 8 }}
            isAnimationActive={false}
            name={t('observability.cpuUsage')}
          />
          <Line
            type="linear"
            dataKey="Running Median"
            stroke="#82ca9d"
            strokeWidth={3}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
            name={t('observability.median')}
          />
          <Line
            type="linear"
            dataKey="Upper Threshold"
            stroke="#ff7300"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            activeDot={false}
            isAnimationActive={false}
            name={t('observability.upperBound')}
          />
          <Line
            type="linear"
            dataKey="Lower Threshold"
            stroke="#ff7300"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            activeDot={false}
            isAnimationActive={false}
            name={t('observability.lowerBound')}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default CPUUsageChart;
