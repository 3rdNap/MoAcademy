"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Download, Upload } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/form";
import { subjects } from "@/lib/billing/subjects";

const VALID_CODES = new Set(subjects.map((s) => s.code));
const IMPORT_ROLES = new Set(["student", "instructor", "parent"]);

interface ParsedRow {
  name: string;
  role: string;
  subjects: string[];
  /** Empty when the row is importable. */
  problems: string[];
}

interface RowResult {
  name: string;
  email?: string;
  password?: string;
  role: string;
  subjects: string[];
  ok: boolean;
  error?: string;
}

/** Split one CSV line into fields, honouring double-quoted fields that may
 *  contain commas or escaped ("") quotes. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/** Parse the pasted CSV into validated rows. Columns: name, role, subjects
 *  (subjects `|`-separated codes). A leading header line is skipped. */
function parseCsv(text: string): ParsedRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  // Skip a first line that looks like a header.
  const first = splitCsvLine(lines[0]).map((c) => c.trim().toLowerCase());
  const looksLikeHeader =
    first[0] === "name" || first[1] === "role" || first.includes("subjects");
  const dataLines = looksLikeHeader ? lines.slice(1) : lines;

  return dataLines.map((line) => {
    const cells = splitCsvLine(line);
    const name = (cells[0] ?? "").trim();
    const role = (cells[1] ?? "").trim().toLowerCase();
    const codes = Array.from(
      new Set(
        (cells[2] ?? "")
          .split("|")
          .map((c) => c.trim().toUpperCase())
          .filter(Boolean),
      ),
    );

    const problems: string[] = [];
    if (!name) problems.push("Missing name");
    if (!IMPORT_ROLES.has(role)) problems.push(role ? `Unknown role "${role}"` : "Missing role");
    const bad = codes.filter((c) => !VALID_CODES.has(c));
    if (bad.length > 0) problems.push(`Unknown code(s): ${bad.join(", ")}`);

    return { name, role, subjects: codes, problems };
  });
}

