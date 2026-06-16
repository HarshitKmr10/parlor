import { CopyIcon, DotsVerticalIcon } from '@radix-ui/react-icons';
import {
  Box, Flex, Text, Badge, DataList, IconButton,
} from '@radix-ui/themes';
import CustomAvatar from 'components/CustomAvatar';
import React from 'react';
import { formatDate } from 'utils/dateUtils';
import CustomToolTip from 'components/CustomToolTip/page';

interface CustomHeaderProps {
  userName: string;
  userSysId: string;
  meetingStartTime: string;
  userEmail?: string;
  userPhone?: string;
  employeeNumber?: string;
}

function CallingHeader({
  userName,
  userSysId,
  meetingStartTime,
  userEmail,
  userPhone,
  employeeNumber,
}: CustomHeaderProps) {
  const isValidString = (str: string) => str && str.length > 0;

  return (
    <Flex
      align="center"
      justify="between"
      className="items-center h-full "
      gapX="2"
    >
      <Flex align="center" className="items-center h-full" px="4" gapX="2">
        <CustomAvatar
          alt="image"
          src={null}
          name={userName}
          height="2rem"
          width="2rem"
        />
        <Text weight="bold" size="2" color="gray">
          {userName}
        </Text>
        {isValidString(employeeNumber) && (
          <Badge>
            Employee Id #
            {employeeNumber}
          </Badge>
        )}
        <Text size="1" color="gray">
          {formatDate(meetingStartTime)}
        </Text>
      </Flex>
      <CustomToolTip
        trigger={(
          <Box
            p="2"
            className="rounded-full hover:bg-[var(--gray-4)] cursor-pointer"
            onClick={(e) => e.preventDefault()}
          >
            <DotsVerticalIcon height="15px" width="15px" />
          </Box>
        )}

      >
        <DataList.Root>
          <DataList.Item align="center">
            <DataList.Label minWidth="88px">
              <Text className=" text-md text-[var(--gray-11)]">
                Employee Details
              </Text>
            </DataList.Label>
          </DataList.Item>
          {isValidString(userName) && (
            <DataList.Item className="cursor-pointer">
              <DataList.Label minWidth="88px">
                <Text className="font-medium text-sm text-[var(--gray-9)]">
                  Name
                </Text>
              </DataList.Label>
              <DataList.Value>
                <Text className="text-sm text-[var(--gray-11)]">
                  {userName}
                </Text>
              </DataList.Value>
            </DataList.Item>
          )}
          {isValidString(employeeNumber) && (
            <DataList.Item className="cursor-pointer">
              <DataList.Label minWidth="88px">
                <Text className="font-medium text-sm text-[var(--gray-9)]">
                  Id
                </Text>
              </DataList.Label>
              <DataList.Value onClick={() => {
                navigator.clipboard.writeText(employeeNumber);
              }}
              >
                <Flex align="center" gapX="2">
                  <IconButton
                    size="1"
                    aria-label="Copy value"
                    color="gray"
                    variant="ghost"
                    className="mr-2"
                  >
                    <CopyIcon />
                  </IconButton>
                  <Text className="text-sm text-[var(--gray-11)]">
                    {employeeNumber}
                  </Text>
                </Flex>
              </DataList.Value>
            </DataList.Item>
          )}
          {isValidString(userEmail) && (
            <DataList.Item className="cursor-pointer">
              <DataList.Label minWidth="88px">
                <Text className="font-medium text-sm text-[var(--gray-9)]">
                  Email
                </Text>
              </DataList.Label>
              <DataList.Value onClick={() => {
                navigator.clipboard.writeText(userEmail);
              }}
              >
                <Flex align="center" gapX="2">
                  <IconButton
                    size="1"
                    aria-label="Copy value"
                    color="gray"
                    variant="ghost"
                    className="mr-2"
                  >
                    <CopyIcon />
                  </IconButton>
                  <Text className="text-sm text-[var(--gray-11)]">
                    {userEmail}
                  </Text>
                </Flex>
              </DataList.Value>
            </DataList.Item>
          )}
          {isValidString(userPhone) && (
            <DataList.Item className="cursor-pointer">
              <DataList.Label minWidth="88px">
                <Text className="font-medium text-sm text-[var(--gray-9)]">
                  Phone Number
                </Text>
              </DataList.Label>
              <DataList.Value onClick={() => {
                navigator.clipboard.writeText(userPhone);
              }}
              >
                <Flex align="center" gapX="2">
                  <IconButton
                    size="1"
                    aria-label="Copy value"
                    color="gray"
                    variant="ghost"
                    className="mr-2"
                  >
                    <CopyIcon />
                  </IconButton>
                  <Text className="text-sm text-[var(--gray-11)]">
                    {userPhone}
                  </Text>
                </Flex>
              </DataList.Value>
            </DataList.Item>
          )}
        </DataList.Root>
      </CustomToolTip>
    </Flex>
  );
}

export default CallingHeader;
