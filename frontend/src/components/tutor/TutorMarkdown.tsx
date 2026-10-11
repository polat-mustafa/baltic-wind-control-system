/**
 * A tutor answer as Markdown (headings, bold, lists, GFM tables), sized for the narrow chat panel.
 * Lazy-loaded by TutorPanel, so the Markdown parser is only fetched once the tutor answers.
 * Raw HTML in the answer is not rendered (react-markdown's default), so a model cannot inject markup.
 */

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const components: Components = {
  h1: ({ children }) => <h3 className="mt-3 text-sm font-semibold text-text-primary first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="mt-3 text-sm font-semibold text-text-primary first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mt-2 text-sm font-semibold text-text-primary first:mt-0">{children}</h4>,
  h4: ({ children }) => <h4 className="mt-2 text-sm font-medium text-text-primary first:mt-0">{children}</h4>,
  p: ({ children }) => <p className="my-1.5 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="my-1.5 list-disc space-y-0.5 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-1.5 list-decimal space-y-0.5 pl-5">{children}</ol>,
  strong: ({ children }) => <strong className="font-semibold text-text-primary">{children}</strong>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-accent hover:underline">
      {children}
    </a>
  ),
  code: ({ children }) => <code className="rounded bg-bg-tertiary px-1 font-mono text-[0.85em]">{children}</code>,
  pre: ({ children }) => <pre className="my-1.5 overflow-x-auto rounded bg-bg-tertiary p-2 text-xs [&_code]:bg-transparent [&_code]:p-0">{children}</pre>,
  blockquote: ({ children }) => <blockquote className="my-1.5 border-l-2 border-accent pl-2 text-text-secondary">{children}</blockquote>,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b border-border-secondary px-1.5 py-1 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="border-b border-border-primary px-1.5 py-1 align-top">{children}</td>,
};

export default function TutorMarkdown({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {text}
    </ReactMarkdown>
  );
}
