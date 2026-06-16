import React from 'react';
import {
  Box, Card, Flex, Text, Button, Badge,
} from '@radix-ui/themes';
import { useRouter } from 'next/navigation';

interface IncidentListProps {
  incidents: any;
}

function IncidentList({ incidents }: IncidentListProps) {
  const router = useRouter();

  const handleIncidentClick = (incident: string) => {
    router.push(
      `/train-assist/learn/${incident.toLowerCase().replace(/ /g, '-')}`,
    );
  };

  return (
    <Box>
      <Text size="7" weight="medium" color="gray">
        Top Incidents to Practice
      </Text>
      <div className="mt-4">
        {incidents.map((incident, index) => (
          <Card key={index} className="mb-4 flex flex-col p-4">
            <Text size="3" weight="bold" mb="2">
              {`${index + 1}. ${
                incident.title
              }`}
            </Text>
            <Text size="2" color="gray" mb="2">
              {incident.description}
            </Text>
            <Flex justify="between" align="center">
              <Button
                variant="outline"
                size="2"
                onClick={(e) => {
                  e.stopPropagation();
                  handleIncidentClick(incident.title);
                }}
                className="cursor-pointer"
              >
                Start Simulation
              </Button>
              <Flex align="center" gap="2">
                <Badge variant="soft">
                  Category:
                  {incident.category}
                </Badge>
                <Badge
                  color={
                    incident.difficulty === 'Intermediate'
                      ? 'yellow'
                      : incident.difficulty === 'Advanced'
                        ? 'red'
                        : 'green'
                  }
                >
                  Difficulty Level:
                  {' '}
                  {incident.difficulty}
                </Badge>
              </Flex>
            </Flex>
          </Card>
        ))}
      </div>
    </Box>
  );
}

export default IncidentList;
