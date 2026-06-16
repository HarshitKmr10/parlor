import React from 'react';
import { ScrollArea, Box, Flex } from '@radix-ui/themes';
import RichTextEditor from 'components/TipTap/TipTap';

const EditorPanel: React.FC<{
  content: string;
  onChange: (content: string) => void;
  disabled: boolean;
}> = React.memo(({ content, onChange, disabled }) => (
  <Flex direction="column" className="flex-1 min-h-0 border rounded-md">
    <ScrollArea className="p-4">
      <RichTextEditor
        content={content}
        onChange={onChange}
        disabled={disabled}
      />
    </ScrollArea>
  </Flex>
));

export default EditorPanel;
