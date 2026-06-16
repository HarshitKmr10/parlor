import React, { useMemo } from 'react';
import { ObjectUtils } from 'utils/objectUtils';
import {
  Box, Flex, Text, Card, Badge,
} from '@radix-ui/themes';
import AIChatIcon from 'components/icons/AIChatIcon';

interface EntityObj {
  [key: string]: string[] | Array<{ [key: string]: string }>;
}

function NoPostCallEntities() {
  return (
    <Flex>
      <Text size="2" color="gray" weight="medium">
        No entities detected
      </Text>
    </Flex>
  );
}

function PostCallEntities({ entity, loading, agentName="" }) {
  const entityDisplay = useMemo(() => {
    if (loading) {
      return (
        <Box>
          {[...Array(3)].map((_, index) => (
            <Box key={index} mb="2">
              <div
                className="loading-skeleton"
                style={{
                  width: '100px',
                  height: '16px',
                  backgroundColor: 'var(--accent-4)',
                  borderRadius: 'var(--radius-2)',
                  marginBottom: '8px',
                }}
              />
              <Flex wrap="wrap" gap="2" mt="1">
                {[...Array(3)].map((badgeIndex) => (
                  <div
                    key={badgeIndex}
                    className="loading-skeleton"
                    style={{
                      width: '80px',
                      height: '24px',
                      backgroundColor: 'var(--accent-4)',
                      borderRadius: 'var(--radius-2)',
                    }}
                  />
                ))}
              </Flex>
            </Box>
          ))}
        </Box>
      );
    }

    try {
      const parsedEntityObj: Record<
      string,
      EntityObj
      > = ObjectUtils.parseObject(entity);
      const entries = Object.entries(parsedEntityObj);
      if (!entity || ObjectUtils.isEmptyObject(entity)) {
        return <NoPostCallEntities />;
      }

      return entries.map(([key, values]) => (
        <Box key={key} mb="2">
          <Text size="2" weight="bold" mb="2">
            {key}
          </Text>
          <Flex wrap="wrap" gap="2" mt="1">
            {Array.isArray(values)
              && values.map((value) => {
                if (typeof value === 'object' && value !== null) {
                  const compoundKey = Object.entries(value)
                    .map(([subKey, subValue]) => `${subKey}-${subValue}`)
                    .join('|');
                  return (
                    <Card key={`card-${compoundKey}`} variant="surface">
                      {Object.entries(value).map(([subKey, subValue]) => (
                        <Text key={`text-${subKey}-${subValue}`} size="1">
                          {`${subKey}: ${subValue}`}
                        </Text>
                      ))}
                    </Card>
                  );
                }
                return (
                  <Badge key="badge" size="3" variant="surface">
                    {value}
                  </Badge>
                );
              })}
          </Flex>
        </Box>
      ));
    } catch (error) {
      return <NoPostCallEntities />;
    }
  }, [entity, loading]);

  return (
    <Box className="border-b border-[var(--accent-3)] py-2">
      <Flex gap="2">
        <Box className="ml-3">
          <AIChatIcon />
        </Box>
        <Flex direction="column">
          <Flex gap="2">
            <Text size="2" weight="bold" style={{ color: 'var(--pink-9)' }}>
              {agentName || "Co-Resolve from Servicedesk AI"}
            </Text>
            <Badge>AI Generated</Badge>
          </Flex>
          <Box style={{ overflowY: 'auto' }}>{entityDisplay}</Box>
        </Flex>
      </Flex>
    </Box>
  );
}

export default PostCallEntities;
