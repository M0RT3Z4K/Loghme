import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function MessageRenderer({ content }) {
  if (!content) return null;

  return (
    <div className="message-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ inline, className, children, ...props }) {
            if (inline) {
              return (
                <code className="inline-code" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <pre className="code-block">
                <code className={className} {...props}>
                  {children}
                </code>
              </pre>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
