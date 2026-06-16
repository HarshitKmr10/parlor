import { useState, useCallback } from 'react';
import {
  FormErrors,
  UserFormData,
  validateField,
  validateForm,
} from 'utils/validationUtils';

class UserFormError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserFormError';
  }
}

export const useUserForm = (initialState: UserFormData) => {
  const [formData, setFormData] = useState<UserFormData>(initialState);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [error, setError] = useState<Error | null>(null);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((prevFormData) => {
      try {
        const updatedFormData = { ...prevFormData, [name]: value };

        const newErrors = {
          ...formErrors,
        };

        // Only validate fields that require validation
        if (name !== 'amazonConnectProfile' && name !== 'serviceNowProfile') {
          newErrors[name] = validateField(
            name as keyof UserFormData,
            value
          );
        }

        setFormErrors(newErrors);
        setError(null);
        return updatedFormData;
      } catch (err) {
        setError(
          err instanceof Error
            ? err
            : new UserFormError('An error occurred while updating the form')
        );
        return prevFormData;
      }
    });
  };

  const validateFormData = useCallback(() => {
    try {
      const errors = validateForm(formData);
      setFormErrors(errors);
      setError(null);
      return Object.keys(errors).length === 0;
    } catch (err) {
      setError(
        err instanceof Error
          ? err
          : new UserFormError('An error occurred while validating the form')
      );
      return false;
    }
  }, [formData]);

  const resetForm = useCallback(() => {
    setFormData(initialState);
    setFormErrors({});
    setError(null);
  }, [initialState]);

  return {
    formData,
    formErrors,
    handleInputChange,
    validateFormData,
    setFormData,
    error,
    resetForm,
  };
};