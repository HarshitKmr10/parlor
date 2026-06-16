import React from 'react';

type Props = {
  text: string;
  onClick: (text: string) => void;
};

function ChatChip({ text, onClick }: Props) {
  return (
    <button
      onClick={() => onClick(text)}
      className="!bg-white/5 dark:text-white text-gray-800 text-sm font-medium py-2 px-4 rounded-full hover:bg-blue-200 transition-colors whitespace-nowrap border-gray-500 border"
    >
      {text}
    </button>
  );
}

export default ChatChip;
