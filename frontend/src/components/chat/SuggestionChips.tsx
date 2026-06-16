import ChatChip from 'components/chat/ChatChips';
import React from 'react';

function SuggestionsChips({ suggestions, onSuggestionClick }) {
  return (
    <div className="flex flex-nowrap gap-2 overflow-x-auto">
      {suggestions.map((suggestion) => (
        <ChatChip key={suggestion} text={suggestion} onClick={onSuggestionClick} />
      ))}
    </div>
  );
}

export default SuggestionsChips;
