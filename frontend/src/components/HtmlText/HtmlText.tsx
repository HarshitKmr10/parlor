import React from 'react';

function HtmlText(props: { value?: string }) {
  const { value } = props;

  return (
    <div
      dangerouslySetInnerHTML={{ __html: value }}
      className="flex-grow w-full  border outline-none overflow-auto border-none text-sm border-gray-200 dark:!border-white/10 dark:text-white whitespace-pre-line break-words"
    />
  );
}

export default HtmlText;
