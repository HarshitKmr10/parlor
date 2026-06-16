import { API } from 'api';
import { useGlobalContext } from 'contexts/store';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { FiChevronDown, FiChevronUp } from 'react-icons/fi';

interface Chat {
  id: string;
  message: string;
  employeeId: string | null;
  date: string;
}

const truncateMessage = (message, limit) => {
  const words = message.split(' ');
  return words.length > limit
    ? `${words.slice(0, limit).join(' ')}...`
    : message;
};

function RecentChatsAccordion({ hasEmployeeId, employeeId = '' }) {
  const { user } = useGlobalContext();
  const [isOpen, setIsOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState<Chat[]>([]);
  const router = useRouter();

  useEffect(() => {
    const fetchChatHistory = async () => {
      try {
        const chatsForEmployee = await API.Meetings.GetChatMessagesByEmployeeId(
          employeeId,
          user,
        );

        setChatHistory(chatsForEmployee);
      } catch (error) {
        console.error(
          `There was a problem fetching the chat history: ${error}`,
        );
      }
    };

    if (hasEmployeeId && employeeId.length > 0) {
      fetchChatHistory();
    }
  }, [hasEmployeeId, employeeId, user]);

  const toggleAccordion = () => setIsOpen(!isOpen);
  const visibleItemCountWhenClosed = hasEmployeeId ? 0 : 2;
  const displayedChats = isOpen
    ? chatHistory
    : chatHistory.slice(0, visibleItemCountWhenClosed);
  const showHr = isOpen || !hasEmployeeId;

  const handleItemClick = (chatID) => {
    router.push(`/agent-assist?chatId=${chatID}`);
  };

  const getClassNames = () => {
    if (isOpen) {
      return 'max-h-[560px] pb-6';
    }
    return hasEmployeeId ? 'pb-0' : 'pb-4';
  };

  return (
    <div className="bg-gray-100 rounded-xl m-2">
      <div
        className="flex justify-between items-center px-4 py-4"
        onClick={toggleAccordion}
        onKeyDown={(e) => e.key === 'Enter' && toggleAccordion()}
        role="button"
        tabIndex={0}
      >
        <h2 className="text-xl font-semibold text-textColor">Recent Chat</h2>
        {isOpen ? <FiChevronUp size={22} /> : <FiChevronDown size={22} />}
      </div>
      {showHr && <hr className="mb-4" />}
      <div className={`rounded-b-xl overflow-auto px-4 ${getClassNames()}`}>
        {displayedChats.map((chat) => (
          <div
            onClick={() => handleItemClick(chat.id)}
            onKeyDown={(e) => e.key === 'Enter' && handleItemClick(chat.id)}
            key={chat.id}
            className="mt-3 first:mt-0 cursor-pointer p-3 bg-white rounded-xl"
            role="button"
            tabIndex={0}
          >
            <div className="font-bold text-lg text-textColor">
              {truncateMessage(chat.message, 10)}
            </div>
            <div className="flex justify-between items-baseline">
              <span className="font-semibold text-bluegray-500 text-sm">
                Employee ID:
                {' '}
                <span className="font-normal">{chat.employeeId}</span>
              </span>
              <span className="text-sm text-bluegray-500">{chat.date}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default RecentChatsAccordion;
