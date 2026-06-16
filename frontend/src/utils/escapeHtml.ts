export function escapeHtml(input: string) {

  const textArea = document.createElement('textarea');
  textArea.innerHTML = input;
  const decodedInput = textArea.value;

  return decodedInput
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
