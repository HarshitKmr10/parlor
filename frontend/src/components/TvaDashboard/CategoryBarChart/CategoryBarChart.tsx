'use client';

import { Box, Text, Table, Flex } from '@radix-ui/themes';
import { useGlobalContext } from 'contexts/store';
import Shimmer from 'components/common/Shimmer';
import { useKbaMetrics } from '../../../hooks/ticketting-assist';
import FileIcon from 'components/icons/FileIcon';
import OccuranceIcon from 'components/icons/OccurancesIcon';

interface KBListingProps {
  timeframe?: string;
}

const KBListing = ({ timeframe = '30days' }: KBListingProps) => {
  const { user } = useGlobalContext();
  const org_id = user?.org_id;
  
  const { data, loading } = useKbaMetrics(org_id || '', timeframe);

  const renderShimmerLoading = () => (
    <Table.Body>
      {[...Array(6)].map((_, index) => (
        <Table.Row key={index}>
          <Table.Cell>
            <Flex align="center" gap="3">
              <Shimmer width="1.5rem" height="1.5rem" />
              <Shimmer width="8rem" height="1.5rem" />
            </Flex>
          </Table.Cell>
          <Table.Cell>
            <Flex align="center" justify="end" gap="2">
              <Shimmer width="6rem" height="1.5rem" />
            </Flex>
          </Table.Cell>
        </Table.Row>
      ))}
    </Table.Body>
  );

  const noData = !loading && (!data?.kba_data || data.kba_data.length === 0);

  return (
    <Box className="mb-6 h-full rounded-lg border bg-white p-4">
      <Flex justify="between" align="center" mb="0">
        <Text size="4" weight="medium">
          Most Used KBs by TVA
        </Text>
      </Flex>

      <Box className="h-[241px] overflow-y-auto">
        <Table.Root>
          {/* No Data */}
          {noData && (
            <Table.Body>
              <Table.Row>
                <Table.Cell colSpan={4} style={{ boxShadow: 'none' }}>
                  <Flex justify="center" align="center" className="h-[200px]">
                    <Text size="2" color="gray">
                      No data found
                    </Text>
                  </Flex>
                </Table.Cell>
              </Table.Row>
            </Table.Body>
          )}
          <Table.Body>
            {data?.kba_data?.slice(0, 6).map((item, index) => (
              <Table.Row key={index}>
                <Table.Cell className="w-[70%]">
                  <Flex align="center" gap="3">
                    <Flex
                      align={'center'}
                      justify={'center'}
                      className="h-6 w-6 rounded bg-[#EEF4FF]"
                    >
                      <FileIcon />
                    </Flex>
                    <div className="flex items-center justify-between">
                      <Text size="2" weight="regular" className="text-neutral-l2">
                        {item.name}
                      </Text>
                    </div>
                  </Flex>
                </Table.Cell>
                <Table.Cell className="w-[30%]">
                  <Flex align="center" justify="end" gap="2">
                    <Box className="flex items-center gap-2">
                      <OccuranceIcon />
                      <Text size="2" weight="regular" className="text-neutral-l2">
                        {item.count} times
                      </Text>
                    </Box>
                  </Flex>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
          {loading && renderShimmerLoading()}
        </Table.Root>
      </Box>
    </Box>
  );
};

export default KBListing;
