import { Flex, Text, TextField } from "@radix-ui/themes";
import clsx from "clsx";

interface InputFieldProps {
  id: string;
  label: string;
  name?: string;
  extra?: string;
  placeholder: string;
  disabled?: boolean;
  type?:
    | "number"
    | "search"
    | "time"
    | "text"
    | "hidden"
    | "tel"
    | "url"
    | "email"
    | "date"
    | "datetime-local"
    | "month"
    | "password"
    | "week";
  onChange?: any;
  value?: string | number;
  size?: "1" | "2" | "3";
  autoComplete?: string;
  required?: boolean;
  inputClassName?: string;
}

function InputField({
  label,
  id,
  extra,
  type,
  placeholder,
  disabled,
  onChange,
  value,
  name,
  size = "3",
  autoComplete,
  required,
  inputClassName,
}: InputFieldProps) {
  return (
    <Flex direction="column" gapY="1" py="2" className={extra}>
      <Text size={size} weight="bold">
        {label}
        {required && <span className="text-red-500">*</span>}
      </Text>
      <TextField.Root
        size={size}
        onChange={onChange}
        disabled={disabled}
        name={name}
        className={clsx("rounded-md p-2", inputClassName)}
        id={id}
        value={value}
        placeholder={placeholder}
        type={type}
        autoComplete={autoComplete}
      />
    </Flex>
  );
}

export default InputField;
