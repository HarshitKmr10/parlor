"use client";
import React, { useCallback, useRef } from "react";

interface Props extends Omit<React.HTMLProps<HTMLTextAreaElement>, 'onChange'> {
  label?: string;
  defaultValue?: string;
  value?: string;
  handleChange?: (value: string) => void;
  className?: string;
  error?: boolean;
  disabled?: boolean;
  rows?: number;
  fontSize?: string;
  textColor?: string;
  maxLength?: number;
}

const TextInput: React.FC<Props> = ({
  label = "",
  defaultValue = "",
  value,
  handleChange,
  className = "",
  error = false,
  disabled = false,
  rows = 1,
  fontSize = "1.125rem",
  textColor = "text-gray-700",
  maxLength = 100,
  ...props
}: Props) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
      const value = e.target.value;
      handleChange?.(value);
    },
    [handleChange]
  );

  // Calculate height based on rows
  // line-height is 1.25rem (20px), so height = rows * 1.25rem
  const heightStyle = {
    height: `${rows * 1.25}rem`,
    minHeight: `${rows * 1.25}rem`,
    fontSize: fontSize,
  };

  return (
    <div className={`relative w-auto bg-transparent border-0 min-h-5 ${className}`}>
      <textarea
        ref={textareaRef}
        style={heightStyle}
        className={`
          relative bg-transparent border-none resize-none outline-none
          font-medium leading-5 tracking-[0.2px] ${textColor} w-full
          placeholder:${textColor} placeholder:opacity-100
          focus:outline-none
          disabled:opacity-80 disabled:cursor-not-allowed
          ${error ? 'border-red-500' : ''}
        `}
        value={value}
        defaultValue={defaultValue}
        placeholder={label}
        onChange={onChange}
        maxLength={maxLength}
        disabled={disabled}
        rows={rows}
        {...props}
      />
    </div>
  );
};

export default React.memo(TextInput);
