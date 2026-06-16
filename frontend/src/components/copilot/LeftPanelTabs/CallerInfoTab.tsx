import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useWebSocketStore } from 'store/WebSocket';
import { useUnifiedWebSocketStore } from 'store/UnifiedWebSocket';
import CallerInfoTabsItem from './RealTimeTranscriptItem';
import { useCopilotStore } from '@/store/Copilot';

interface CallerInfoTabProps {
  containerRef: React.RefObject<HTMLDivElement>;
}

function CallerInfoTab({ containerRef }: CallerInfoTabProps) {
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const service = searchParams.get('service');
  // Use UnifiedWebSocketStore for both cisco and genesis services
  const useUnifiedStore = service === 'genesis' || service === 'cisco';

  // Get data from appropriate store based on service type
  const legacyTranscript = useWebSocketStore((state) => state.websocketText);
  const unifiedTranscript = useUnifiedWebSocketStore((state) => state.websocketText);
  const userDetails = useCopilotStore((state) => state.userDetails);


  // Use UnifiedWebSocketStore for cisco/genesis, legacy for others (Meet, Phone)
  const transcript = useUnifiedStore ? unifiedTranscript : legacyTranscript;

  // Check if user is at the bottom of the scroll
  const isUserAtBottom = useCallback(() => {
    if (!containerRef.current) return true;
    
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    // Consider user at bottom if within 150px of the bottom
    const threshold = 150;
    return scrollHeight - scrollTop - clientHeight < threshold;
  }, [containerRef]);

  const scrollToBottom = useCallback(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    // Only auto-scroll if user is already at the bottom
    if (isUserAtBottom()) {
      scrollToBottom();
    }
  }, [transcript, isUserAtBottom, scrollToBottom]);

  // Memoize filtered transcript to avoid recalculating on every render
  const filteredTranscript = useMemo(() => {
    return transcript.filter((item, index) => {
      // Remove empty content from the last item
      if (index === transcript.length - 1) {
        return item.content !== '';
      }
      // Filter out consecutive duplicates
      if (index > 0 && transcript[index - 1].content === item.content) {
        return false;
      }
      return true;
    });
  }, [transcript]);

  return (
    <>
      {filteredTranscript.map((line, index) => (
        <CallerInfoTabsItem
          key={`${line.timestamp}-${index}`}
          content={line.content}
          userName={userDetails?.fullName || line?.userName}
          profilePic={null}
          extra={`pt-1 border-b ${line.isPartial ? 'text-gray-400' : ''}`}
          title={userDetails?.fullName || line?.userName}
          timestamp={line.timestamp}
        />
      ))}
      <div ref={transcriptEndRef} />
    </>
  );
}

export default CallerInfoTab;