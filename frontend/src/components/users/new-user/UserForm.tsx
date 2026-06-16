// components/UserForm.tsx

import React from 'react';
import {
  TextField, Button, Text, Flex,
} from '@radix-ui/themes';

interface UserFormData {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  teamId: string;
}

interface FormErrors {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}
interface UserFormProps {
  formData: UserFormData;
  formErrors: FormErrors;
  handleInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}

function UserForm({
  formData,
  formErrors,
  handleInputChange,
  handleSubmit,
}: UserFormProps) {
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Flex direction="column" gap="2">
        <TextField.Root
          placeholder="Full Name"
          name="fullName"
          onChange={handleInputChange}
          value={formData.fullName}
          size="3"
        />
        {!!formErrors.fullName && (
          <Text color="red" size="1">
            {formErrors.fullName}
          </Text>
        )}

        <TextField.Root
          placeholder="Email Address"
          name="email"
          type="email"
          onChange={handleInputChange}
          value={formData.email}
          size="3"
        />
        {!!formErrors.email && (
          <Text color="red" size="1">
            {formErrors.email}
          </Text>
        )}

        <TextField.Root
          placeholder="Password"
          name="password"
          type="password"
          onChange={handleInputChange}
          value={formData.password}
          size="3"
        />
        {!!formErrors.password && (
          <Text color="red" size="1">
            {formErrors.password}
          </Text>
        )}

        <TextField.Root
          placeholder="Confirm Password"
          name="confirmPassword"
          type="password"
          onChange={handleInputChange}
          value={formData.confirmPassword}
          size="3"
        />
        {!!formErrors.confirmPassword && (
          <Text color="red" size="1">
            {formErrors.confirmPassword}
          </Text>
        )}

        <Button type="submit" style={{ width: '100%' }} size="3">
          Submit
        </Button>
      </Flex>
    </form>
  );
}

export default React.memo(UserForm);
