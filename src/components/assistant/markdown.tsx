import { Fragment, type ReactNode } from "react";

// A tiny, dependency-free Markdown renderer for assistant replies. It returns
// React nodes (never dangerouslySetInnerHTML), so there's no XSS surface. It
// covers the subset Claude actually emits in a tutoring chat: headings, bullet
// and numbered lists, fenced + inline code, bold and italic. Anything else
// falls through as plain text.

/** Render inline **bold**, *italic*, and `code` within a line. */
function renderInline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Split on inline code first so markup inside backticks is left literal.
  const parts = text.split(/(`[^`]+`)/g);
  parts.forEach((part, i) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 1) {
      nodes.push(
        <code
          key={`${keyBase}-c${i}`}
          className="rounded bg-surface-subtle px-1 py-0.5 font-mono text-[0.85em] text-ink dark:bg-white/10"
        >
          {part.slice(1, -1)}
        </code>,
      );
      return;
    }
    // Bold, then italic, within a non-code segment.
    const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
    boldParts.forEach((bp, j) => {
      if (bp.startsWith("**") && bp.endsWith("**") && bp.length > 2) {
        nodes.push(
          <strong key={`${keyBase}-b${i}-${j}`} className="font-semibold">
            {bp.slice(2, -2)}
          </strong>,
        );
        return;
      }
      const italicParts = bp.split(/(\*[^*]+\*|_[^_]+_)/g);
      italicParts.forEach((ip, k) => {
        if (
          (ip.startsWith("*") && ip.endsWith("*") && ip.length > 1) ||
          (ip.startsWith("_") && ip.endsWith("_") && ip.length > 1)
        ) {
          nodes.push(<em key={`${keyBase}-i${i}-${j}-${k}`}>{ip.slice(1, -1)}</em>);
        } else if (ip) {
          nodes.push(<Fragment key={`${keyBase}-t${i}-${j}-${k}`}>{ip}</Fragment>);
        }
      });
    });
  });
  return nodes;
}

export function renderMarkdown(text: string): ReactNode {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let code: { lang: string; lines: string[] } | null = null;
  let key = 0;

  const flushList = () => {
    if (!list) return;
    const items = list.items;
    const ordered = list.ordered;
    blocks.push(
      ordered ? (
        <ol key={key++} className="my-2 ml-5 list-decimal space-y-1">
          {items.map((it, i) => (
            <li key={i}>{renderInline(it, `li${key}-${i}`)}</li>
          ))}
        </ol>
      ) : (
        <ul key={key++} className="my-2 ml-5 list-disc space-y-1">
          {items.map((it, i) => (
            <li key={i}>{renderInline(it, `li${key}-${i}`)}</li>
          ))}
        </ul>
      ),
    );
    list = null;
  };

  for (const raw of lines) {
    // Fenced code blocks.
    const fence = raw.match(/^```(\w*)\s*$/);
    if (fence) {
      if (code) {
        blocks.push(
          <pre
            key={key++}
            className="my-2 overflow-x-auto rounded-lg bg-ink/90 p-3 text-xs text-white dark:bg-black/50"
          >
            <code>{code.lines.join("\n")}</code>
          </pre>,
        );
        code = null;
      } else {
        flushList();
        code = { lang: fence[1], lines: [] };
      }
      continue;
    }
    if (code) {
      code.lines.push(raw);
      continue;
    }

    const line = raw.trimEnd();

    // Headings.
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flushList();
      const level = heading[1].length;
      const cls =
        level <= 1
          ? "mt-3 mb-1 text-base font-bold text-ink"
          : level === 2
            ? "mt-3 mb-1 text-sm font-bold text-ink"
            : "mt-2 mb-0.5 text-sm font-semibold text-ink";
      blocks.push(
        <p key={key++} className={cls}>
          {renderInline(heading[2], `h${key}`)}
        </p>,
      );
      continue;
    }

    // List items.
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const ordered = line.match(/^\s*\d+\.\s+(.*)$/);
    if (bullet) {
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push(bullet[1]);
      continue;
    }
    if (ordered) {
      if (!list || !list.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push(ordered[1]);
      continue;
    }

    // Blank line ends the current list/paragraph.
    if (!line.trim()) {
      flushList();
      continue;
    }

    // Plain paragraph.
    flushList();
    blocks.push(
      <p key={key++} className="my-1.5 leading-relaxed">
        {renderInline(line, `p${key}`)}
      </p>,
    );
  }

  flushList();
  if (code) {
    blocks.push(
      <pre
        key={key++}
        className="my-2 overflow-x-auto rounded-lg bg-ink/90 p-3 text-xs text-white dark:bg-black/50"
      >
        <code>{code.lines.join("\n")}</code>
      </pre>,
    );
  }

  return <div className="space-y-0">{blocks}</div>;
}
