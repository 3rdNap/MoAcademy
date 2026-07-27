import { BookMarked } from "lucide-react";
import { Widget } from "@/components/ui/Widget";
import { Badge } from "@/components/ui/Badge";
import type { CourseTextbook } from "@/lib/data";

/** Read-only reading list for a course home page (migration 0042). Editing
 *  stays in the global /textbooks tab; this just surfaces the books that
 *  apply to this course. Renders nothing when the list is empty so it never
 *  leaves a blank card in the sidebar. */
export function CourseTextbooksWidget({
  textbooks,
}: {
  textbooks: CourseTextbook[];
}) {
  if (textbooks.length === 0) return null;

  return (
    <Widget
      title="Required reading"
      icon={<BookMarked className="h-4 w-4 text-brand-600" />}
    >
      <ul className="space-y-3">
        {textbooks.map((t) => {
          const href = t.resourceUrl || t.filePath || undefined;
          return (
            <li key={t.id} className="flex items-start gap-3">
              {t.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={t.coverUrl}
                  alt=""
                  className="h-12 w-9 flex-none rounded object-cover"
                />
              ) : (
                <div className="flex h-12 w-9 flex-none items-center justify-center rounded bg-surface-sunken">
                  <BookMarked className="h-4 w-4 text-ink-faint" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">
                  {t.title}
                </p>
                <p className="truncate text-xs text-ink-faint">
                  {t.author}
                  {t.edition ? ` · ${t.edition}` : ""}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge tone={t.required ? "brand" : "neutral"}>
                    {t.required ? "Required" : "Recommended"}
                  </Badge>
                  {href && (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-brand-600 hover:underline"
                    >
                      Get book
                    </a>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Widget>
  );
}
