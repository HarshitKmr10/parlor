export const stringUtils = {
  trimMiddle: (str: string, len: number, padding = 3): string => (str.length > len
    ? `${str.slice(0, padding)}...${str.slice(-padding)}`
    : str),
  formatGMeetLink: (link: string): string => link.replace('https://meet.google.com/', ''),
  copyToClipboard: (text: string): Promise<void> => navigator.clipboard.writeText(text),
  trimText: (str: string, MAX_LEN = 40): string => (str.length <= MAX_LEN ? str : `${str.slice(0, 30)}...`),
};

export function formatEmployeeId(id: string): string {
  return `${id.slice(0, 6)}...${id.slice(-4)}`;
}

export const truncateMessage = (message: string, limit: number): string => {
  const words = message.split(' ');
  return words.length > limit
    ? `${words.slice(0, limit).join(' ')}...`
    : message;
};

export const copyToClipboard = (text: string): void => {
  navigator.clipboard.writeText(text).catch((error) => {
    console.error('Failed to copy text: ', error);
  });
};

export function reformatTranscript(htmlString: string): string {
  const div = document.createElement('div');
  div.innerHTML = htmlString;
  const strongTags = div.querySelectorAll('strong');

  let formattedText = '';
  strongTags.forEach((tag) => {
    const speakerText = tag.textContent?.trim() || '';
    let text = '';
    let nextElement = tag.nextSibling;
    while (nextElement && nextElement.nodeName !== 'STRONG') {
      text += `${nextElement.textContent?.trim()} `;
      nextElement = nextElement.nextSibling;
    }
    formattedText += `Speaker ${speakerText}: ${text.trim()}\n\n`;
  });
  return formattedText;
}
