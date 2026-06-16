import { useState, useCallback, useEffect } from 'react';
import { isValidPhoneNumber, isValidURL } from 'utils/validationUtils';

interface FormData {
  phoneNumber?: string;
  title?: string;
  link?: string;
}

interface ValidationErrors {
  [key: string]: string;
}

const useFormData = (
  initialValues: FormData,
  contactMethod: string,
): [
    FormData,
    (e: React.ChangeEvent<HTMLInputElement>) => void,
    (data: FormData) => ValidationErrors,
    (newData: FormData) => void,
  ] => {
  const [formData, setFormData] = useState<FormData>(initialValues);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setFormData((prev) => ({ ...prev, [name]: value }));

    if (contactMethod === 'phoneNumber' && name === 'phoneNumber') {
      setFormData((prev) => ({ ...prev, title: value }));
    }
  };

  const updateFormData = useCallback((newData: FormData) => {
    setFormData((prev) => ({ ...prev, ...newData }));
  }, []);

  const validateFormData = useCallback(
    (data: FormData): ValidationErrors => {
      const errors: ValidationErrors = {};

      if (contactMethod === 'phoneNumber') {
        const { isValid, error } = isValidPhoneNumber(data.phoneNumber || '');
        if (!isValid) {
          errors.phoneNumber = error;
        }
      } else {
        if (!data.title?.trim()) {
          errors.title = 'Title is required';
        }

        if (!data.link?.trim() || !isValidURL(data.link)) {
          errors.link = 'Invalid URL format';
        }
      }

      return errors;
    },
    [contactMethod],
  );

  useEffect(() => {
    setFormData(initialValues);
  }, [contactMethod]);

  return [formData, handleChange, validateFormData, updateFormData];
};

export default useFormData;
