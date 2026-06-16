import React from 'react';
import { Flex, Text, Box } from '@radix-ui/themes';
import CustomAvatar from 'components/CustomAvatar';

interface UserProfileProps {
  userData: any;
}

function UserProfile({ userData }: UserProfileProps) {
  return (
    <>
      <Flex align="center" mb="6">
        <CustomAvatar
          src={null}
          name={userData.name}
          height="70px"
          width="70px"
          alt={userData.name}
        />
        <Flex ml="2" className="flex-1 flex-col justify-between">
          <Text size="6" weight="bold">
            {userData.name}
          </Text>
          <Text size="2" color="gray">
            {userData.level}
            {' '}
            level
          </Text>
          <Text size="2" color="blue">
            Only 5 lessons to become Pro!
          </Text>
        </Flex>
      </Flex>
      <Flex justify="between" mb="6" gap="2">
        <Flex className="flex-1 flex-col bg-gray-100 rounded-lg p-4 items-center justify-center">
          <Text size="5" weight="bold">
            {userData.virtualIncidentsCompleted}
          </Text>
          <Text size="1" color="gray">
            Virtual
          </Text>
          <Text size="1" color="gray">
            Incident completed
          </Text>
        </Flex>
        <Flex className="flex-1 flex-col bg-gray-100 rounded-lg p-4 items-center justify-center">
          <Text size="5" weight="bold">
            {userData.averageScore}
            /10
          </Text>
          <Text size="1" color="gray">
            Average
          </Text>
          <Text size="1" color="gray">
            score
          </Text>
        </Flex>
        <Flex className="flex-1 flex-col bg-gray-100 rounded-lg p-4 items-center justify-center">
          <Text size="5" weight="bold">
            {userData.quizzesTaken}
          </Text>
          <Text size="1" color="gray">
            Quiz
          </Text>
          <Text size="1" color="gray">
            taken
          </Text>
        </Flex>
      </Flex>
    </>
  );
}

export default UserProfile;
