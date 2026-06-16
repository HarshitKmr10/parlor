import { API } from 'api';
import Spinner from 'components/spinner/spinner';
import { useGlobalContext } from 'contexts/store';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';

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

function RecentChatsAccordionWithoutUser() {
  const { user } = useGlobalContext();
  const [isOpen, setIsOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchChatHistory = async () => {
      try {
        setLoading(true);
        const chats = await API.Meetings.GetHistoryChat(user);
        setChatHistory(chats);
        setIsOpen(chats.length === 0); // Set accordion open if no chats
      } catch (error) {
        setIsOpen(true); // Keep accordion open if an error occurs during fetch
        console.error(
          `There was a problem fetching the chat history: ${error}`,
        );
      } finally {
        setLoading(false);
      }
    };

    fetchChatHistory();
  }, []);

  const toggleAccordion = () => {
    if (chatHistory.length > 0) {
      // Only allow toggle if there are chats
      setIsOpen(!isOpen);
    }
  };

  const handleItemClick = (chatID) => {
    router.push(`/agent-assist/${chatID}`);
  };
  // if (loading) {
  //   return <Spinner />;
  // }

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
        {/* {isOpen ? <FiChevronUp size={22} /> : <FiChevronDown size={22} />} */}
      </div>
      <hr className="mb-4" />
      {loading && <Spinner />}
      {chatHistory.length === 0 && loading === false && (
        <div className="text-center py-4">No history found</div>
      )}
      <div className="rounded-b-xl overflow-auto px-4  max-h-[337px] pb-4">
        {chatHistory.map((chat) => (
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
              <span className="text-sm text-bluegray-500">{chat.date}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default RecentChatsAccordionWithoutUser;
