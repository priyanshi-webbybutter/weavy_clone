import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownMessageProps {
  content: string;
}

export default function MarkdownMessage({ content }: MarkdownMessageProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Images
        img: ({ src, alt }) => (
          <img
            src={src}
            alt={alt || ''}
            className="w-full h-auto rounded-lg border border-[#3a3a3a] my-3"
            loading="lazy"
          />
        ),

        // Bold text
        strong: ({ children }) => (
          <strong className="font-semibold text-white">{children}</strong>
        ),

        // Unordered lists
        ul: ({ children }) => (
          <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>
        ),

        // Ordered lists
        ol: ({ children }) => (
          <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>
        ),

        // List items
        li: ({ children }) => (
          <li className="text-gray-200">{children}</li>
        ),

        // Paragraphs
        p: ({ children }) => (
          <p className="mb-2 text-gray-200 last:mb-0">{children}</p>
        ),

        // Headings
        h1: ({ children }) => (
          <h1 className="text-lg font-semibold text-white mb-2 mt-4 first:mt-0">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-base font-semibold text-white mb-2 mt-3 first:mt-0">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-semibold text-white mb-2 mt-2 first:mt-0">{children}</h3>
        ),

        // Code blocks
        code: ({ className, children }) => {
          const isInline = !className;
          return isInline ? (
            <code className="bg-gray-800 text-blue-400 px-1 py-0.5 rounded text-xs">
              {children}
            </code>
          ) : (
            <code className="block bg-gray-800 text-gray-200 p-3 rounded-lg my-2 overflow-x-auto text-sm">
              {children}
            </code>
          );
        },

        // Blockquotes
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-blue-500 pl-4 my-2 italic text-gray-300">
            {children}
          </blockquote>
        ),

        // Links
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline"
          >
            {children}
          </a>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
