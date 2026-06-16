import React, { useState } from "react";
import { Flex, Text, TextField, Button } from "@radix-ui/themes";
import { Shuffle, Eye, EyeOff } from "lucide-react";

interface PasswordInputProps {
  id: string;
  label?: string;
  name?: string;
  extra?: string;
  placeholder?: string;
  disabled?: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  value: string;
  size?: "1" | "2" | "3";
  error?: string;
  onGeneratePassword: () => void;
  autoComplete?: string;
}

const PasswordInput = ({
  label = "Password",
  id,
  extra,
  placeholder = "Password",
  disabled,
  onChange,
  value,
  name = "password",
  size = "3",
  error,
  onGeneratePassword,
  autoComplete = "new-password",
}: PasswordInputProps) => {
  const [showPassword, setShowPassword] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <Flex direction="column" gapY="1" py="2" className={extra}>
      <Text size={size} style={{ color: "var(--gray-9)" }} weight="bold">
        {label}
      </Text>
      <Flex gap="2">
        <Flex className="flex-1 relative">
          <TextField.Root
            size={size}
            onChange={onChange}
            disabled={disabled}
            name={name}
            className="w-full rounded-md pr-8"
            id={id}
            value={value}
            placeholder={placeholder}
            type={showPassword ? "text" : "password"}
            autoComplete={autoComplete}
            data-new-password={true} // Additional attribute to help prevent autofill
          />
          <button
            type="button"
            onClick={togglePasswordVisibility}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center bg-transparent border-none cursor-pointer p-0.5"
            style={{ outline: "none" }}
            tabIndex={-1} // Prevent focus while tabbing
          >
            {showPassword ? (
              <EyeOff size={14} className="text-gray-400" />
            ) : (
              <Eye size={14} className="text-gray-400" />
            )}
          </button>
        </Flex>
        <Button
          size={size}
          type="button"
          onClick={onGeneratePassword}
          variant="soft"
          className="whitespace-nowrap"
        >
          <Shuffle size={16} />
          Generate
        </Button>
      </Flex>
      {!!error && (
        <Text color="red" size="1">
          {error}
        </Text>
      )}
    </Flex>
  );
};

export default PasswordInput;
