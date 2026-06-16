import React, { useEffect, useState } from "react";
import { Text, Button, Flex } from "@radix-ui/themes";
import { useGlobalContext } from "contexts/store";
import { FormErrors, UserFormData } from "utils/validationUtils";
import InputField from "components/fields/InputField";
import PasswordInput from "components/fields/PasswordInput";
import { generatePassword } from "utils/passwordUtils";
import { serviceDeskInstance } from "api/common/axiosInstance";
import RoleMultiSelect from "components/users/RoleMultiSelect";
import { useRoleDefinitions } from "hooks/useRoleDefinitions";

interface UserInfoFormProps {
  formData: UserFormData;
  formErrors: FormErrors;
  handleInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  validateFormData: () => boolean;
}

function UserInfoForm({
  formData,
  formErrors,
  handleInputChange,
  handleSubmit,
  setFormData,
  validateFormData,
}: UserInfoFormProps) {
  const { user, setSelectedTeam } = useGlobalContext();
  const { roles: availableRoles, isLoading: isLoadingRoles } = useRoleDefinitions();
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const response = await serviceDeskInstance.get(`/service_desk/get_all_teams?org_id=${user.org_id}`);
        if (response.status !== 200) {
          console.error(`HTTP error! status: ${response.status}`);
        }
        const result = response.data;
        if (result.length > 0) {
          const firstTeam = result[0];
          setFormData((prevData: any) => ({
            ...prevData,
            teamId: firstTeam.id,
          }));
          setSelectedTeam(firstTeam.name);
        }
      } catch (error) {
        console.error("Failed to fetch teams:", error);
      }
    };

    if (user?.org_id) {
      fetchTeams();
    }
  }, [user]);

  const handleRoleSelectionChange = (roleIds: string[]) => {
    setSelectedRoleIds(roleIds);
    setFormData((prevData: any) => ({
      ...prevData,
      assigned_role_ids: roleIds,  // Pass role names directly
      // Keep legacy role for backward compatibility (set to 'User' as default)
      role: roleIds.length > 0 ? 'User' : '',
    }));
  };

  const onGeneratePassword = () => {
    const password = generatePassword();
    setFormData((prevData: any) => ({
      ...prevData,
      password,
    }));
  };

  return (
    <form onSubmit={handleSubmit} autoComplete="off">
      <input type="text" style={{ display: "none" }} />
      <input type="password" style={{ display: "none" }} />

      <InputField
        id="new_user_fullname"
        label="Full Name"
        placeholder="Full Name"
        name="fullName"
        onChange={handleInputChange}
        value={formData.fullName}
        autoComplete="off"
      />
      {!!formErrors.fullName && (
        <Text color="red" size="1">
          {formErrors.fullName}
        </Text>
      )}

      <InputField
        id="new_user_email"
        label="Email Address"
        placeholder="Email Address"
        name="email"
        type="email"
        onChange={handleInputChange}
        value={formData.email}
        autoComplete="new-email"
      />
      {!!formErrors.email && (
        <Text color="red" size="1">
          {formErrors.email}
        </Text>
      )}

      <PasswordInput
        id="new_user_password"
        value={formData.password}
        onChange={handleInputChange}
        error={formErrors.password}
        onGeneratePassword={onGeneratePassword}
        autoComplete="new-password"
      />

      <RoleMultiSelect
        availableRoles={availableRoles}
        selectedRoleIds={selectedRoleIds}
        onSelectionChange={handleRoleSelectionChange}
        isLoading={isLoadingRoles}
        label="Roles"
        error={formErrors.role}
      />

      <Flex gap="3" mt="4">
        <Button type="submit" size="3" className="flex-1" disabled={selectedRoleIds.length === 0}>
          Submit
        </Button>
      </Flex>
    </form>
  );
}

export default UserInfoForm;
