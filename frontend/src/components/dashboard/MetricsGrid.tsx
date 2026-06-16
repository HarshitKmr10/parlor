'use client';

import { Box, Grid, Text, Flex } from '@radix-ui/themes';
import { useState } from 'react';
import { GridDetailsSidebar } from 'components/dashboard/GridDetailsSidebar';

interface MetricBadgeProps {
  id: string;
  value: string;
  color?: 'blue' | 'red' | 'green' | 'gray';
}

function MetricBadge({ id, value, color = 'blue' }: MetricBadgeProps) {
  const colorMap = {
    blue: 'var(--blue-a5)',
    red: 'var(--red-a5)',
    green: 'var(--green-a5)',
    gray: 'var(--gray-a5)',
  };

  return (
    <Box
      px="2"
      py="1"
      style={{
        backgroundColor: colorMap[color],
        borderRadius: 'var(--radius-2)',
        display: 'inline-block',
        marginRight: '4px'
      }}
    >
      <Text size="1" style={{ color: `var(--${color}-11)` }}>
        ({id}) {value}
      </Text>
    </Box>
  );
}

interface MetricCellProps {
  percentage: string;
  badges?: Array<{
    id: string;
    value: string;
    color?: 'blue' | 'red' | 'green' | 'gray';
  }>;
}

function MetricCell({ percentage, badges = [] }: MetricCellProps) {
  return (
    <Box p="3">
      <Text weight="medium">{percentage}</Text>
      <Flex wrap="wrap" gap="1" mt="1">
        {badges.map((badge, index) => (
          <MetricBadge key={index} {...badge} />
        ))}
      </Flex>
    </Box>
  );
}

interface GridData {
  [key: string]: {
    [category: string]: {
      percentage: string;
      badges?: Array<{
        id: string;
        value: string;
        color?: 'blue' | 'red' | 'green' | 'gray';
      }>;
    };
  };
}

// Dummy data structure that would come from backend
const gridData: GridData = {
  'Troubleshoot': {
    'Actions/Resources': {
      percentage: '14.7%',
      badges: [{ id: '456', value: 'Salesforce', color: 'blue' }]
    },
    'Software': {
      percentage: '40.5%'
    },
    'Authentication': {
      percentage: '14.7%',
      badges: [
        { id: '456', value: 'Salesforce', color: 'gray' },
        { id: '245', value: 'Tableau', color: 'green' }
      ]
    },
    'Account': {
      percentage: '14.7%',
      badges: [{ id: '456', value: 'Salesforce', color: 'red' }]
    },
    'Hardware': {
      percentage: '14.7%',
      badges: [{ id: '456', value: 'Salesforce', color: 'blue' }]
    },
    'Miscellaneous': {
      percentage: '14.7%'
    }
  },
  'Fix': {
    'Actions/Resources': {
      percentage: '14.7%',
      badges: [{ id: '456', value: 'Salesforce', color: 'blue' }]
    },
    'Software': {
      percentage: '40.5%'
    },
    // ... similar structure for other categories
  },
  // ... similar structure for other actions
};

const categories = [
  'Actions/Resources',
  'Software',
  'Authentication',
  'Account',
  'Hardware',
  'Miscellaneous'
];

const actions = [
  'Troubleshoot',
  'Fix',
  'Manage',
  'Update',
  'Provision'
];

export function MetricsGrid() {
  const [sidebarData, setSidebarData] = useState<any>(null);

  const handleCellClick = (action: string, category: string) => {
    const data = {
      title: `${action} ${category}`,
      totalEmployees: 4131,
      totalIssues: 6725,
      metrics: {
        issuesPerEmployee: 1.6,
        timeToResolution: 33.7,
        firstTouchResolution: 91.6
      },
      topics: [
        {
          name: 'Microsoft',
          issues: 496,
          employees: 313,
          tttr: 73.6,
          examples: [
            { text: 'Forgot Microsoft password' },
            { text: 'Locked out of Microsoft' },
            { text: 'Need access to Microsoft' },
            { text: 'Microsoft not working' }
          ]
        },
        {
          name: 'Tableau',
          issues: 496,
          employees: 313,
          tttr: 73.6
        },
        {
          name: 'IBM Maximo',
          issues: 496,
          employees: 313,
          tttr: 73.6
        }
      ]
    };
    setSidebarData(data);
  };

  const totalColumns = (categories.length + 1).toString() as "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

  return (
    <Box style={{
      borderRadius: 6,
      border: '1px solid var(--gray-5)',
      backgroundColor: 'white',
      padding: 25,
    }}>
      <Text size="5" weight="medium" style={{ marginBottom: '24px' }}>
        Agents on this platform
      </Text>
      
      <Grid columns={totalColumns} style={{ 
        top: '10px',
        borderBottom: '1px solid var(--gray-5)',
        borderLeft: '1px solid var(--gray-5)',
      }}>
        
        {/* Header Row */}
        <Box p="4" style={{ 
          borderTop: '1px solid var(--gray-5)',
          borderRight: '1px solid var(--gray-5)',
          borderBottom: '1px solid var(--gray-5)',
          backgroundColor: 'var(--gray-2)'
        }}>
          <Text weight="medium" color="gray"></Text>
        </Box>
        {categories.map((category) => (
          <Box key={category} p="3" style={{ 
            borderTop: '1px solid var(--gray-5)',
            borderRight: '1px solid var(--gray-5)',
            borderBottom: '1px solid var(--gray-5)',
            backgroundColor: 'var(--gray-2)'
          }}>
            <Text weight="medium" color="gray">{category}</Text>
          </Box>
        ))}

        {/* Data Rows */}
        {actions.map((action) => (
          <>
            <Box key={action} p="3" style={{ 
              borderRight: '1px solid var(--gray-5)',
              borderBottom: '1px solid var(--gray-5)',
              backgroundColor: 'var(--gray-2)'
            }}>
              <Text weight="medium" color="gray">{action}</Text>
            </Box>
            {categories.map((category) => {
              const cellData = gridData[action]?.[category] || { percentage: '0%' };
              return (
                <Box 
                  key={`${action}-${category}`} 
                  style={{ 
                    borderRight: '1px solid var(--gray-5)',
                    borderBottom: '1px solid var(--gray-5)',
                    cursor: 'pointer'
                  }}
                  onClick={() => handleCellClick(action, category)}
                >
                  <MetricCell 
                    percentage={cellData.percentage}
                    badges={cellData.badges}
                  />
                </Box>
              );
            })}
          </>
        ))}
      </Grid>

      <GridDetailsSidebar
        isOpen={!!sidebarData}
        onClose={() => setSidebarData(null)}
        data={sidebarData}
      />
    </Box>
  );
} 