import React, { useState, useEffect } from 'react';
import {
  ScrollArea, Flex, Text, Spinner, Box,
} from '@radix-ui/themes';

interface DocumentDisplayProps {
  url: string;
}

const DocumentDisplay: React.FC<DocumentDisplayProps> = ({ url }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string>(url);

  useEffect(() => {
    // Extract the base filename before any query parameters
    const baseUrl = url.split('?')[0];
    const isDocx = baseUrl.toLowerCase().endsWith('.docx');

    if (isDocx) {
      // Encode the full URL including query parameters
      const encodedUrl = encodeURIComponent(url);
      setViewerUrl(`https://view.officeapps.live.com/op/embed.aspx?src=${encodedUrl}`);
    } else {
      setViewerUrl(url);
    }
  }, [url]);

  return (
    <Flex className="flex-1 min-h-0 border rounded-md bg-white overflow-hidden w-full position-relative">
      {isLoading && (
        <Flex justify="center" align="center" className="w-full h-full" position="absolute">
          <Spinner />
        </Flex>
      )}
      {!!error && (
        <Flex direction="column" justify="center" align="center" className="h-32">
          <Text color="red">Error loading document</Text>
          <Text size="2">{error}</Text>
        </Flex>
      )}
      <iframe
        src={viewerUrl}
        className="w-full h-[78vh]"
        onLoad={() => setIsLoading(false)}
        onError={() => setError('Failed to load document')}
      />
    </Flex>
  );
};

export default DocumentDisplay;
