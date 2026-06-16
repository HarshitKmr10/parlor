import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Table } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import rawData from './DSLModelSystem.json';

function NotificationTable({ isPresent }) {
  const { t } = useTranslation();
  return (
    <Table.Root style={{ marginBottom: '20px' }}>
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
            {t('observability.modemIp')}
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
        {isPresent && (
          <Table.Row>
            <Table.Cell style={{ width: '20%', whiteSpace: 'normal' }}>
              01-08-2024 1:00
            </Table.Cell>
            <Table.Cell style={{ width: '20%', whiteSpace: 'normal' }}>
              {t('observability.wanLinkNotification', { modemIp: '192.0.2.146', location: 'us-west-2', count: 4, hours: 6 })}
            </Table.Cell>
            <Table.Cell style={{ width: '20%', whiteSpace: 'normal' }}>
              192.0.2.146
            </Table.Cell>
            <Table.Cell style={{ width: '20%', whiteSpace: 'normal' }}>
              us-west-2
            </Table.Cell>
            <Table.Cell style={{ width: '20%', whiteSpace: 'normal' }}>
              <a href="https://dev209832.service-now.com/now/nav/ui/classic/params/target/incident.do%3Fsys_id%3Ddcf78b0093e0d6d05df2f7718bba1070" target="_blank">
                INC0010933
              </a>
            </Table.Cell>
          </Table.Row>
        )}
      </Table.Body>
    </Table.Root>
  );
}

function FlickerCountChart() {
  const { t } = useTranslation();
  const [visibleData, setVisibleData] = useState([]);
  const [index, setIndex] = useState(0);
  const [showNotification, setShowNotification] = useState(false);

  useEffect(() => {
    if (index < rawData.length) {
      const interval = setTimeout(() => {
        setVisibleData((prevData) => [...prevData, rawData[index]]);
        setIndex((prevIndex) => prevIndex + 1);

        // Check if the current time_point matches the specified value
        if (rawData[index].time_point === 1722541200000) {
          setShowNotification(true);
        }
      }, 100);
      return () => clearTimeout(interval);
    }
  }, [index]);

  const formatXAxis = (timestamp) => new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const modifiedData = visibleData.map((data) => ({
    time_point: data.time_point,
    Flicker_Count_Normal: data.Status === 'Normal' ? data.Flicker_Count : null,
    Flicker_Count_Abnormal:
      data.Status === 'Abnormal' ? data.Flicker_Count : null,
  }));

  return (
    <div className="w-full">
      <h3 style={{ textAlign: 'center' }}>{t('observability.wanLinkFlicker')}</h3>

      <div className="h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={modifiedData}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 5,
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
              label={{
                value: t('observability.timestamp'),
                position: 'insideBottomRight',
              }}
              height={100}
            />
            <YAxis
              domain={[0, 'dataMax + 1']}
              label={{
                value: t('observability.flickerCount'),
                angle: -90,
                position: 'insideLeft',
              }}
            />
            <Tooltip
              labelFormatter={(label) => formatXAxis(label)}
              formatter={(value, name) => [value, t('observability.flickerCount')]}
            />
            <Legend verticalAlign="top" height={36} />
            <Line
              type="monotone"
              dataKey="Flicker_Count_Normal"
              stroke="blue"
              strokeWidth={1}
              dot={false}
              isAnimationActive={false}
              activeDot={false}
              name={t('observability.actual')}
            />
            <Line
              type="monotone"
              dataKey="Flicker_Count_Abnormal"
              stroke="red"
              strokeWidth={1}
              dot={false}
              activeDot={false}
              isAnimationActive={false}
              name={t('observability.predicted')}
            />
          </LineChart>
        </ResponsiveContainer>
        <NotificationTable isPresent={showNotification} />
      </div>
    </div>
  );
}

export default FlickerCountChart;
