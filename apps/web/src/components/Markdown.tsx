"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({ text }: { text: string }) {
  return (
    <div className="prose-jarvis break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{ a: ({ ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" /> }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
