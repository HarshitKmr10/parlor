import React, { useState, useEffect } from "react";
import { Text, Flex, Button } from "@radix-ui/themes";
import { useGlobalContext } from "contexts/store";
import InputField from "components/fields/InputField";
import PasswordInput from "components/fields/PasswordInput";
import { User } from "api/user";
import { generatePassword } from "utils/passwordUtils";
import RoleMultiSelect from "components/users/RoleMultiSelect";
import { useRoleDefinitions } from "hooks/useRoleDefinitions";
import { AssignedRole } from "components/users/RolesDisplay";

interface UpdateUserInfoProps {
  setIsLoading: (loading: boolean) => void;
  selectedUser: Agent;
  onUpdateComplete: () => void;
}

interface Agent {
  name: string[];
  email: string;
  date: string;
  teams: string[];
  id: string;
  role?: string;
  assigned_roles?: AssignedRole[];
}

function UpdateUserInfo({
  setIsLoading,
  selectedUser,
  onUpdateComplete,
}: UpdateUserInfoProps) {
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordGenerated, setIsPasswordGenerated] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const { user } = useGlobalContext();
  const { roles: availableRoles, isLoading: isLoadingRoles } = useRoleDefinitions();

  useEffect(() => {
    if (selectedUser) {
      setName(selectedUser.name[0] || "");
      setPassword("");
      setIsPasswordGenerated(false);

      // Initialize selected roles from user's MANUAL assigned roles only
      // AUTOMATIC roles (from group mappings) are shown separately and can't be edited
      if (selectedUser.assigned_roles && selectedUser.assigned_roles.length > 0) {
        const manualRoleIds = selectedUser.assigned_roles
          .filter(r => r.assignment_type === 'MANUAL')
          .map(r => String(r.id));
        setSelectedRoleIds(manualRoleIds);
      } else {
        setSelectedRoleIds([]);
      }
    }
  }, [selectedUser]);

  const generateRandomPassword = () => {
    const generatedPassword = generatePassword();
    setPassword(generatedPassword);
    setIsPasswordGenerated(true);
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setIsUpdating(true);

    try {
      const updates: Record<string, any> = {};
      let hasChanges = false;

      // Check if name has changed
      if (name !== selectedUser.name[0]) {
        updates.name = name;
        hasChanges = true;
      }

      // Only include password in updates if it was generated
      if (isPasswordGenerated && password) {
        updates.password = password;
        hasChanges = true;
      }

      // Check if MANUAL roles changed (AUTOMATIC roles are managed by group mappings)
      const originalManualRoleIds = (selectedUser.assigned_roles || [])
        .filter(r => r.assignment_type === 'MANUAL')
        .map(r => String(r.id))
        .sort();
      const newRoleIds = [...selectedRoleIds].sort();

      if (JSON.stringify(originalManualRoleIds) !== JSON.stringify(newRoleIds)) {
        updates.assigned_role_ids = selectedRoleIds;  // Pass role names directly
        hasChanges = true;
      }

      // Only make API call if there are changes
      if (hasChanges) {
        await User.UpdateUserDataPartial(user, selectedUser.id, updates);
      }

      onUpdateComplete();
    } catch (error) {
      console.error("Error updating user:", error);
    } finally {
      setIsLoading(false);
      setIsUpdating(false);
    }
  };

  // Get automatic roles for display
  const automaticRoles = (selectedUser.assigned_roles || []).filter(
    r => r.assignment_type === 'AUTOMATIC'
  );

  return (
    <Flex direction="column" gap="2" p="2">
      <Text size="5" weight="bold">
        Update User Details
      </Text>
      <Text as="p" size="2" color="gray">
        Update user profile information
      </Text>
      <InputField
        id="name"
        label="Full Name"
        placeholder="Full Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <InputField
        id="email"
        label="Email Address"
        placeholder="Email Address"
        type="email"
        value={selectedUser.email}
        disabled
      />
      <PasswordInput
        id="password"
        label="Password"
        placeholder="Generate new password"
        value={password}
        onChange={(e) => {
          if (!isPasswordGenerated) {
            setPassword(e.target.value);
          }
        }}
        disabled={true}
        onGeneratePassword={generateRandomPassword}
      />
      {isPasswordGenerated && (
        <Text size="2" color="gray">
          Copy this generated password to share with the user
        </Text>
      )}

      {/* Multi-role selection */}
      <RoleMultiSelect
        availableRoles={availableRoles}
        selectedRoleIds={selectedRoleIds}
        onSelectionChange={setSelectedRoleIds}
        isLoading={isLoadingRoles}
        label="Roles"
        lockedRoles={automaticRoles.map(r => ({
          id: r.name,  // Use role name as ID (matches RoleDefinition.id from backend)
          name: r.name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
        }))}
      />

      {/* Explanation for auto-assigned roles */}
      {automaticRoles.length > 0 && (
        <Text size="1" color="gray" className="mt-1">
          Purple roles are auto-assigned from group mappings and cannot be removed.
        </Text>
      )}

      <Button
        onClick={handleSubmit}
        style={{ width: "100%" }}
        size="3"
        mt="4"
        disabled={isUpdating}
      >
        {isUpdating ? "Updating..." : "Update User Details"}
      </Button>
    </Flex>
  );
}

export default UpdateUserInfo;
