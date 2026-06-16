'use client';

import React from 'react';
import NewChatLogoIcon from 'components/icons/NewChatLogoIcon';
import { FiEdit } from 'react-icons/fi';
import { useRouter } from 'next/navigation';

function ChatHeader() {
  const router = useRouter();

  const createNewChat = (redirect = true) => {
    if (!redirect) return;
    router.push('/agent-assist');
  };

  return (
    <button
      className="bg-gray-100 p-4 flex items-center justify-between rounded-xl m-2 hover:bg-gray-200 cursor-pointer"
      onClick={() => createNewChat()}
    >
      <div className="flex items-center">
        <NewChatLogoIcon />
        <span className="dark:text-white text-indigo-500 font-extrabold ml-3 text-xl">
          New Chat
        </span>
      </div>
      <button className="bg-gray-100 p-2 rounded-full text-textColor">
        <FiEdit size={22} />
      </button>
    </button>
  );
}

export default ChatHeader;
