import React from 'react';
import {
  Box,
  Flex,
  Text,
  Button,
  ScrollArea,
  Card,
  Separator,
} from '@radix-ui/themes';
import { Pencil } from 'lucide-react';

interface Suggestion {
  heading: string;
  reason: string;
  ticket_link: string;
  ticket_id: string;
}

interface AISuggestionsProps {
  suggestions: Suggestion[];
  improvements: string[][];
  onApplyAll: () => void;
}

const AISuggestions: React.FC<AISuggestionsProps> = ({
  improvements,
  suggestions,
  onApplyAll,
}) => (
  <Card className="w-full bg-white shadow-lg flex flex-col h-full">
    <Flex justify="between" align="center" p="1" className="flex-shrink-0">
      <Text className="text-lg font-medium flex items-center">
        AI Suggestions
{' '}
        <span className="text-muted-foreground ml-1 text-sm cursor-help">
          ⓘ
        </span>
      </Text>
      <Button size="2" className="text-white hover:" onClick={onApplyAll}>
        <Pencil className="ml-2 h-4 w-4" />
        Apply All
      </Button>
    </Flex>
    <Box className="flex-grow overflow-y-hi">
      <Box className="p-4">
        <Text className="text-md font-medium text-gray-700">Suggestions</Text>
        {suggestions.map((suggestion, index) => (
          <Box key={index} className="mb-2 p-3 bg-blue-50 rounded-md">
            <Text className="text-sm text-black-700">{suggestion.heading}</Text>
            <br />
            <Text className="text-sm text-gray-700 mt-1">
              {suggestion.reason}
            </Text>
            <Text className="text-sm text-gray-700 mt-1">
              Ticket:
{' '}
              <a
                href={suggestion.ticket_link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                {suggestion.ticket_id}
              </a>
            </Text>
          </Box>
        ))}

        <Separator size="4" my="3" />

        <Text className="text-md font-medium text-gray-700">Improvements</Text>
        <div className="space-y-2">
          {improvements.slice(0, 4).map((improvement, index) => (
            <div key={index} className="rounded-md border border-[#E4E4FB] p-3">
              <div className="flex items-start space-x-2">
                <div className="flex-grow">
                  <p className="text-sm line-through text-gray-500">
                    {improvement[0]}
                  </p>
                  <p className="text-sm text-blue-800">
→
{improvement[1]}
</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Box>
    </Box>
  </Card>
);

export default AISuggestions;
