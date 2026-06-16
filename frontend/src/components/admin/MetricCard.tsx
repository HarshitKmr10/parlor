import React from 'react';
import {
  Flex, Text,
} from '@radix-ui/themes';

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  annotation?: string;
  annotationColor?: 'green' | 'red';
}

export const MetricCard = ({
  icon, label, value, annotation, annotationColor = 'green',
}: MetricCardProps) => (
        <Flex direction="row" gap="2" className="bg-white rounded-lg p-4 flex-1">
            {icon}
            <Flex direction="column">
                <Text size="2" weight="medium">{label}</Text>
                <Flex direction="row" align="baseline" gap="1">
                    <Text size="6" weight="medium">{value}</Text>
                    {!!annotation && <Text size="2" weight="medium" color={annotationColor}>{annotation}</Text>}
                </Flex>
            </Flex>
        </Flex>
);
