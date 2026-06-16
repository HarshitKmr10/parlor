/**
 * CallHeader Component
 * 
 * Displays the call header with user information including:
 * - User avatar and name
 * - Employee ID badge
 * - Meeting start time
 * - Dropdown menu with detailed user information (name, email, phone)
 * 
 * Data is sourced from Zustand store (CopilotStore)
 */

import React from 'react';
import { CopyIcon, DotsVerticalIcon } from '@radix-ui/react-icons';
import {
  Box,
  Flex,
  Text,
  Badge,
  DataList,
  IconButton,
} from '@radix-ui/themes';
import { useCopilotStore } from 'store/Copilot';
import CustomAvatar from 'components/CustomAvatar';
import CustomToolTip from 'components/CustomToolTip/page';
import { formatDate } from 'utils/dateUtils';
import { callHeaderStyles } from './CallHeader.styles';

/**
 * Helper function to check if a string is valid (non-empty)
 */
const isValidString = (str: string | undefined): boolean => {
  return Boolean(str && str.length > 0);
};

/**
 * CopyableDataListItem Component
 * Renders a data list item with copy-to-clipboard functionality
 */
interface CopyableDataListItemProps {
  label: string;
  value: string;
  showCopyButton?: boolean;
}

const CopyableDataListItem: React.FC<CopyableDataListItemProps> = ({
  label,
  value,
  showCopyButton = true,
}) => {
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
  };

  return (
    <DataList.Item className={callHeaderStyles.dataList.itemHover}>
      <DataList.Label minWidth="88px">
        <Text className={callHeaderStyles.dataList.label}>
          {label}
        </Text>
      </DataList.Label>
      <DataList.Value onClick={showCopyButton ? handleCopy : undefined}>
        <Flex align="center" gapX="2">
          {showCopyButton && (
            <IconButton
              size="1"
              aria-label="Copy value"
              color="gray"
              variant="ghost"
              className="mr-2"
            >
              <CopyIcon />
            </IconButton>
          )}
          <Text className={callHeaderStyles.dataList.value}>
            {value}
          </Text>
        </Flex>
      </DataList.Value>
    </DataList.Item>
  );
};

/**
 * Main CallHeader Component
 */
function CallHeader() {
  // ========== Data Fetching ==========
  // Get meeting and user data from Zustand store
  const meeting = useCopilotStore((state) => state.meeting);
  const userDetails = useCopilotStore((state) => state.userDetails);

  // ========== Data Extraction ==========
  // Extract user information
  const userName = userDetails?.fullName || '';
  const userEmail = userDetails?.email || '';
  const userPhone = userDetails?.mobilePhone || '';
  const employeeNumber = userDetails?.employeeId || '';
  
  // Extract meeting information
  const meetingStartTime = meeting?.start_timestamp || '';

  // ========== Render ==========
  return (
    <Flex
      align="center"
      justify="between"
      className={callHeaderStyles.container}
      gapX="2"
    >
      {/* Left Section: User Info */}
      <Flex
        align="center"
        className={callHeaderStyles.userInfoSection}
        px="4"
        gapX="2"
      >
        {/* User Avatar */}
        <CustomAvatar
          alt="User avatar"
          src={null}
          name={userName}
          height={callHeaderStyles.avatar.height}
          width={callHeaderStyles.avatar.width}
        />

        {/* User Name */}
        <Text weight="bold" size="2" color="gray">
          {userName}
        </Text>

        {/* Employee ID Badge */}
        {isValidString(employeeNumber) && (
          <Badge>
            Employee Id #{employeeNumber}
          </Badge>
        )}

        {/* Meeting Start Time */}
        <Text size="1" color="gray">
          {formatDate(meetingStartTime)}
        </Text>
      </Flex>

      {/* Right Section: More Info Menu */}
      <CustomToolTip
        trigger={(
          <Box
            p="2"
            className={callHeaderStyles.menuTrigger}
            onClick={(e) => e.preventDefault()}
          >
            <DotsVerticalIcon height="15px" width="15px" />
          </Box>
        )}
      >
        <DataList.Root>
          {/* Header */}
          <DataList.Item align="center">
            <DataList.Label minWidth="88px">
              <Text className={callHeaderStyles.dataList.header}>
                Employee Details
              </Text>
            </DataList.Label>
          </DataList.Item>

          {/* Name */}
          {isValidString(userName) && (
            <CopyableDataListItem
              label="Name"
              value={userName}
              showCopyButton={false}
            />
          )}

          {/* Employee ID */}
          {isValidString(employeeNumber) && (
            <CopyableDataListItem
              label="Id"
              value={employeeNumber}
            />
          )}

          {/* Email */}
          {isValidString(userEmail) && (
            <CopyableDataListItem
              label="Email"
              value={userEmail}
            />
          )}

          {/* Phone Number */}
          {isValidString(userPhone) && (
            <CopyableDataListItem
              label="Phone Number"
              value={userPhone}
            />
          )}
        </DataList.Root>
      </CustomToolTip>
    </Flex>
  );
}

export default CallHeader;
