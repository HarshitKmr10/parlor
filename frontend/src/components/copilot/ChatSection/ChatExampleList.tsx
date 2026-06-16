import React from 'react';
import { Text } from '@radix-ui/themes';
import { chatWidgetStyles } from './ChatWidget.styles';
import { Box } from 'lucide-react';

interface ChatExampleListProps {
  onExampleClicked: (example: string) => void;
  userName?: string;
}

function ChatExampleList({ onExampleClicked, userName }: ChatExampleListProps) {
  const suggestedQuestions = [
    "Please tell me what problems the user reported during the call.",
    "What troubleshooting steps were taken to resolve the issue?",
    "Were the reported issues resolved during this conversation?"
  ];

  return (
    <div className="p-4 h-full overflow-y-auto flex flex-col justify-center">
      {/* Welcome Message */}
      <div className='flex flex-col'>
        <Text size='5' weight="medium">
          Hi {userName} 👋
        </Text>
        <Text size='5' weight="medium" className='mb-3'>
          How can we help?
        </Text>
      </div>
      
      <Text size='2' weight='regular' className='text-neutral-11'>
        Type your question or search keyword regarding the call.
      </Text>

      {/* Suggested Questions */}
      <div className={chatWidgetStyles.suggestedQuestions}>
        {suggestedQuestions.map((question, index) => (
          <div
            key={index}
            className={`${chatWidgetStyles.suggestedQuestion}`}
            onClick={() => onExampleClicked(question)}
          >
            <Text className={chatWidgetStyles.suggestedQuestionText}>
              {question}
            </Text>
            <svg className={chatWidgetStyles.arrowIcon} fill="currentColor" viewBox="0 0 24 24">
              <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
            </svg>
          </div>
        ))}
      </div>

      {/* Ask Section */}
    </div>
  );
}

export default ChatExampleList;
