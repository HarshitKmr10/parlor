// import { renderToStaticMarkup } from "react-dom/server";
// import * as ReactDOMServer from 'react-dom/server';

type HtmlParsedAnswer = {
  answerHtml: string;
  citations: string[];
};

export function parseAnswerToHtml(
  answer: string,
  isStreaming: boolean,
): HtmlParsedAnswer {
  const citations: string[] = [];
  const parsedAnswer = answer?.trim();

  return {
    answerHtml: parsedAnswer,
    citations,
  };
}