/** Console CSV escaping convention (see AdminConsole.exportRegistrationsCsv). */
function escapeCsv(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/**
 * Admin-only bulk onboarding. Paste or upload a `name,role,subjects` CSV, review
 * a validated preview (problem rows are skipped), then provision the cohort in
 * one request — accounts with temp passwords and current-term enrolments. The
 * generated credentials are shown once for download/hand-off.
 */
export function ImportPeopleButton({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<"input" | "preview" | "results">("input");
  const [csv, setCsv] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [results, setResults] = useState<RowResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const valid = useMemo(() => rows.filter((r) => r.problems.length === 0), [rows]);
  const problemCount = rows.length - valid.length;
  const createdCount = results.filter((r) => r.ok).length;

  function reset() {
    setStage("input");
    setCsv("");
    setRows([]);
    setResults([]);
    setError(null);
    setBusy(false);
    setCopied(false);
  }

  function close() {
    setOpen(false);
    if (createdCount > 0) router.refresh();
    reset();
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result ?? ""));
    reader.readAsText(file);
    e.target.value = "";
  }

  function toPreview() {
    const parsed = parseCsv(csv);
    if (parsed.length === 0) {
      setError("No rows found. Paste or upload a name,role,subjects CSV.");
      return;
    }
    setError(null);
    setRows(parsed);
    setStage("preview");
  }

  async function importRows() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: valid.map((r) => ({ name: r.name, role: r.role, subjects: r.subjects })),
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { results?: RowResult[]; error?: string }
        | null;
      if (!res.ok || !data?.results) {
        setError(data?.error ?? "Couldn't import the cohort.");
        return;
      }
      setResults(data.results);
      setStage("results");
    } catch {
      setError("Couldn't import the cohort.");
    } finally {
      setBusy(false);
    }
  }

  function credentialsCsv(): string {
    const header = ["name", "email", "password", "role", "subjects"];
    const body = results
      .filter((r) => r.ok)
      .map((r) => [r.name, r.email ?? "", r.password ?? "", r.role, r.subjects.join("|")]);
    return [header, ...body].map((row) => row.map(escapeCsv).join(",")).join("\r\n");
  }

  function downloadCredentials() {
    const blob = new Blob([`﻿${credentialsCsv()}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `moacademy-credentials-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(credentialsCsv());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* values are visible on screen */
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={!enabled}
        title={enabled ? undefined : "Add SUPABASE_SERVICE_ROLE_KEY to enable"}
        className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg border border-black/10 px-3 text-xs font-semibold text-ink hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10"
      >
        <Upload className="h-3.5 w-3.5" /> Import people
      </button>

      <Modal
        open={open}
        onClose={close}
        title={
          stage === "results"
            ? "Import complete"
            : stage === "preview"
              ? "Review import"
              : "Import people"
        }
        description={
          stage === "results"
            ? "Credentials are shown once — download or copy before closing."
            : stage === "preview"
              ? "Rows with problems are skipped. Import creates the rest."
              : "Paste or upload a CSV to onboard a cohort in one operation."
        }
      >
        {stage === "input" && (
          <div className="space-y-3">
            <div className="rounded-lg border border-black/10 bg-surface-subtle p-3 text-xs text-ink-muted dark:border-white/10">
              <p className="font-medium text-ink">Columns: name, role, subjects</p>
              <p className="mt-1">
                Role is one of student, instructor, parent. Subjects are{" "}
                <code className="font-mono">|</code>-separated catalogue codes
                (e.g. <code className="font-mono">MATH|PHSC</code>) — leave empty
                for none; ignored for parents. A header row is optional.
              </p>
            </div>
            <Textarea
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              placeholder={"name,role,subjects\nThabo Mokoena,student,MATH|PHSC\nAyesha Khan,instructor,MATH"}
              className="min-h-[160px] font-mono text-xs"
              aria-label="CSV rows"
            />
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={onFile}
                className="hidden"
              />
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4" /> Upload .csv
              </Button>
            </div>

            {error && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button onClick={toPreview} disabled={!csv.trim()}>
                Preview
              </Button>
            </div>
          </div>
        )}

        {stage === "preview" && (
          <div className="space-y-3">
            <div className="max-h-72 overflow-auto rounded-lg border border-black/10 dark:border-white/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/5 bg-surface-subtle text-left text-xs uppercase tracking-wide text-ink-faint">
                    <th className="px-3 py-2 font-semibold">Name</th>
                    <th className="px-3 py-2 font-semibold">Role</th>
                    <th className="px-3 py-2 font-semibold">Subjects</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {rows.map((r, i) => (
                    <tr key={i} className={r.problems.length ? "bg-rose-50/60 dark:bg-rose-500/10" : ""}>
                      <td className="px-3 py-2 text-ink">{r.name || "—"}</td>
                      <td className="px-3 py-2 capitalize text-ink-muted">{r.role || "—"}</td>
                      <td className="px-3 py-2 text-ink-muted">
                        {r.subjects.length ? r.subjects.join(", ") : "—"}
                        {r.problems.length > 0 && (
                          <p className="text-xs text-rose-600 dark:text-rose-300">
                            {r.problems.join(" · ")}
                          </p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-ink-muted">
              {valid.length} ready
              {problemCount > 0 && (
                <> · {problemCount} with problems — problem rows will be skipped</>
              )}
            </p>

            {error && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setStage("input")}>
                Back
              </Button>
              <Button onClick={importRows} disabled={busy || valid.length === 0}>
                {busy ? "Importing…" : `Import ${valid.length}`}
              </Button>
            </div>
          </div>
        )}

        {stage === "results" && (
          <div className="space-y-3">
            <p className="text-sm text-ink-muted">
              {createdCount} created
              {results.length - createdCount > 0 && (
                <> · {results.length - createdCount} failed</>
              )}
            </p>
            <div className="max-h-72 overflow-auto rounded-lg border border-black/10 dark:border-white/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/5 bg-surface-subtle text-left text-xs uppercase tracking-wide text-ink-faint">
                    <th className="px-3 py-2 font-semibold">Name</th>
                    <th className="px-3 py-2 font-semibold">Email / status</th>
                    <th className="px-3 py-2 font-semibold">Password</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {results.map((r, i) => (
                    <tr key={i} className={r.ok ? "" : "bg-rose-50/60 dark:bg-rose-500/10"}>
                      <td className="px-3 py-2 text-ink">{r.name || "—"}</td>
                      <td className="px-3 py-2">
                        {r.ok ? (
                          <span className="text-ink-muted">{r.email}</span>
                        ) : (
                          <span className="text-rose-600 dark:text-rose-300">{r.error}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs font-semibold text-ink">
                        {r.ok ? r.password : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {createdCount > 0 && (
              <>
                <p className="text-xs text-ink-faint">
                  Passwords are shown once — download before closing.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={downloadCredentials}>
                    <Download className="h-4 w-4" /> Download credentials CSV
                  </Button>
                  <Button variant="outline" onClick={copyAll}>
                    {copied ? (
                      <>
                        <Check className="h-4 w-4" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" /> Copy all
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}

            <div className="flex justify-end pt-1">
              <Button variant="outline" onClick={close}>
                Done
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
