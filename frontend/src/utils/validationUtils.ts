// utils/validationUtils.ts

export class ValidationUtilsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationUtilsError";
  }
}

export interface UpdateUserFormData {
  name: string;
  email: string;
  amazonConnectProfile: string;
  serviceNowProfile: string;
}

export const isWindowAvailable = (): boolean => {
  try {
    return typeof window !== "undefined";
  } catch (error) {
    console.error("Error checking window availability:", error);
    throw new ValidationUtilsError("Failed to check window availability");
  }
};

export enum PhoneNumberError {
  INVALID_FORMAT = "Invalid phone number",
  PLEASE_ENTER = "Please enter phone number",
}

export const isValidPhoneNumber = (
  phoneNumber: string
): { isValid: boolean; error?: PhoneNumberError } => {
  if (!phoneNumber.trim()) {
    return { isValid: false, error: PhoneNumberError.PLEASE_ENTER };
  }

  // Regex for numbers like +917888314879 or +19194987612
  const phoneRegex = /^\+\d{10,14}$/;

  if (phoneRegex.test(phoneNumber)) {
    return { isValid: true };
  }
  return { isValid: false, error: PhoneNumberError.INVALID_FORMAT };
};

export const isValidURL = (url: string): boolean => {
  try {
    const pattern = /^(https?:\/\/)/i;
    return pattern.test(url);
  } catch (error) {
    console.error("Error validating URL:", error);
    throw new ValidationUtilsError("Failed to validate URL");
  }
};

export interface UserFormData {
  fullName: string;
  email: string;
  password: string;
  role: string;
  teamId: string;
  amazonConnectProfile?: string;
  serviceNowProfile?: string;
  assigned_role_ids?: string[];  // List of role names
}

export interface FormErrors {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  role?: string;
  amazonConnectProfile?: string;
  serviceNowProfile?: string;
}

export interface PlatformFormErrors {
  username?: string;
}

export const passwordRegex = /(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^?&*]).{8,}/;
export const passwordRegexMessage = "Password must be at least 8 characters and include numbers, uppercase and lowercase letters, and special characters";
export const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
export const isValidEmail = (value: string): boolean => emailRegex.test(value.trim());


export const validateField = (
  name: keyof UserFormData,
  value: string
): string => {
  try {
    switch (name) {
      case "email": {
        const isValid = isValidEmail(value);
        return isValid ? "" : "Invalid email address";
      }
      case "fullName": {
        return value.trim().length > 0 ? "" : "Full name is required";
      }
      case "password": {
        return passwordRegex.test(value)
          ? ""
          : "Password must be at least 8 characters and include numbers, uppercase and lowercase letters, and special characters";
      }
      case "role": {
        return value.trim().length > 0 ? "" : "Role is required";
      }
      default:
        return "";
    }
  } catch (error) {
    console.error("Error validating field:", error);
    throw new ValidationUtilsError("Failed to validate field");
  }
};

export const validateForm = (formData: UserFormData): FormErrors => {
  try {
    const errors: FormErrors = {};
    (Object.keys(formData) as Array<keyof UserFormData>).forEach((key) => {
      if (key !== 'teamId' && key !== 'amazonConnectProfile' && key !== 'serviceNowProfile' && key !== 'assigned_role_ids') {
        const error = validateField(key, formData[key] as string);
        if (error) {
          errors[key] = error;
        }
      }
    });
    return errors;
  } catch (error) {
    console.error('Error validating form:', error);
    throw new ValidationUtilsError('Failed to validate form');
  }
};

export const validateUpdateUserField = (
  name: keyof UpdateUserFormData,
  value: string
): string => {
  switch (name) {
    case "amazonConnectProfile":
    case "serviceNowProfile":
      return value.trim() ? "" : `${name} is required`;
    default:
      return "";
  }
};

export const validateUpdateUserForm = (
  formData: UpdateUserFormData
): FormErrors => {
  const errors: FormErrors = {};
  (Object.keys(formData) as Array<keyof UpdateUserFormData>).forEach((key) => {
    if (key !== "name" && key !== "email") {
      const error = validateUpdateUserField(key, formData[key]);
      if (error) {
        errors[key] = error;
      }
    }
  });
  return errors;
};
