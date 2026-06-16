import React from 'react';
import { TextArea, Flex, Text } from '@radix-ui/themes';

function TextField(props) {
  const {
    id,
    label,
    extra,
    placeholder,
    state,
    disabled,
    onChange,
    value,
    rows,
    maxTextAreaHeight,
    minTextAreaHeight,
    onKeyDown,
    isResizable = true,
    size = '3',
  } = props;

  let variant = 'surface';
  if (state === 'error') {
    variant = 'soft';
  } else if (state === 'success') {
    variant = 'classic';
  }

  const stateColor = state === 'error' ? 'red' : state === 'success' ? 'green' : undefined;

  return (
    <Flex direction="column" gapY="1" py="2" className={extra}>
      <Text size={size} style={{ color: 'var(--gray-9)' }} weight="bold">
        {label}
      </Text>
      <TextArea
        size={size}
        id={id}
        name={id}
        placeholder={placeholder}
        disabled={disabled}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        className="rounded-md p-2 "
        // variant={variant}
        color={stateColor}
        style={{
          resize: isResizable ? 'vertical' : 'none',
          ...(maxTextAreaHeight && { maxHeight: maxTextAreaHeight }),
          ...(minTextAreaHeight && { minHeight: minTextAreaHeight }),
        }}
        rows={rows}
      />
    </Flex>
  );
}

export default TextField;
