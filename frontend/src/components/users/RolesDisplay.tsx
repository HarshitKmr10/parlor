import React from 'react';
import { Badge, Flex, Tooltip } from '@radix-ui/themes';

export interface AssignedRole {
  id: number;
  name: string;
  assignment_type: string;
  description?: string;
}

interface RolesDisplayProps {
  roles: AssignedRole[];
  maxVisible?: number;
}

// Format role name for display (e.g., "agent_assist_admin" -> "Agent Assist Admin")
const formatRoleName = (name: string): string => {
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Get short version for display (e.g., "agent_assist_admin" -> "AA Admin")
const getShortRoleName = (name: string): string => {
  const parts = name.split('_');
  if (parts.length >= 3) {
    // e.g., "agent_assist_admin" -> "AA Admin"
    return parts.slice(0, -1).map(p => p[0].toUpperCase()).join('') + ' ' +
           parts[parts.length - 1].charAt(0).toUpperCase() + parts[parts.length - 1].slice(1);
  }
  return formatRoleName(name);
};

export default function RolesDisplay({ roles, maxVisible = 2 }: RolesDisplayProps) {
  if (!roles || roles.length === 0) {
    return <Badge color="gray" variant="soft">No roles</Badge>;
  }

  const visibleRoles = roles.slice(0, maxVisible);
  const hiddenRoles = roles.slice(maxVisible);
  const hasMore = hiddenRoles.length > 0;

  return (
    <Flex gap="1" wrap="wrap" align="center">
      {visibleRoles.map((role) => (
        <Tooltip key={role.id} content={formatRoleName(role.name)}>
          <Badge
            color={role.assignment_type === 'AUTOMATIC' ? 'purple' : 'blue'}
            variant="soft"
            style={{ cursor: 'default' }}
          >
            {getShortRoleName(role.name)}
          </Badge>
        </Tooltip>
      ))}
      {hasMore && (
        <Tooltip content={hiddenRoles.map(r => formatRoleName(r.name)).join(', ')}>
          <Badge color="gray" variant="soft" style={{ cursor: 'default' }}>
            +{hiddenRoles.length} more
          </Badge>
        </Tooltip>
      )}
    </Flex>
  );
}
