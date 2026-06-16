import { Table } from '@radix-ui/themes';
import React, { useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useTranslation } from 'react-i18next';

// Function to transform the data for range handling and assign fill colors
const transformData = (data) => data.map((item) => ({
  time_point: item.time_point,
  range: [
    item.Lower_Bound !== null ? item.Lower_Bound : item.Available_Space_GB, // Lower bound
    item.Upper_Bound !== null ? item.Upper_Bound : item.Available_Space_GB, // Upper bound
  ],
  Available_Space_GB: item.Available_Space_GB, // Value for line chart
  hasBounds: item.Upper_Bound !== null && item.Lower_Bound !== null, // Check if bounds exist
  fillColor:
      item.Upper_Bound !== null && item.Lower_Bound !== null
        ? 'yellow'
        : '#8884d8', // Conditional color
}));

function NotificationTable({ isLoaded }) {
  const { t } = useTranslation();
  return (
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeaderCell
            style={{ width: '20%', whiteSpace: 'normal' }}
          >
            {t('observability.notificationTriggered')}
          </Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell
            style={{ width: '20%', whiteSpace: 'normal' }}
          >
            {t('observability.summaryOfNotification')}
          </Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell
            style={{ width: '20%', whiteSpace: 'normal' }}
          >
            {t('observability.deviceId')}
          </Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell
            style={{ width: '20%', whiteSpace: 'normal' }}
          >
            {t('observability.location')}
          </Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell
            style={{ width: '20%', whiteSpace: 'normal' }}
          >
            {t('observability.ticketId')}
          </Table.ColumnHeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {isLoaded && (
          <Table.Row>
            <Table.Cell style={{ width: '20%', whiteSpace: 'normal' }}>
              06-08-2024 8:30
            </Table.Cell>
            <Table.Cell style={{ width: '20%', whiteSpace: 'normal' }}>
              {t('observability.diskSpaceNotification', { deviceId: 'SDX-DEVA-METR01', location: 'us-east-1' })}
            </Table.Cell>
            <Table.Cell style={{ width: '20%', whiteSpace: 'normal' }}>
              SDX-DEVA-METR01
            </Table.Cell>
            <Table.Cell style={{ width: '20%', whiteSpace: 'normal' }}>
              us-east-1
            </Table.Cell>
            <Table.Cell style={{ width: '20%', whiteSpace: 'normal' }}>
              <a href="https://dev209832.service-now.com/now/nav/ui/classic/params/target/incident.do%3Fsys_id%3D57178b0093e0d6d05df2f7718bba1076" target="_blank">
                INC0010932
              </a>
            </Table.Cell>
          </Table.Row>
        )}
      </Table.Body>
    </Table.Root>
  );
}

function PredictionChart({ predictionData }) {
  const { t } = useTranslation();
  const [visibleData, setVisibleData] = useState([]);
  const [index, setIndex] = useState(0);
  const [showNotification, setShowNotification] = useState(false);

  useEffect(() => {
    const transformedData = transformData(predictionData);
    let hasBounds = false;

    if (index < transformedData.length) {
      const interval = setTimeout(
        () => {
          setVisibleData((prevData) => [...prevData, transformedData[index]]);
          setIndex((prevIndex) => prevIndex + 1);
          hasBounds = transformedData[index].hasBounds;

          // Check if the current time_point matches the specified value
          if (transformedData[index].time_point === 1722913200000) {
            setShowNotification(true);
          }
        },
        hasBounds ? 1 : 100,
      );
      return () => clearTimeout(interval);
    }
  }, [index, predictionData]);

  return (
    <div style={{ width: '100%', height: '500px' }}>
      {/* <h3 style={{ textAlign: "center" }}>Disk Usage Percentage</h3> Add graph title */}
      <div className="w-full">
        <div className="text-center">{t('observability.availableDiskSpace')}</div>
      </div>

      <ResponsiveContainer>
        <AreaChart
          data={visibleData}
          margin={{
            top: 10,
            right: 30,
            left: 30,
            bottom: 0,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="time_point"
            tickFormatter={(timeStr) => {
              const date = new Date(timeStr);
              return `${date.getDate().toString().padStart(2, '0')}-${(
                date.getMonth() + 1
              )
                .toString()
                .padStart(2, '0')}-${date
                .getFullYear()
                .toString()
                .slice(-2)} ${date.getHours().toString().padStart(2, '0')}`;
            }}
            angle={-45} // Angle for better visibility
            textAnchor="end"
            height={110} // Increase the height of the X-axis for more space
            label={{
              value: t('observability.timestamp'),
              position: 'insideBottomRight',
              //   offset: -10,
            }}
          />
          <YAxis
            label={{
              value: t('observability.availableDiskSpace'),
              angle: -90,
              position: 'insideLeft',
            }}
          />
          {/* Add Y-axis label */}
          <Tooltip
            labelFormatter={(label) => new Date(label).toLocaleString()}
            contentStyle={{ backgroundColor: '#333', border: 'none' }}
            itemStyle={{ color: '#fff' }}
          />
          {/* Add the legend */}
          <Legend verticalAlign="top" height={36} />
          {/* Area chart to show bands between the ranges */}
          <Area
            type="linear"
            dataKey="range"
            stroke="#8884d8"
            fillOpacity={0.3}
            isAnimationActive={false}
            name={t('observability.availableDiskSpace')}
          />
          {/* Line chart to show the value in between the bounds */}
          <Line
            type="linear"
            dataKey="Available_Space_GB"
            stroke="#000" // Black line for better contrast
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            name={t('observability.usagePercent')} // Add name for the legend
          />
        </AreaChart>
      </ResponsiveContainer>
      <NotificationTable isLoaded={showNotification} />
    </div>
  );
}

export default PredictionChart;
