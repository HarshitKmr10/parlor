'use client';

// ─── Imports ─────────────────────────────────────────────────────
import { Box, Text, Table, Flex } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { useCvaUserStatsData } from 'hooks/useCvaUserStatsData';
import CustomAvatar from 'components/CustomAvatar';
import Shimmer from 'components/common/Shimmer';

// ─── Props ───────────────────────────────────────────────────────
interface Props {
  orgId: string;
  timeframe: string;
}

// ─── Component ───────────────────────────────────────────────────
const UserStatsTable = ({ orgId, timeframe }: Props) => {
  const { t } = useTranslation();
  const { data, loading } = useCvaUserStatsData(orgId, timeframe);
  const noData = !loading && (!data || data.length === 0);

  return (
    <Box className="mb-6 rounded-lg border bg-white p-4">
      {/* Header */}
      <Flex justify="between" align="center" mb="4">
        <Text size="4" weight="medium" className="pl-3.5">
          {t('dashboard.usersOfPlatform')}
        </Text>
      </Flex>

      {/* Table */}
      <Box className="h-[241px] overflow-y-auto">
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>
                <Text size="2" weight="regular" className="leading-[100%] text-gray-600">
                  {t('dashboard.employees')}
                </Text>
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>
                <Text size="2" weight="regular" className="leading-[100%] text-gray-600">
                  {t('dashboard.totalQueries')}
                </Text>
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>
                <Text size="2" weight="regular" className="leading-[100%] text-gray-600">
                  {t('dashboard.totalIssues')}
                </Text>
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>
                <Text size="2" weight="regular" className="leading-[100%] text-gray-600">
                  {t('dashboard.totalTickets')}
                </Text>
              </Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>

          {/* Loading */}
          {loading && (
            <Table.Body>
              {[...Array(6)].map((_, index) => (
                <Table.Row key={index}>
                  <Table.Cell>
                    <Flex gap="3">
                      <Shimmer borderRadius="10%" height="24px" width="24px" />
                      <Shimmer width="6rem" height="1.5rem" />
                    </Flex>
                  </Table.Cell>
                  <Table.Cell>
                    <Shimmer width="3rem" height="2rem" />
                  </Table.Cell>
                  <Table.Cell>
                    <Shimmer width="3rem" height="2rem" />
                  </Table.Cell>
                  <Table.Cell>
                    <Shimmer width="3rem" height="2rem" />
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          )}

          {/* No Data */}
          {noData && (
            <Table.Body>
              <Table.Row>
                <Table.Cell colSpan={4} style={{ boxShadow: 'none' }}>
                  <Flex justify="center" align="center" className="h-[160px]">
                    <Text size="2" color="gray">
                      {t('dashboard.noDataFound')}
                    </Text>
                  </Flex>
                </Table.Cell>
              </Table.Row>
            </Table.Body>
          )}

          {/* Actual Data */}
          {!loading && data && data.length > 0 && (
            <Table.Body>
              {data.map((user, index) => (
                <Table.Row key={user.user_id ?? `user-${index}`}>
                  <Table.Cell>
                    <Flex gap="2" align="center">
                      <CustomAvatar
                        alt={user.name}
                        name={user.name}
                        extra="rounded-sm bg-gray-200 text-xs"
                        height="24px"
                        width="24px"
                        src={null}
                      />
                      <Text size="2" weight="regular" className="text-neutral-l2">
                        {user.name}
                      </Text>
                    </Flex>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="2" weight="regular" className="text-neutral-l2">
                      {user.total_queries}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="2" weight="regular" className="text-neutral-l2">
                      {user.total_issues}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="2" weight="regular" className="text-neutral-l2">
                      {user.tickets}
                    </Text>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          )}
        </Table.Root>
      </Box>
    </Box>
  );
};

export default UserStatsTable;
