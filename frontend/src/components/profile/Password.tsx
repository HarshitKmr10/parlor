import React, { useState, useCallback } from "react";
import { Card, Flex, Text, TextField, Button } from "@radix-ui/themes";
import { useGlobalContext } from "contexts/store";
import { API } from "api";
import {
  passwordRegex,
  passwordRegexMessage,
  validateField,
} from "utils/validationUtils";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useTranslation } from 'react-i18next';

interface PasswordErrors {
  oldPassword?: string;
  newPassword?: string;
}

function Password() {
  const { t } = useTranslation();
  const { user } = useGlobalContext();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<PasswordErrors>({});

  const validatePassword = (value: string): string => {
    if (!value) return t('profile.passwordIsRequired');
    return validateField("password", value);
  };

  /**
   * Safely handle password input changes
   * This prevents special character encoding issues
   */
  const handlePasswordInputChange = useCallback((
    e: React.ChangeEvent<HTMLInputElement>,
    setPassword: (value: string) => void,
    errorKey: keyof PasswordErrors
  ) => {
    const value = e.target.value;
    
    // Store the raw value without any encoding/decoding
    setPassword(value);
    setErrors((prev) => ({
      ...prev,
      [errorKey]: validatePassword(value),
    }));
  }, []);

  const handleOldPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handlePasswordInputChange(e, setOldPassword, 'oldPassword');
  };

  const handleNewPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handlePasswordInputChange(e, setNewPassword, 'newPassword');
  };

  /**
   * Safely prepare password data for API call
   * Since we're using request body, no additional encoding is needed
   */
  const preparePasswordForAPI = (password: string): string => {
    // Return the password as-is since we're using request body
    return password;
  };

  const handleChangePassword = async () => {
    // Validate both fields
    const oldPasswordError = validatePassword(oldPassword);
    const newPasswordError = validatePassword(newPassword);

    if (oldPasswordError || newPasswordError) {
      setErrors({
        oldPassword: oldPasswordError,
        newPassword: newPasswordError,
      });
      return;
    }

    setLoading(true);

    try {
      // Prepare passwords for API call with proper encoding
      const encodedOldPassword = preparePasswordForAPI(oldPassword);
      const encodedNewPassword = preparePasswordForAPI(newPassword);


      const response = await API.User.ChangePassword(
        user?.id,
        encodedOldPassword,
        encodedNewPassword
      );

      if (response.status === "authorized") {
        toast.success(t('profile.passwordChangedSuccessfully'));
        // Clear the form on success
        setOldPassword("");
        setNewPassword("");
        setErrors({});
      } else {
        toast.error(t('profile.failedToChangePassword', { message: response.data }));
      }
    } catch (error) {
      console.error('Password change error:', error);
      toast.error(error.message || t('profile.errorOccurredChangingPassword'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card style={{ width: "100%", padding: "24px" }}>
      <Flex direction="column" gap="4">
        <Flex direction="column" gap="1">
          <Text size="5" weight="bold">
            {t('profile.changePassword')}
          </Text>
          <Text as="p" size="2" color="gray">
            {t('profile.setNewPassword')}
          </Text>
        </Flex>

        <Flex direction="column" gap="4">
          <Flex direction="column" gap="1">
            <TextField.Root
              placeholder={t('profile.yourOldPassword')}
              type="password"
              value={oldPassword}
              onChange={handleOldPasswordChange}
              size="3"
              // Prevent browser autocomplete to avoid encoding issues
              autoComplete="current-password"
              // Ensure proper input handling
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
            />
            {!!errors.oldPassword && (
              <Text size="1" color="red">
                {errors.oldPassword}
              </Text>
            )}
          </Flex>

          <Flex direction="column" gap="1">
            <TextField.Root
              placeholder={t('profile.yourNewPassword')}
              type="password"
              value={newPassword}
              onChange={handleNewPasswordChange}
              size="3"
              // Prevent browser autocomplete to avoid encoding issues
              autoComplete="new-password"
              // Ensure proper input handling
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
            />
            {!!errors.newPassword && (
              <Text size="1" color="red">
                {errors.newPassword}
              </Text>
            )}
          </Flex>
        </Flex>

        <Flex justify="between" align="center">
          <Button
            onClick={handleChangePassword}
            disabled={loading || !!errors.oldPassword || !!errors.newPassword}
            className={loading ? "cursor-not-allowed" : "cursor-pointer"}
          >
            {loading ? t('profile.loading') : t('profile.changePassword')}
          </Button>
        </Flex>
      </Flex>
    </Card>
  );
}

export default Password;
