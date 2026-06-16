'use client';

import React from 'react';
import { Box, Flex, Text, Button, Dialog } from '@radix-ui/themes';
import { X, MoreHorizontal, ArrowRight } from 'lucide-react';
import SparklesIcon from '@/components/icons/SparklesIcon';
import WandIcon from '@/components/icons/WandIcon';

interface VVASummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: string;
  category?: string;
  assignee?: {
    name: string;
    avatar?: string;
  };
}

const VVASummaryDialog: React.FC<VVASummaryDialogProps> = ({
  open,
  onOpenChange,
  summary,
  category = "NETWORK ISSUE",
  assignee
}) => {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <Box className="bg-[#FAF6FE] border border-[#A7A1D3] rounded-lg p-6">
          {/* Header Section */}
          <Flex justify="between" align="center" className="mb-4">
            <Flex align="center" gap="2">
              <Box className="border-[#A7A1D3] border px-3 py-2 rounded-md flex items-center gap-2">
                <SparklesIcon className="w-4 h-4" />
                <Text size="2" weight="medium">VVA Summary</Text>
              </Box>
            </Flex>
            <Flex align="center" gap="2">
              <WandIcon className="w-5 h-5" />
              <Dialog.Close>
                <Button variant="ghost" size="1" className="text-gray-500 hover:text-gray-700">
                  <X className="w-4 h-4" />
                </Button>
              </Dialog.Close>
            </Flex>
          </Flex>

          {/* Content Section */}
          <Box className="mb-6">
            <Text size="4" weight="medium" className="text-[#222222] mb-4 block">
              User unable to connect to the Colossus VPN.
            </Text>
            
            <Text size="3" className="text-neutral-l2 mb-4 block">
              Root cause may be related to network connectivity, VPN client configuration, firewall restrictions, or VPN client errors.
            </Text>

            <Text size="3" weight="medium" className="text-[#222222] mb-3 block">
              Troubleshooting steps followed:
            </Text>
            
            <Box className="ml-4">
              <Text size="2" className="text-neutral-l2 mb-2 block">
                • Verify stable internet/network connectivity.
              </Text>
              <Text size="2" className="text-neutral-l2 mb-2 block">
                • Confirm VPN configuration settings are accurate (server address, credentials, authentication method, etc.).
              </Text>
              <Text size="2" className="text-neutral-l2 mb-2 block">
                • Check firewall and antivirus settings.
              </Text>
            </Box>

            <Box className="mt-4 p-4 bg-white border border-[#E8E8E8] rounded-md">
              <Text size="2" className="text-[#646464] mb-2 block" weight="medium">
                Additional Details:
              </Text>
              <Text size="2" className="text-neutral-l2">
                {summary}
              </Text>
            </Box>
          </Box>

          {/* Footer Section */}
          <Flex justify="between" align="center">
            <Flex align="center" gap="3">
              <Flex align="center" justify="center" className="border border-[#A7A1D3] text-neutral-l2 h-8 px-3 rounded-md">
                <Text size="2" weight="medium">{category}</Text>
              </Flex>
              
              {assignee && (
                <Flex align="center" gap="3">
                  <Flex align="center" gap="2" className="border border-[#E8E8E8] text-[#646464] h-8 px-3 rounded-md bg-white">
                    <Box className="w-5 h-5 bg-gradient-to-br from-purple-400 to-pink-400 rounded-md flex items-center justify-center">
                      <Text size="1" className="text-white font-bold">
                        {assignee.name.charAt(0)}
                      </Text>
                    </Box>
                    <Text size="2" weight="medium" className="text-[#646464]">
                      {assignee.name}
                    </Text>
                  </Flex>
                  <Flex align="center" justify="center" className="border border-[#E8E8E8] text-[#646464] h-8 px-3 rounded-md bg-white">
                    <MoreHorizontal className="w-4 h-4 text-gray-400" />
                  </Flex>
                </Flex>
              )}
            </Flex>

            <Button 
              size="3" 
              variant="solid"
              className="bg-black hover:bg-gray-800 text-white px-4 py-2 flex items-center gap-2"
              onClick={() => {
                console.log('View ticket clicked');
                onOpenChange(false);
              }}
            >
              <Text size="2" weight="medium">View Ticket</Text>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Flex>
        </Box>
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default VVASummaryDialog;
