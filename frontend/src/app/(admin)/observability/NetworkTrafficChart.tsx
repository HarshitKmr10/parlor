import React, { useState, useEffect } from 'react';
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
import { Table } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import rawData from './NetworkTrafficData.json';

function NetworkTrafficChart() {
  const { t } = useTranslation();
  const [visibleData, setVisibleData] = useState([]);
  const [index, setIndex] = useState(0);
  const [showNotification, setShowNotification] = useState(false);

  useEffect(() => {
    if (index < rawData.length) {
      const interval = setTimeout(() => {
        setVisibleData((prevData) => [...prevData, rawData[index]]);
        setIndex((prevIndex) => prevIndex + 1);
        if (rawData[index].Date === 1723114800000) {
          setShowNotification(true);
        }
      }, 100);
      return () => clearTimeout(interval);
    }
  }, [index]);

  const formatXAxis = (timestamp) => {
    const date = new Date(timestamp);
    return `${date.getDate().toString().padStart(2, '0')}-${(
      date.getMonth() + 1
    )
      .toString()
      .padStart(2, '0')} ${date
      .getHours()
      .toString()
      .padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  function NotificationTable({ isPresent }) {
    const { t } = useTranslation();
    return (
      <Table.Root style={{ marginBottom: '20px' }}>
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell
              style={{ width: '14.2%', whiteSpace: 'normal' }}
            >
              {t('observability.notificationTriggered')}
            </Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell
              style={{ width: '14.2%', whiteSpace: 'normal' }}
            >
              {t('observability.summaryOfNotificationNetwork')}
            </Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell
              style={{ width: '14.2%', whiteSpace: 'normal' }}
            >
              {t('observability.routerIp')}
            </Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell
              style={{ width: '14.2%', whiteSpace: 'normal' }}
            >
              {t('observability.inboundTraffic')}
            </Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell
              style={{ width: '14.2%', whiteSpace: 'normal' }}
            >
              {t('observability.outboundTraffic')}
            </Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell
              style={{ width: '14.2%', whiteSpace: 'normal' }}
            >
              {t('observability.location')}
            </Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell
              style={{ width: '14.2%', whiteSpace: 'normal' }}
            >
              {t('observability.ticketId')}
            </Table.ColumnHeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {isPresent && (
            <Table.Row>
              <Table.Cell style={{ width: '14.2%', whiteSpace: 'normal' }}>
                08-08-14.224 05:30
              </Table.Cell>
              <Table.Cell style={{ width: '14.2%', whiteSpace: 'normal' }}>
                {t('observability.networkTrafficNotification', { routerIp: '192.0.2.146', location: 'us-east-1', threshold: 240 })}
              </Table.Cell>
              <Table.Cell style={{ width: '14.2%', whiteSpace: 'normal' }}>
                192.0.2.146
              </Table.Cell>
              <Table.Cell style={{ width: '14.2%', whiteSpace: 'normal' }}>
                185.5
              </Table.Cell>
              <Table.Cell style={{ width: '14.2%', whiteSpace: 'normal' }}>
                278.2
              </Table.Cell>
              <Table.Cell style={{ width: '14.2%', whiteSpace: 'normal' }}>
                us_east_1
              </Table.Cell>
              <Table.Cell style={{ width: '14.2%', whiteSpace: 'normal' }}>
                <a href="https://dev209832.service-now.com/now/nav/ui/classic/params/target/incident.do%3Fsys_id%3Dc1660f0c9360d6d05df2f7718bba1076" target="_blank">
                  INC0010156
                </a>
              </Table.Cell>
            </Table.Row>
          )}
        </Table.Body>
      </Table.Root>
    );
  }
  return (
    <div className="w-full">
      <h3 style={{ textAlign: 'center' }}>{t('observability.networkTrafficAnalysis')}</h3>
      <div className="h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={visibleData}
            margin={{
              top: 5,
              right: 30,
              left: 60,
              bottom: 50,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="Date"
              tickFormatter={formatXAxis}
              angle={-45}
              textAnchor="end"
              height={80}
              label={{
                value: t('observability.timestamp'),
                position: 'insideBottomRight',
                offset: -10,
              }}
            />
            <YAxis
              label={{
                value: t('observability.trafficKbs'),
                angle: -90,
                position: 'insideLeft',
                offset: -40,
              }}
            />
            <Tooltip labelFormatter={formatXAxis} />
            <Legend verticalAlign="top" height={36} />
            <ReferenceLine
              y={240000}
              stroke="red"
              strokeDasharray="3 3"
              label={{
                value: t('observability.outboundThreshold', { value: '240000.00' }),
                position: 'top',
                fill: 'red',
              }}
            />
            <ReferenceLine
              y={160000}
              stroke="orange"
              strokeDasharray="3 3"
              label={{
                value: t('observability.inboundThreshold', { value: '160000.00' }),
                position: 'top',
                fill: 'orange',
              }}
            />
            <Line
              type="monotone"
              dataKey={(data) => (data.Status === 'Normal' ? data['Out Traffic (kb/s)'] : null)}
              stroke="blue"
              name={t('observability.outboundTrafficLabel')}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey={(data) => (data.Status === 'Normal' ? data['In Traffic (kb/s)'] : null)}
              stroke="green"
              name={t('observability.inboundTrafficLabel')}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey={(data) => (data.Status === 'Prediction' ? data['Out Traffic (kb/s)'] : null)}
              stroke="blue"
              strokeDasharray="2 2"
              name={t('observability.outboundTrafficPredicted')}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey={(data) => (data.Status === 'Prediction' ? data['In Traffic (kb/s)'] : null)}
              stroke="green"
              strokeDasharray="2 2"
              name={t('observability.inboundTrafficPredicted')}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
        <NotificationTable isPresent={showNotification} />
      </div>
    </div>
  );
}

export default NetworkTrafficChart;
