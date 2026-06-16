import React from 'react';
import { Text, Flex } from '@radix-ui/themes';
import CustomAvatar from 'components/CustomAvatar';

export function UserNameCell({ info }: { info: any }) {
  const name = info.getValue()[0];
  return (
    <Flex align="center" gap="3">
      <div className="h-[60px] w-[60px] rounded-full bg-blue-300 overflow-hidden">
        <CustomAvatar
          alt={name}
          src={null}
          name={name}

        />

      </div>
      <Text weight="medium">{name}</Text>
    </Flex>
  );
}

export function EmailCell({ info }: { info: any }) {
  return (
    <Flex align="center" className="h-full">
      <Text size="2" weight="medium">
        {info.getValue()}
      </Text>
    </Flex>

  );
}

export function DateCell({ info }: { info: any }) {
  return (
    <Flex align="center" className="h-full">
      <Text size="2" weight="medium">
        {info.getValue()}
      </Text>
    </Flex>
  );
}

export function TeamsCell({ info }: { info: any }) {
  const teams = info.getValue();
  return (
    <Flex wrap="wrap" gap="2">
      {teams.map((team: string) => (
        <Text
          key={team}
          size="1"
          weight="bold"
          className="px-3 py-1 rounded-full text-white bg-blue-500"
        >
          {team}
        </Text>
      ))}
    </Flex>
  );
}

export function ColumnHeader({ title }: { title: string }) {
  return (
        <Text size="2" weight="bold" color="gray">
          {title}
    </Text>
  );
}
