import { useState } from 'react';
import { SuggestionReaction } from 'types/common';

const useReactionsAndInteractions = () => {
  const [reaction, setReaction] = useState<SuggestionReaction>(null);

  const toggleThumbsUp = () => {
    if (reaction !== 'liked') setReaction('liked');
    else setReaction(null);
  };

  const toggleThumbsDown = () => {
    if (reaction !== 'disliked') setReaction('disliked');
    else setReaction(null);
  };

  const reset = () => {
    setReaction(null);
  };

  return {
    reaction,
    toggleThumbsUp,
    toggleThumbsDown,
    reset,
  };
};

export default useReactionsAndInteractions;
