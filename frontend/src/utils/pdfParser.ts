import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js to use a CDN-hosted worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export async function parsePdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullHtml = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    let lastY; let
      textChunk = '';
    let isBold = false;

    for (const item of textContent.items) {
      if ('transform' in item) {
        if (lastY !== item.transform[5] && textChunk !== '') {
          fullHtml += `<p>${textChunk}</p>`;
          textChunk = '';
          isBold = false;
        }

        // Check if the font is bold
        if (item.fontName.toLowerCase().includes('bold')) {
          if (!isBold) {
            textChunk += '<strong>';
            isBold = true;
          }
        } else if (isBold) {
          textChunk += '</strong>';
          isBold = false;
        }

        // Check if it's a heading (you may need to adjust this logic based on your PDF structure)
        if (item.height > 14) { // Assuming larger text is a heading
          textChunk += `<h2>${item.str}</h2>`;
        } else {
          textChunk += item.str;
        }

        lastY = item.transform[5];
      } else {
        // Handle case where item doesn't have transform property
        // ... (add appropriate logic here)
      }
    }
    if (textChunk !== '') {
      if (isBold) textChunk += '</strong>';
      fullHtml += `<p>${textChunk}</p>`;
    }
  }

  return fullHtml;
}
