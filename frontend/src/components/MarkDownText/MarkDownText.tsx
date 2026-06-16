import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

function MarkDownText(props: { extra?: string; value?: string; codeTextColor?: string }) {
  const { extra, value, codeTextColor } = props;
  return (
    <div className="text-sm leading-relaxed text-neutral-alpha ">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        // @ts-ignore
        rehypePlugins={[rehypeRaw]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold mt-6 mb-1">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-bold mt-5 mb-1">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-bold mt-4 mb-1">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-base font-bold mt-3 mb-1">{children}</h4>
          ),
          h5: ({ children }) => (
            <h5 className="text-sm font-bold mt-2 mb-1">{children}</h5>
          ),
          h6: ({ children }) => (
            <h6 className="text-xs font-bold mt-2 mb-1">{children}</h6>
          ),
          p: ({ children }) => <p className="mb-1">{children}</p>,
          strong: ({ children }) => (
            <strong className="font-bold">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          code: ({ inline, className, children }) => (inline ? (
            <code className={`bg-[var(--accent-3)] px-1 py-0.5 rounded text-xs font-mono ${codeTextColor || ''}`}>
              {children}
            </code>
          ) : (
            <code
              className={`block bg-[var(--accent-3)] p-3 rounded-lg mb-3 text-xs font-mono  overflow-x-auto whitespace-pre-wrap break-words ${codeTextColor || ''} ${className || ''}`}
            >
              {children}
            </code>
          )),
          pre: ({ children }) => (
            <pre className="bg-[var(--accent-3)] p-3 rounded-lg mb-1 overflow-x-auto text-xs">
              {children}
            </pre>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 mb-1">{children}</ol>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-5 mb-1">{children}</ul>
          ),
          li: ({ children }) => <li className="mb-1">{children}</li>,
          a: ({ href, children }) => (
            <a href={href} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-gray-300 pl-3 italic my-3 text-sm">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-4 border-t border-gray-300" />,

          table: ({ children }) => (
            <table className="w-full border-collapse mb-1 text-sm">
              {children}
            </table>
          ),
          th: ({ children }) => (
            <th className="border border-gray-300 px-3 py-1 bg-gray-100">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-gray-300 px-3 py-1">{children}</td>
          ),
        }}
      >
        {value}
      </ReactMarkdown>
    </div>
  );
}

export default MarkDownText;
