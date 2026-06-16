import React from 'react';
import { Text } from '@radix-ui/themes';
import MultiSelectDropdown from 'components/common/MultiSelectDropdown/MultiSelectDropdown';
import { RoleDefinition } from 'hooks/useRoleDefinitions';

interface LockedRole {
  id: string;
  name: string;
}

interface RoleMultiSelectProps {
  availableRoles: RoleDefinition[];
  selectedRoleIds: string[];
  onSelectionChange: (roleIds: string[]) => void;
  isLoading?: boolean;
  disabled?: boolean;
  label?: string;
  error?: string;
  lockedRoles?: LockedRole[]; // Auto-assigned roles that can't be removed
}

export default function RoleMultiSelect({
  availableRoles,
  selectedRoleIds,
  onSelectionChange,
  isLoading = false,
  disabled = false,
  label = 'Roles',
  error,
  lockedRoles = [],
}: RoleMultiSelectProps) {
  return (
    <div>
      {!!label && (
        <Text size="2" style={{ color: 'var(--gray-9)' }} weight="bold" className="mb-2 block">
          {label}
        </Text>
      )}
      <MultiSelectDropdown
        options={availableRoles}
        selectedIds={selectedRoleIds}
        onSelectionChange={onSelectionChange}
        placeholder="Select roles..."
        searchPlaceholder="Search roles..."
        isLoading={isLoading}
        disabled={disabled}
        emptyMessage="No roles available"
        noResultsMessage="No matching roles"
        showSelectedCount
        lockedItems={lockedRoles}
      />
      {Boolean(error) && (
        <Text color="red" size="1" className="mt-1">
          {error}
        </Text>
      )}
    </div>
  );
}
