'use client';

import { parseAnswerToHtml } from 'components/Answer/AnswerParser';
import { getCitationFilePath } from 'api/chat/api';
import SuggestionBox from 'components/common/SuggestionBox';
import { useRef, useEffect } from 'react';
import SuggestionsIsLoading from './SuggestionIsLoading';

export default function CopilotSuggest({
  suggestions,
  loading,
  setActiveCitation,
  setShowCitation,
  summary,
  meeting_id,
  app_id,
  moduleName = 'Voice Co-Resolve',
}) {
  const VVASummary = {
    answer: summary,
    question: 'Voice Virtual Agent Summary',
    citations: [],
  };
  const suggestionRef = useRef<HTMLDivElement>(null);
  const scrollToBottom = () => {
    suggestionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [suggestions]);

  return (
    <div className="w-full pr-2 ">
      <div className="overflow-y-auto py-2w-full ">
        {console.log('CopilotSuggest - summary length:', summary.length, 'summary:', summary.substring(0, 50))}
        {summary.length > 0 && (
          <SuggestionBox
            key="vva"
            moduleName={moduleName}
            suggestion={VVASummary}
            getCitationFilePath={getCitationFilePath}
            setShowCitation={setShowCitation}
            parseAnswerToHtml={parseAnswerToHtml}
            setActiveCitation={setActiveCitation}
            session_id={meeting_id}
            app_id={"vva_suumary"}
          />
        )}

        {suggestions.map((suggestion, index) => (
          <SuggestionBox
            key={suggestion.id || index}
            moduleName={moduleName}
            suggestion={suggestion}
            getCitationFilePath={getCitationFilePath}
            setShowCitation={setShowCitation}
            parseAnswerToHtml={parseAnswerToHtml}
            setActiveCitation={setActiveCitation}
            session_id={meeting_id}
            app_id={app_id}
          />
        ))}

        <SuggestionsIsLoading loading={loading} />
        <div ref={suggestionRef} />
      </div>
    </div>
  );
}
