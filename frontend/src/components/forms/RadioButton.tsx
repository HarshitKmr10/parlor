import { Flex, Radio, Text } from '@radix-ui/themes';
import React from 'react';

type Props = {
  value: string;
  label: string;
  name: string;

  checked: boolean;
  onChange: () => void;
  disabled: boolean;
};

function RadioButton({
  value, label, name,
  checked, onChange, disabled,
}: Props) {
  return (
    <Flex asChild gap="2" align="center">
      <Text size="2">
        <Radio
          name={name}
          value={value}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
        />
        {label}
      </Text>
    </Flex>
  );
}

export default RadioButton;
