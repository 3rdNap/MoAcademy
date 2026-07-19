"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  HelpCircle,
  ListChecks,
  Paperclip,
  Pencil,
  Plus,
  Send,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { MoMarkIcon } from "@/components/layout/MoMarkIcon";
import { useRole } from "@/components/role/RoleProvider";
import { canTeach } from "@/lib/role";
import { useLocalCollection, newId } from "@/lib/local-store";
import {
  addAssignmentGroup,
  addRemoteAssignment,
  fetchAssignmentGroups,
  fetchRemoteAssignments,
  removeAssignmentGroup,
  removeRemoteAssignment,
  updateAssignmentGroup,
  updateRemoteAssignment,
  type AssignmentGroup,
} from "@/lib/course-content-db";
import { getSignedInUserId } from "@/lib/study-guides-db";
import {
  addRubricCriterion,
  fetchMySubmissions,
  fetchRubrics,
  getSubmissionFileUrl,
  removeRubricCriterion,
  updateRubricCriterion,
  uploadSubmissionFile,
  upsertMySubmission,
  type RemoteSubmission,
  type RubricCriterion,
} from "@/lib/gradebook-db";
import {
  addQuizQuestion,
  fetchAnswerKeys,
  fetchMyAttempts,
  fetchMyQuizSources,
  fetchQuizQuestions,
  removeQuizQuestion,
  submitQuizAttempt,
  updateQuizQuestion,
  type QuizAttempt,
  type QuizQuestion,
  type QuizSource,
} from "@/lib/quiz-db";
import { itemIcon } from "@/lib/itemMeta";
import { formatDateTime, relativeTime } from "@/lib/utils";
import type { Assignment, Course, SubmissionStatus } from "@/lib/types";

interface Submission {
  id: string; // assignment id
  body: string;
  fileName?: string;
  filePath?: string;
  submittedAt: string;
}

const statusBadge: Record<
  SubmissionStatus,
  { tone: "neutral" | "brand" | "success" | "warning" | "danger" | "info"; label: string }
> = {
  not_started: { tone: "neutral", label: "Not started" },
  in_progress: { tone: "info", label: "In progress" },
  submitted: { tone: "brand", label: "Submitted" },
  graded: { tone: "success", label: "Graded" },
  late: { tone: "warning", label: "Late" },
  missing: { tone: "danger", label: "Missing" },
};

type AuthorType = "assignment" | "quiz" | "discussion";
type Draft = {
  id?: string;
  title: string;
  type: AuthorType;
  dueAt: string; // yyyy-mm-dd
  points: number;
  description: string;
  groupId: string; // "" = no group
};

const emptyDraft: Draft = {
  title: "",
  type: "assignment",
  dueAt: "",
  points: 100,
  description: "",
  groupId: "",
};

export function CourseAssignmentsBoard({
  course,
  seed,
}: {
  course: Course;
  seed: Assignment[];
}) {
  const { role, hydrated } = useRole();
  const teaching = hydrated && canTeach(role);

  const authored = useLocalCollection<Assignment>(
    `moacademy.authoring.assignments.${course.id}`,
    [],
  );

  const submissions = useLocalCollection<Submission>(
    `moacademy.submissions.${course.id}`,
    [],
  );

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [submitFor, setSubmitFor] = useState<Assignment | null>(null);
  const [subBody, setSubBody] = useState("");
  const [subFile, setSubFile] = useState<string | undefined>();
  // The picked File itself (only when the student attaches a new file this
  // session); subFile keeps the display name, incl. a previously stored one.
  const [subFileObj, setSubFileObj] = useState<File | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [pubNote, setPubNote] = useState<string | null>(null);

  // Shared assignments (Supabase): published by signed-in teaching accounts,
  // visible to every student on every device.
  const [remote, setRemote] = useState<Assignment[] | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  // Weighted grading buckets (assignment_groups). Empty when offline/none.
  const [groups, setGroups] = useState<AssignmentGroup[]>([]);
  useEffect(() => {
    let alive = true;
    fetchRemoteAssignments(course.id).then((r) => alive && setRemote(r));
    fetchAssignmentGroups(course.id).then((g) => alive && g && setGroups(g));
    getSignedInUserId().then((id) => alive && setSignedIn(Boolean(id)));
    return () => {
      alive = false;
    };
  }, [course.id]);

  const groupName = (id?: string) =>
    id ? groups.find((g) => g.id === id)?.name : undefined;

  // Manage-groups modal (teaching accounts, real signed-in mode only).
  const [manageOpen, setManageOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupWeight, setNewGroupWeight] = useState(0);
  const weightSum = groups.reduce((n, g) => n + g.weight, 0);

  async function addGroup() {
    const name = newGroupName.trim();
    if (!name) return;
    const created = await addAssignmentGroup(course.id, {
      name,
      weight: Math.max(0, Math.min(100, newGroupWeight)),
      position: groups.length,
    });
    if (created) {
      setGroups((prev) => [...prev, created]);
      setNewGroupName("");
      setNewGroupWeight(0);
    } else {
      setPubNote(
        "Couldn't create the group (teaching account required).",
      );
    }
  }

  // Persist an edited field; optimistic state already updated by the caller.
  async function persistGroup(
    id: string,
    patch: { name?: string; weight?: number },
  ) {
    if (!(await updateAssignmentGroup(id, patch))) {
      setPubNote("Couldn't save the group change (teaching account required).");
    }
  }

  async function deleteGroup(id: string) {
    if (await removeAssignmentGroup(id)) {
      setGroups((prev) => prev.filter((g) => g.id !== id));
      // DB clears assignments.group_id (ON DELETE SET NULL) — mirror locally.
      setRemote((prev) =>
        (prev ?? []).map((a) =>
          a.groupId === id ? { ...a, groupId: undefined } : a,
        ),
      );
    } else {
      setPubNote("Couldn't delete the group (teaching account required).");
    }
  }

  // My real submissions to shared assignments — reaches the instructor.
  const [mySubs, setMySubs] = useState<Record<string, RemoteSubmission>>({});
  useEffect(() => {
    if (!remote || remote.length === 0) return;
    let alive = true;
    fetchMySubmissions(remote.map((a) => a.id)).then((subs) => {
      if (!alive || !subs) return;
      setMySubs(Object.fromEntries(subs.map((s) => [s.assignmentId, s])));
    });
    return () => {
      alive = false;
    };
  }, [remote]);

  // Rubrics for the shared assignments, keyed by assignment id. Real-mode only.
  const [rubrics, setRubrics] = useState<Record<string, RubricCriterion[]>>({});
  useEffect(() => {
    if (!remote || remote.length === 0) return;
    let alive = true;
    fetchRubrics(remote.map((a) => a.id)).then((crit) => {
      if (!alive || !crit) return;
      const byAssignment: Record<string, RubricCriterion[]> = {};
      for (const c of crit) (byAssignment[c.assignmentId] ??= []).push(c);
      setRubrics(byAssignment);
    });
    return () => {
      alive = false;
    };
  }, [remote]);

  // Quiz questions for the shared assignments, keyed by assignment id. Answer
  // keys (question id → correct index) load only for teaching accounts; null
  // means "not available" (RLS hides them from students). Real-mode only.
  const [questions, setQuestions] = useState<Record<string, QuizQuestion[]>>(
    {},
  );
  const [answerKeys, setAnswerKeys] = useState<Record<string, number> | null>(
    null,
  );
  useEffect(() => {
    if (!remote || remote.length === 0) return;
    let alive = true;
    fetchQuizQuestions(remote.map((a) => a.id)).then((qs) => {
      if (!alive || !qs) return;
      const byAssignment: Record<string, QuizQuestion[]> = {};
      for (const q of qs) (byAssignment[q.assignmentId] ??= []).push(q);
      setQuestions(byAssignment);
      if (teaching && qs.length > 0) {
        fetchAnswerKeys(qs.map((q) => q.id)).then(
          (keys) => alive && setAnswerKeys(keys),
        );
      }
    });
    return () => {
      alive = false;
    };
  }, [remote, teaching]);

  // My own quiz attempts (one per assignment), keyed by assignment id. Drives
  // the student-side Take/Review action for quiz rows. Real signed-in only.
  const [attempts, setAttempts] = useState<Record<string, QuizAttempt>>({});
  useEffect(() => {
    if (!remote || remote.length === 0 || !signedIn) return;
    let alive = true;
    fetchMyAttempts(remote.map((a) => a.id)).then((list) => {
      if (!alive || !list) return;
      setAttempts(Object.fromEntries(list.map((at) => [at.assignmentId, at])));
    });
    return () => {
      alive = false;
    };
  }, [remote, signedIn]);

  // A remote quiz assignment that actually has questions — the only rows that
  // get the take-quiz flow (a quiz without questions is a generic assignment).
  const isTakeableQuiz = (a: Assignment) =>
    a.type === "quiz" &&
    Boolean(remote?.some((x) => x.id === a.id)) &&
    (questions[a.id]?.length ?? 0) > 0;

  // Take/review-quiz modal (students). takeReview = read-only past attempt;
  // takeResult holds the just-submitted grade breakdown.
  const [takeFor, setTakeFor] = useState<Assignment | null>(null);
  const [takeAnswers, setTakeAnswers] = useState<Record<string, number>>({});
  const [takeResult, setTakeResult] = useState<{
    earned: number;
    total: number;
    score: number;
    points: number;
    correct: string[];
  } | null>(null);
  const [takeReview, setTakeReview] = useState(false);
  const [takeBusy, setTakeBusy] = useState(false);
  const takeQuestions = takeFor ? questions[takeFor.id] ?? [] : [];
  const takeUnanswered = takeQuestions.filter(
    (q) => takeAnswers[q.id] === undefined,
  ).length;
  const correctSet = takeResult ? new Set(takeResult.correct) : null;

  function openTakeQuiz(a: Assignment) {
    setTakeFor(a);
    setTakeAnswers({});
    setTakeResult(null);
    setTakeReview(false);
    setTakeBusy(false);
  }

  function openReviewQuiz(a: Assignment) {
    setTakeFor(a);
    setTakeAnswers(attempts[a.id]?.answers ?? {});
    setTakeResult(null);
    setTakeReview(true);
    setTakeBusy(false);
  }

  function resetTake() {
    setTakeFor(null);
    setTakeAnswers({});
    setTakeResult(null);
    setTakeReview(false);
    setTakeBusy(false);
  }

  async function submitQuiz() {
    if (!takeFor || takeBusy) return;
    setTakeBusy(true);
    const result = await submitQuizAttempt(takeFor.id, takeAnswers);
    setTakeBusy(false);
    if (!result) {
      setPubNote("Couldn't submit the quiz — try again.");
      return;
    }
    setTakeResult(result);
    // The RPC recorded the attempt and upserted a graded submission; mirror both
    // locally so the row shows Graded + score without a refetch.
    const aid = takeFor.id;
    setAttempts((prev) => ({
      ...prev,
      [aid]: {
        id: prev[aid]?.id ?? aid,
        assignmentId: aid,
        studentId: prev[aid]?.studentId ?? "",
        submittedAt: new Date().toISOString(),
        score: result.earned,
        total: result.total,
        answers: takeAnswers,
      },
    }));
    setMySubs((prev) => ({
      ...prev,
      [aid]: {
        ...prev[aid],
        assignmentId: aid,
        userId: prev[aid]?.userId ?? "",
        body: prev[aid]?.body ?? "",
        status: "graded",
        score: result.score,
      },
    }));
  }

  // Manage-quiz modal (teaching accounts, real signed-in mode only).
  const [quizFor, setQuizFor] = useState<Assignment | null>(null);
  const [newQPrompt, setNewQPrompt] = useState("");
  const [newQOptions, setNewQOptions] = useState<string[]>(["", "", "", ""]);
  const [newQCorrect, setNewQCorrect] = useState(0);
  const [newQPoints, setNewQPoints] = useState(1);
  const quizList = quizFor ? questions[quizFor.id] ?? [] : [];
  const quizTotal = quizList.reduce((n, q) => n + q.points, 0);
  const keysUnavailable = answerKeys === null;

  function resetQuizForm() {
    setNewQPrompt("");
    setNewQOptions(["", "", "", ""]);
    setNewQCorrect(0);
    setNewQPoints(1);
  }

  async function addQuestion() {
    if (!quizFor) return;
    const prompt = newQPrompt.trim();
    const options = newQOptions.map((o) => o.trim());
    if (!prompt || options.some((o) => !o)) return;
    const created = await addQuizQuestion(quizFor.id, {
      prompt,
      options,
      correctIndex: Math.min(newQCorrect, options.length - 1),
      points: Math.max(1, newQPoints),
      position: quizList.length,
    });
    if (created) {
      setQuestions((prev) => ({
        ...prev,
        [quizFor.id]: [...(prev[quizFor.id] ?? []), created],
      }));
      setAnswerKeys((prev) => ({
        ...(prev ?? {}),
        [created.id]: Math.min(newQCorrect, options.length - 1),
      }));
      resetQuizForm();
    } else {
      setPubNote("Couldn't add the question (teaching account required).");
    }
  }

  // Persist an edited question field; optimistic state updated by the caller.
  async function persistQuestion(
    id: string,
    patch: { prompt?: string; options?: string[]; points?: number },
  ) {
    if (!(await updateQuizQuestion(id, patch))) {
      setPubNote("Couldn't save the question change (teaching account required).");
    }
  }

  async function setCorrect(questionId: string, index: number) {
    setAnswerKeys((prev) => ({ ...(prev ?? {}), [questionId]: index }));
    if (!(await updateQuizQuestion(questionId, { correctIndex: index }))) {
      setPubNote("Couldn't save the correct answer (teaching account required).");
    }
  }

  async function deleteQuestion(id: string) {
    if (!quizFor) return;
    if (await removeQuizQuestion(id)) {
      setQuestions((prev) => ({
        ...prev,
        [quizFor.id]: (prev[quizFor.id] ?? []).filter((q) => q.id !== id),
      }));
    } else {
      setPubNote("Couldn't delete the question (teaching account required).");
    }
  }

  // Import-from-another-quiz screen (inside the quiz modal). Sources are the
  // instructor's other quizzes; picking one lists its questions to copy.
  const [importOpen, setImportOpen] = useState(false);
  const [importSources, setImportSources] = useState<QuizSource[] | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importSel, setImportSel] = useState<QuizSource | null>(null);
  const [importQuestions, setImportQuestions] = useState<QuizQuestion[]>([]);
  const [importChecked, setImportChecked] = useState<Set<string>>(new Set());
  const [importBusy, setImportBusy] = useState(false);
  const allImportChecked =
    importQuestions.length > 0 && importChecked.size === importQuestions.length;

  function resetImport() {
    setImportOpen(false);
    setImportSel(null);
    setImportQuestions([]);
    setImportChecked(new Set());
  }

  async function openImport() {
    if (!quizFor) return;
    setImportSel(null);
    setImportQuestions([]);
    setImportChecked(new Set());
    setImportOpen(true);
    setImportLoading(true);
    const sources = await fetchMyQuizSources(quizFor.id);
    setImportSources(sources ?? []);
    setImportLoading(false);
  }

  async function selectSource(src: QuizSource) {
    setImportSel(src);
    setImportChecked(new Set());
    const qs = await fetchQuizQuestions([src.assignmentId]);
    setImportQuestions(qs ?? []);
  }

  async function runImport() {
    if (!quizFor || importChecked.size === 0 || importBusy) return;
    setImportBusy(true);
    const selected = importQuestions.filter((q) => importChecked.has(q.id));
    // One key fetch for all selected ids; a null/missing key means the source
    // isn't teachable by this account — skip and count those questions.
    const keys = await fetchAnswerKeys(selected.map((q) => q.id));
    let nextPos = quizList.length;
    let failed = 0;
    for (const q of selected) {
      const correctIndex = keys?.[q.id];
      if (correctIndex === undefined) {
        failed += 1;
        continue;
      }
      const created = await addQuizQuestion(quizFor.id, {
        prompt: q.prompt,
        options: q.options,
        correctIndex,
        points: q.points,
        position: nextPos,
      });
      if (created) {
        nextPos += 1;
        setQuestions((prev) => ({
          ...prev,
          [quizFor.id]: [...(prev[quizFor.id] ?? []), created],
        }));
        setAnswerKeys((prev) => ({ ...(prev ?? {}), [created.id]: correctIndex }));
      } else {
        failed += 1;
      }
    }
    setImportBusy(false);
    if (failed > 0) setPubNote(`Couldn't import ${failed} question(s).`);
    resetImport();
  }

  // Manage-rubric modal (teaching accounts, real signed-in mode only).
  const [rubricFor, setRubricFor] = useState<Assignment | null>(null);
  const [newCritDesc, setNewCritDesc] = useState("");
  const [newCritPoints, setNewCritPoints] = useState(10);
  const rubricList = rubricFor ? rubrics[rubricFor.id] ?? [] : [];
  const rubricTotal = rubricList.reduce((n, c) => n + c.points, 0);

  async function addCriterion() {
    if (!rubricFor) return;
    const description = newCritDesc.trim();
    if (!description) return;
    const created = await addRubricCriterion(rubricFor.id, {
      description,
      points: Math.max(0, newCritPoints),
      position: rubricList.length,
    });
    if (created) {
      setRubrics((prev) => ({
        ...prev,
        [rubricFor.id]: [...(prev[rubricFor.id] ?? []), created],
      }));
      setNewCritDesc("");
      setNewCritPoints(10);
    } else {
      setPubNote("Couldn't add the criterion (teaching account required).");
    }
  }

  // Persist an edited criterion field; optimistic state updated by the caller.
  async function persistCriterion(
    id: string,
    patch: { description?: string; points?: number },
  ) {
    if (!(await updateRubricCriterion(id, patch))) {
      setPubNote("Couldn't save the rubric change (teaching account required).");
    }
  }

  async function deleteCriterion(id: string) {
    if (!rubricFor) return;
    if (await removeRubricCriterion(id)) {
      setRubrics((prev) => ({
        ...prev,
        [rubricFor.id]: (prev[rubricFor.id] ?? []).filter((c) => c.id !== id),
      }));
    } else {
      setPubNote("Couldn't delete the criterion (teaching account required).");
    }
  }

  /** "Draft with Mo": generate the student-facing description server-side. */
  async function draftWithMo() {
    if (!draft.title.trim() || aiBusy) return;
    setAiBusy(true);
    setAiNote(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "assignment-description",
          title: draft.title,
          type: draft.type,
          course: `${course.code} ${course.name}`,
          points: draft.points,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { text?: string; error?: string }
        | null;
      if (!res.ok || !data?.text) {
        setAiNote(data?.error ?? "Mo couldn't draft that right now.");
        return;
      }
      setDraft((d) => ({ ...d, description: data.text! }));
    } catch {
      setAiNote("Mo couldn't draft that right now.");
    } finally {
      setAiBusy(false);
    }
  }

  function submissionFor(aid: string): Submission | undefined {
    const remoteSub = remote?.some((a) => a.id === aid) ? mySubs[aid] : undefined;
    if (remoteSub) {
      return {
        id: aid,
        body: remoteSub.body,
        fileName: remoteSub.fileName,
        filePath: remoteSub.filePath,
        submittedAt: remoteSub.submittedAt ?? "",
      };
    }
    return submissions.items.find((s) => s.id === aid);
  }

  function effectiveStatus(a: Assignment): SubmissionStatus {
    const remoteSub = remote?.some((x) => x.id === a.id) ? mySubs[a.id] : undefined;
    if (remoteSub) return remoteSub.status;
    if (a.status === "graded") return "graded";
    return submissionFor(a.id) ? "submitted" : a.status;
  }

  function openSubmit(a: Assignment) {
    const existing = submissionFor(a.id);
    setSubmitFor(a);
    setSubBody(existing?.body ?? "");
    setSubFile(existing?.fileName);
    setSubFileObj(null);
  }

  /** Fetch a short-lived signed URL for a stored attachment and open it. */
  async function openAttachment(path: string) {
    const url = await getSubmissionFileUrl(path);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  function resetSubmit() {
    setSubmitFor(null);
    setSubBody("");
    setSubFile(undefined);
    setSubFileObj(null);
  }

  async function submitWork() {
    if (!submitFor) return;
    const isRemoteAssignment = remote?.some((a) => a.id === submitFor.id);
    if (isRemoteAssignment && signedIn) {
      // Upload the attachment (if any) first; a failed upload still submits the
      // text body, name-only, with a note — as before real attachments existed.
      let fileName = subFile;
      let filePath: string | undefined;
      if (subFileObj) {
        const uploaded = await uploadSubmissionFile(submitFor.id, subFileObj);
        if (uploaded) {
          fileName = uploaded.name;
          filePath = uploaded.path;
        } else {
          setPubNote(
            "Attachment couldn't be uploaded — submitted without it.",
          );
        }
      }
      const result = await upsertMySubmission(submitFor.id, {
        body: subBody.trim(),
        fileName,
        filePath,
      });
      if (result) {
        setMySubs((prev) => ({ ...prev, [submitFor.id]: result }));
        resetSubmit();
        return;
      }
      setPubNote(
        "Couldn't submit to your instructor — saved on this device instead.",
      );
    }
    const existing = submissions.items.find((s) => s.id === submitFor.id);
    const record: Submission = {
      id: submitFor.id,
      body: subBody.trim(),
      fileName: subFile,
      submittedAt: new Date().toISOString(),
    };
    if (existing) submissions.update(submitFor.id, record);
    else submissions.add(record);
    resetSubmit();
  }

  type Source = "local" | "remote" | "seed";
  const rows = useMemo(() => {
    // The server-provided seed already merges published rows (data layer), so
    // dedupe against the client's own fetch of the shared table.
    const remoteIds = new Set((remote ?? []).map((a) => a.id));
    const combined = [
      ...seed
        .filter((a) => !remoteIds.has(a.id))
        .map((a) => ({ a, source: "seed" as Source })),
      ...(remote ?? []).map((a) => ({ a, source: "remote" as Source })),
      ...authored.items.map((a) => ({ a, source: "local" as Source })),
    ];
    return combined.sort((x, y) => +new Date(x.a.dueAt) - +new Date(y.a.dueAt));
  }, [seed, remote, authored.items]);

  const totalPoints = rows.reduce((n, r) => n + r.a.points, 0);

  function openCreate() {
    setDraft(emptyDraft);
    setOpen(true);
  }

  function openEdit(a: Assignment) {
    setDraft({
      id: a.id,
      title: a.title,
      type: a.type as AuthorType,
      dueAt: a.dueAt ? a.dueAt.slice(0, 10) : "",
      points: a.points,
      description: a.description,
      groupId: a.groupId ?? "",
    });
    setOpen(true);
  }

  async function save() {
    if (!draft.title.trim()) return;
    const dueAt = draft.dueAt
      ? new Date(draft.dueAt + "T23:59:00Z").toISOString()
      : new Date().toISOString();
    const input = {
      title: draft.title.trim(),
      type: draft.type,
      dueAt,
      points: draft.points,
      description: draft.description,
      groupId: draft.groupId || undefined,
    };

    // Publish to the shared table when signed in; a refused write (not a
    // teaching account) falls back to this device with a note.
    const isRemoteRow = Boolean(draft.id && remote?.some((a) => a.id === draft.id));
    if (remote !== null && signedIn) {
      if (isRemoteRow) {
        if (await updateRemoteAssignment(draft.id!, input)) {
          setRemote((prev) =>
            (prev ?? []).map((a) => (a.id === draft.id ? { ...a, ...input } : a)),
          );
          setOpen(false);
          return;
        }
      } else if (!draft.id) {
        const created = await addRemoteAssignment(course.id, input);
        if (created) {
          setRemote((prev) => [...(prev ?? []), created]);
          setOpen(false);
          return;
        }
      }
      setPubNote(
        "Couldn't publish to all students (teaching account required) — saved on this device instead.",
      );
    }
    if (isRemoteRow) return; // don't shadow a published assignment locally

    if (draft.id) {
      authored.update(draft.id, input);
    } else {
      const assignment: Assignment = {
        id: newId(),
        courseId: course.id,
        status: "not_started",
        ...input,
      };
      authored.add(assignment);
    }
    setOpen(false);
  }

  async function removeRow(a: Assignment, source: Source) {
    if (source === "remote") {
      if (await removeRemoteAssignment(a.id)) {
        setRemote((prev) => (prev ?? []).filter((x) => x.id !== a.id));
      }
      return;
    }
    authored.remove(a.id);
  }

  return (
    <>
      <PageHeader
        title="Assignments"
        subtitle={`${rows.length} assignments · ${totalPoints} points total`}
        action={
          teaching ? (
            <div className="flex items-center gap-2">
              {signedIn && remote !== null && (
                <Button variant="outline" onClick={() => setManageOpen(true)}>
                  Manage groups
                </Button>
              )}
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" /> Assignment
              </Button>
            </div>
          ) : undefined
        }
      />

      {pubNote && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          {pubNote}
        </p>
      )}

      <div className="card divide-y divide-black/5">
        {rows.map(({ a, source }) => {
          const Icon = itemIcon[a.type];
          const status = effectiveStatus(a);
          const badge = statusBadge[status];
          const sub = submissionFor(a.id);
          return (
            <div
              key={a.id}
              className="flex items-start gap-3 p-4 hover:bg-surface-subtle"
            >
              <span
                className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white"
                style={{ backgroundColor: course.color }}
              >
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium text-ink">{a.title}</h3>
                  <Badge tone={badge.tone}>{badge.label}</Badge>
                  {groupName(a.groupId) && (
                    <Badge tone="neutral">{groupName(a.groupId)}</Badge>
                  )}
                  {source === "local" && <Badge tone="brand">Added by you</Badge>}
                  {source === "remote" && <Badge tone="success">Published</Badge>}
                </div>
                <p className="mt-0.5 text-sm text-ink-muted">{a.description}</p>
                <p className="mt-1 text-xs text-ink-faint">
                  Due {formatDateTime(a.dueAt)} · {a.points} pts
                  {sub && (
                    <span className="text-emerald-600">
                      {" "}
                      · Submitted {relativeTime(sub.submittedAt)}
                      {sub.fileName ? (
                        sub.filePath ? (
                          <>
                            {" · "}
                            <button
                              type="button"
                              onClick={() => openAttachment(sub.filePath!)}
                              className="focus-ring inline underline underline-offset-2 hover:text-emerald-700"
                            >
                              {sub.fileName}
                            </button>
                          </>
                        ) : (
                          ` · ${sub.fileName}`
                        )
                      ) : (
                        ""
                      )}
                    </span>
                  )}
                </p>
                {(rubrics[a.id]?.length ?? 0) > 0 && (
                  <p className="mt-1 text-xs text-ink-faint">
                    Rubric · {rubrics[a.id]!.length} criteria
                  </p>
                )}
                {a.type === "quiz" && (questions[a.id]?.length ?? 0) > 0 && (
                  <p className="mt-1 text-xs text-ink-faint">
                    Quiz · {questions[a.id]!.length} questions
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {(() => {
                  const remoteScore = remote?.some((x) => x.id === a.id)
                    ? mySubs[a.id]?.score
                    : undefined;
                  const score = remoteScore ?? a.score;
                  return status === "graded" && score != null ? (
                    <p className="text-lg font-bold text-ink">
                      {score}
                      <span className="text-sm font-normal text-ink-faint">
                        /{a.points}
                      </span>
                    </p>
                  ) : (
                    <p className="text-sm text-ink-faint">—/{a.points}</p>
                  );
                })()}
                {!teaching &&
                  (isTakeableQuiz(a) ? (
                    attempts[a.id] ? (
                      <button
                        type="button"
                        onClick={() => openReviewQuiz(a)}
                        className="focus-ring rounded-md px-2 py-1 text-sm font-medium text-brand-600 hover:text-brand-700"
                      >
                        Review quiz
                      </button>
                    ) : (
                      <Button size="sm" onClick={() => openTakeQuiz(a)}>
                        Take quiz
                      </Button>
                    )
                  ) : (
                    status !== "graded" && (
                      <Button
                        size="sm"
                        variant={sub ? "outline" : "primary"}
                        onClick={() => openSubmit(a)}
                      >
                        {sub ? "Resubmit" : "Submit"}
                      </Button>
                    )
                  ))}
                {teaching &&
                  (source === "local" || (source === "remote" && signedIn)) && (
                  <div className="flex gap-1">
                    {source === "remote" && a.type === "quiz" && (
                      <button
                        onClick={() => setQuizFor(a)}
                        className="focus-ring rounded-md p-1.5 text-ink-faint hover:bg-surface-sunken hover:text-ink"
                        aria-label="Manage quiz questions"
                      >
                        <HelpCircle className="h-4 w-4" />
                      </button>
                    )}
                    {source === "remote" && (
                      <button
                        onClick={() => setRubricFor(a)}
                        className="focus-ring rounded-md p-1.5 text-ink-faint hover:bg-surface-sunken hover:text-ink"
                        aria-label="Manage rubric"
                      >
                        <ListChecks className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => openEdit(a)}
                      className="focus-ring rounded-md p-1.5 text-ink-faint hover:bg-surface-sunken hover:text-ink"
                      aria-label="Edit assignment"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => removeRow(a, source)}
                      className="focus-ring rounded-md p-1.5 text-ink-faint hover:bg-rose-50 hover:text-rose-600"
                      aria-label="Delete assignment"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={draft.id ? "Edit assignment" : "New assignment"}
        description="Visible to students enrolled in this course."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!draft.title.trim()}>
              {draft.id ? "Save changes" : "Create assignment"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Title *">
            <Input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="e.g. Project 2 · Data structures"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <Select
                value={draft.type}
                onChange={(e) =>
                  setDraft({ ...draft, type: e.target.value as AuthorType })
                }
              >
                <option value="assignment">Assignment</option>
                <option value="quiz">Quiz</option>
                <option value="discussion">Discussion</option>
              </Select>
            </Field>
            <Field label="Points">
              <Input
                type="number"
                value={draft.points}
                onChange={(e) =>
                  setDraft({ ...draft, points: Number(e.target.value) || 0 })
                }
              />
            </Field>
          </div>
          <Field label="Due date">
            <Input
              type="date"
              value={draft.dueAt}
              onChange={(e) => setDraft({ ...draft, dueAt: e.target.value })}
            />
          </Field>
          {groups.length > 0 && (
            <Field label="Group">
              <Select
                value={draft.groupId}
                onChange={(e) => setDraft({ ...draft, groupId: e.target.value })}
              >
                <option value="">No group</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="block text-xs font-medium uppercase tracking-wide text-ink-faint">
                Description
              </span>
              <button
                type="button"
                onClick={draftWithMo}
                disabled={!draft.title.trim() || aiBusy}
                title={
                  draft.title.trim()
                    ? "Let Mo draft the description from the title"
                    : "Give the assignment a title first"
                }
                className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300"
              >
                <MoMarkIcon className="h-3 w-auto" />
                {aiBusy ? "Drafting…" : "Draft with Mo"}
              </button>
            </div>
            {aiNote && <p className="mb-1 text-xs text-rose-600">{aiNote}</p>}
            <Textarea
              value={draft.description}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
              placeholder="Instructions for students…"
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={submitFor !== null}
        onClose={resetSubmit}
        title={`Submit · ${submitFor?.title ?? ""}`}
        description={
          submitFor
            ? `Due ${formatDateTime(submitFor.dueAt)} · ${submitFor.points} pts`
            : undefined
        }
        footer={
          <>
            <Button variant="ghost" onClick={resetSubmit}>
              Cancel
            </Button>
            <Button
              onClick={submitWork}
              disabled={!subBody.trim() && !subFile}
            >
              <Send className="h-4 w-4" /> Turn in
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Your response">
            <Textarea
              value={subBody}
              onChange={(e) => setSubBody(e.target.value)}
              placeholder="Type your submission, paste a link, or attach a file below…"
              className="min-h-[120px]"
            />
          </Field>
          <div>
            <label className="focus-ring inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-black/15 px-3 py-2 text-sm text-ink-muted hover:bg-surface-subtle">
              <Upload className="h-4 w-4" />
              Attach a file
              <input
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setSubFileObj(file);
                  setSubFile(file?.name);
                }}
              />
            </label>
            {subFile && (
              <p className="mt-1.5 flex items-center gap-1 text-xs text-ink-faint">
                <Paperclip className="h-3 w-3" />
                {subFile}
              </p>
            )}
          </div>
          <p className="text-xs text-ink-faint">
            {submitFor && remote?.some((a) => a.id === submitFor.id) && signedIn
              ? "This goes to your instructor and updates the status to “Submitted”."
              : "Demo submission — your work is saved in this browser and the status updates to “Submitted”."}
          </p>
        </div>
      </Modal>

      <Modal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        title="Assignment groups"
        description="Weight each group so grades count proportionally (Canvas-style)."
        footer={
          <Button onClick={() => setManageOpen(false)}>Done</Button>
        }
      >
        <div className="space-y-4">
          {groups.length === 0 && (
            <p className="text-sm text-ink-faint">
              No groups yet — add one below to start weighting grades.
            </p>
          )}
          {groups.map((g) => (
            <div key={g.id} className="flex items-end gap-2">
              <Field label="Name" className="flex-1">
                <Input
                  value={g.name}
                  onChange={(e) =>
                    setGroups((prev) =>
                      prev.map((x) =>
                        x.id === g.id ? { ...x, name: e.target.value } : x,
                      ),
                    )
                  }
                  onBlur={() => persistGroup(g.id, { name: g.name.trim() })}
                />
              </Field>
              <Field label="Weight %" className="w-24">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={g.weight}
                  onChange={(e) => {
                    const weight = Math.max(
                      0,
                      Math.min(100, Number(e.target.value) || 0),
                    );
                    setGroups((prev) =>
                      prev.map((x) =>
                        x.id === g.id ? { ...x, weight } : x,
                      ),
                    );
                  }}
                  onBlur={() => persistGroup(g.id, { weight: g.weight })}
                />
              </Field>
              <button
                type="button"
                onClick={() => deleteGroup(g.id)}
                className="focus-ring mb-1 rounded-md p-2 text-ink-faint hover:bg-rose-50 hover:text-rose-600"
                aria-label={`Delete ${g.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}

          <div className="flex items-end gap-2 border-t border-black/5 pt-4">
            <Field label="Add group" className="flex-1">
              <Input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="e.g. Homework"
              />
            </Field>
            <Field label="Weight %" className="w-24">
              <Input
                type="number"
                min={0}
                max={100}
                value={newGroupWeight}
                onChange={(e) =>
                  setNewGroupWeight(
                    Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                  )
                }
              />
            </Field>
            <Button
              className="mb-0.5"
              onClick={addGroup}
              disabled={!newGroupName.trim()}
            >
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>

          <p className="text-xs text-ink-faint">
            Weights total {weightSum}%.
            {weightSum !== 100 && (
              <span className="text-amber-700 dark:text-amber-400">
                {" "}
                Canvas normalizes when this isn&apos;t 100% — ungrouped work
                fills any remainder.
              </span>
            )}
          </p>
        </div>
      </Modal>

      <Modal
        open={rubricFor !== null}
        onClose={() => setRubricFor(null)}
        title={`Rubric · ${rubricFor?.title ?? ""}`}
        description="Break the grade into criteria students see alongside their score."
        footer={<Button onClick={() => setRubricFor(null)}>Done</Button>}
      >
        <div className="space-y-4">
          {rubricList.length === 0 && (
            <p className="text-sm text-ink-faint">
              No criteria yet — add one below to build the rubric.
            </p>
          )}
          {rubricList.map((c) => (
            <div key={c.id} className="flex items-end gap-2">
              <Field label="Criterion" className="flex-1">
                <Input
                  value={c.description}
                  onChange={(e) =>
                    setRubrics((prev) => ({
                      ...prev,
                      [c.assignmentId]: (prev[c.assignmentId] ?? []).map((x) =>
                        x.id === c.id
                          ? { ...x, description: e.target.value }
                          : x,
                      ),
                    }))
                  }
                  onBlur={() =>
                    persistCriterion(c.id, { description: c.description.trim() })
                  }
                />
              </Field>
              <Field label="Points" className="w-24">
                <Input
                  type="number"
                  min={0}
                  value={c.points}
                  onChange={(e) => {
                    const points = Math.max(0, Number(e.target.value) || 0);
                    setRubrics((prev) => ({
                      ...prev,
                      [c.assignmentId]: (prev[c.assignmentId] ?? []).map((x) =>
                        x.id === c.id ? { ...x, points } : x,
                      ),
                    }));
                  }}
                  onBlur={() => persistCriterion(c.id, { points: c.points })}
                />
              </Field>
              <button
                type="button"
                onClick={() => deleteCriterion(c.id)}
                className="focus-ring mb-1 rounded-md p-2 text-ink-faint hover:bg-rose-50 hover:text-rose-600"
                aria-label="Delete criterion"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}

          <div className="flex items-end gap-2 border-t border-black/5 pt-4">
            <Field label="Add criterion" className="flex-1">
              <Input
                value={newCritDesc}
                onChange={(e) => setNewCritDesc(e.target.value)}
                placeholder="e.g. Clarity of argument"
              />
            </Field>
            <Field label="Points" className="w-24">
              <Input
                type="number"
                min={0}
                value={newCritPoints}
                onChange={(e) =>
                  setNewCritPoints(Math.max(0, Number(e.target.value) || 0))
                }
              />
            </Field>
            <Button
              className="mb-0.5"
              onClick={addCriterion}
              disabled={!newCritDesc.trim()}
            >
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>

          <p className="text-xs text-ink-faint">
            Rubric total: {rubricTotal} pts (assignment is worth{" "}
            {rubricFor?.points ?? 0}).
            {rubricFor && rubricTotal !== rubricFor.points && (
              <span className="text-amber-700 dark:text-amber-400">
                {" "}
                These differ — criteria don&apos;t have to sum to the assignment
                points, but they usually do.
              </span>
            )}
          </p>
        </div>
      </Modal>

      <Modal
        open={quizFor !== null}
        onClose={() => {
          setQuizFor(null);
          resetQuizForm();
          resetImport();
        }}
        title={`Quiz questions · ${quizFor?.title ?? ""}`}
        description="Author multiple-choice questions. Students take one auto-graded attempt."
        footer={
          importOpen ? (
            <>
              <Button variant="ghost" onClick={resetImport}>
                Back
              </Button>
              <Button
                onClick={runImport}
                disabled={importChecked.size === 0 || importBusy}
              >
                {importBusy
                  ? "Importing…"
                  : `Import${importChecked.size ? ` ${importChecked.size}` : ""} selected`}
              </Button>
            </>
          ) : (
            <Button
              onClick={() => {
                setQuizFor(null);
                resetQuizForm();
                resetImport();
              }}
            >
              Done
            </Button>
          )
        }
      >
        {importOpen ? (
          <div className="space-y-4">
            {!importSel ? (
              <>
                <p className="text-sm text-ink-muted">
                  Copy questions from another quiz you teach — the answer keys
                  come with them.
                </p>
                {importLoading && (
                  <p className="text-sm text-ink-faint">Finding your quizzes…</p>
                )}
                {!importLoading && (importSources?.length ?? 0) === 0 && (
                  <p className="text-sm text-ink-faint">
                    No other quizzes with questions were found.
                  </p>
                )}
                <div className="space-y-1.5">
                  {(importSources ?? []).map((src) => (
                    <button
                      key={src.assignmentId}
                      type="button"
                      onClick={() => selectSource(src)}
                      className="focus-ring flex w-full items-center justify-between rounded-lg border border-black/5 px-3 py-2 text-left text-sm hover:bg-surface-subtle"
                    >
                      <span className="min-w-0 flex-1 truncate text-ink">
                        {src.title}
                      </span>
                      <span className="ml-2 shrink-0 text-xs text-ink-faint">
                        {src.count} question{src.count === 1 ? "" : "s"}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setImportSel(null)}
                    className="focus-ring text-sm text-brand-600 hover:text-brand-700"
                  >
                    ← All quizzes
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setImportChecked(
                        allImportChecked
                          ? new Set()
                          : new Set(importQuestions.map((q) => q.id)),
                      )
                    }
                    disabled={importQuestions.length === 0}
                    className="focus-ring text-xs text-brand-600 hover:text-brand-700 disabled:opacity-50"
                  >
                    {allImportChecked ? "Clear all" : "Select all"}
                  </button>
                </div>
                <p className="text-sm font-medium text-ink">{importSel.title}</p>
                {importQuestions.length === 0 && (
                  <p className="text-sm text-ink-faint">Loading questions…</p>
                )}
                <div className="space-y-1.5">
                  {importQuestions.map((q) => (
                    <label
                      key={q.id}
                      className="flex items-start gap-2 rounded-lg border border-black/5 px-3 py-2 text-sm text-ink"
                    >
                      <input
                        type="checkbox"
                        className="focus-ring mt-0.5"
                        checked={importChecked.has(q.id)}
                        onChange={() =>
                          setImportChecked((prev) => {
                            const next = new Set(prev);
                            if (next.has(q.id)) next.delete(q.id);
                            else next.add(q.id);
                            return next;
                          })
                        }
                      />
                      <span className="min-w-0 flex-1">
                        {q.prompt}
                        <span className="ml-1 text-ink-faint">
                          ({q.points} pts)
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={openImport}>
              <Upload className="h-4 w-4" /> Import from another quiz
            </Button>
          </div>
          {keysUnavailable && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              Answer keys are unavailable — the correct answer can&apos;t be
              shown or changed here.
            </p>
          )}
          {quizList.length === 0 && (
            <p className="text-sm text-ink-faint">
              No questions yet — add one below to build the quiz.
            </p>
          )}
          {quizList.map((q, qi) => (
            <div
              key={q.id}
              className="space-y-3 rounded-lg border border-black/5 p-3"
            >
              <div className="flex items-start gap-2">
                <Field label={`Question ${qi + 1}`} className="flex-1">
                  <Textarea
                    value={q.prompt}
                    onChange={(e) =>
                      setQuestions((prev) => ({
                        ...prev,
                        [q.assignmentId]: (prev[q.assignmentId] ?? []).map((x) =>
                          x.id === q.id ? { ...x, prompt: e.target.value } : x,
                        ),
                      }))
                    }
                    onBlur={() =>
                      persistQuestion(q.id, { prompt: q.prompt.trim() })
                    }
                    className="min-h-[60px]"
                  />
                </Field>
                <Field label="Points" className="w-20">
                  <Input
                    type="number"
                    min={1}
                    value={q.points}
                    onChange={(e) => {
                      const points = Math.max(1, Number(e.target.value) || 1);
                      setQuestions((prev) => ({
                        ...prev,
                        [q.assignmentId]: (prev[q.assignmentId] ?? []).map((x) =>
                          x.id === q.id ? { ...x, points } : x,
                        ),
                      }));
                    }}
                    onBlur={() => persistQuestion(q.id, { points: q.points })}
                  />
                </Field>
                <button
                  type="button"
                  onClick={() => deleteQuestion(q.id)}
                  className="focus-ring mt-6 rounded-md p-2 text-ink-faint hover:bg-rose-50 hover:text-rose-600"
                  aria-label="Delete question"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-1.5">
                {q.options.map((opt, oi) => (
                  <label
                    key={oi}
                    className="flex items-center gap-2 text-sm text-ink"
                  >
                    <input
                      type="radio"
                      name={`correct-${q.id}`}
                      className="focus-ring"
                      checked={!keysUnavailable && answerKeys?.[q.id] === oi}
                      disabled={keysUnavailable}
                      onChange={() => setCorrect(q.id, oi)}
                    />
                    <Input
                      value={opt}
                      onChange={(e) =>
                        setQuestions((prev) => ({
                          ...prev,
                          [q.assignmentId]: (prev[q.assignmentId] ?? []).map(
                            (x) =>
                              x.id === q.id
                                ? {
                                    ...x,
                                    options: x.options.map((o, i) =>
                                      i === oi ? e.target.value : o,
                                    ),
                                  }
                                : x,
                          ),
                        }))
                      }
                      onBlur={() =>
                        persistQuestion(q.id, {
                          options: q.options.map((o) => o.trim()),
                        })
                      }
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}

          <div className="space-y-3 border-t border-black/5 pt-4">
            <Field label="Add question">
              <Textarea
                value={newQPrompt}
                onChange={(e) => setNewQPrompt(e.target.value)}
                placeholder="e.g. What is the derivative of x²?"
                className="min-h-[60px]"
              />
            </Field>
            <div className="space-y-1.5">
              {newQOptions.map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="new-correct"
                    className="focus-ring"
                    checked={newQCorrect === oi}
                    onChange={() => setNewQCorrect(oi)}
                    aria-label={`Mark option ${oi + 1} correct`}
                  />
                  <Input
                    value={opt}
                    onChange={(e) =>
                      setNewQOptions((prev) =>
                        prev.map((o, i) => (i === oi ? e.target.value : o)),
                      )
                    }
                    placeholder={`Option ${oi + 1}`}
                    className="flex-1"
                  />
                  {newQOptions.length > 2 && (
                    <button
                      type="button"
                      onClick={() => {
                        setNewQOptions((prev) =>
                          prev.filter((_, i) => i !== oi),
                        );
                        // Keep the correct marker valid after removal.
                        setNewQCorrect((c) =>
                          oi < c ? c - 1 : Math.min(c, newQOptions.length - 2),
                        );
                      }}
                      className="focus-ring rounded-md p-1.5 text-ink-faint hover:bg-rose-50 hover:text-rose-600"
                      aria-label={`Remove option ${oi + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-end gap-2">
              {newQOptions.length < 6 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNewQOptions((prev) => [...prev, ""])}
                >
                  <Plus className="h-4 w-4" /> Option
                </Button>
              )}
              <Field label="Points" className="w-20">
                <Input
                  type="number"
                  min={1}
                  value={newQPoints}
                  onChange={(e) =>
                    setNewQPoints(Math.max(1, Number(e.target.value) || 1))
                  }
                />
              </Field>
              <Button
                className="mb-0.5"
                onClick={addQuestion}
                disabled={
                  !newQPrompt.trim() ||
                  newQOptions.some((o) => !o.trim())
                }
              >
                <Plus className="h-4 w-4" /> Add question
              </Button>
            </div>
          </div>

          <p className="text-xs text-ink-faint">
            {quizList.length} questions · {quizTotal} pts total · auto-graded out
            of {quizFor?.points ?? 0}.
          </p>
        </div>
        )}
      </Modal>

      <Modal
        open={takeFor !== null}
        onClose={resetTake}
        title={`${takeReview ? "Review" : "Quiz"} · ${takeFor?.title ?? ""}`}
        description={
          takeFor
            ? `${takeQuestions.length} questions · ${takeFor.points} pts`
            : undefined
        }
        footer={
          takeResult || takeReview ? (
            <Button onClick={resetTake}>Done</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={resetTake}>
                Cancel
              </Button>
              <Button onClick={submitQuiz} disabled={takeBusy}>
                <Send className="h-4 w-4" />
                {takeBusy
                  ? "Submitting…"
                  : takeUnanswered > 0
                    ? `Submit with ${takeUnanswered} unanswered`
                    : "Submit quiz"}
              </Button>
            </>
          )
        }
      >
        <div className="space-y-5">
          {takeResult && (
            <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
              Score: {takeResult.earned}/{takeResult.total} ·{" "}
              {takeResult.score}/{takeResult.points} pts
            </div>
          )}
          {takeReview && (
            <p className="text-xs text-ink-faint">
              Answer key isn&apos;t shown after submission.
            </p>
          )}
          {takeQuestions.map((q, qi) => {
            const chosen = takeAnswers[q.id];
            const isCorrect = correctSet?.has(q.id);
            const locked = takeResult !== null || takeReview;
            return (
              <div
                key={q.id}
                className="space-y-2 rounded-lg border border-black/5 p-3"
              >
                <div className="flex items-start gap-2">
                  {takeResult &&
                    (isCorrect ? (
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <X className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                    ))}
                  <p className="flex-1 text-sm font-medium text-ink">
                    {qi + 1}. {q.prompt}
                    <span className="ml-1 font-normal text-ink-faint">
                      ({q.points} pts)
                    </span>
                  </p>
                </div>
                <div className="space-y-1.5">
                  {q.options.map((opt, oi) => {
                    const picked = chosen === oi;
                    return (
                      <label
                        key={oi}
                        className={`flex items-center gap-2 rounded-md px-2 py-1 text-sm ${
                          picked
                            ? "bg-brand-50 text-ink dark:bg-brand-500/10"
                            : "text-ink-muted"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`take-${q.id}`}
                          className="focus-ring"
                          checked={picked}
                          disabled={locked}
                          onChange={() =>
                            setTakeAnswers((prev) => ({ ...prev, [q.id]: oi }))
                          }
                        />
                        {opt}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {!takeResult && !takeReview && (
            <p className="text-xs text-ink-faint">
              {takeUnanswered > 0
                ? `${takeUnanswered} of ${takeQuestions.length} unanswered.`
                : "All questions answered."}{" "}
              You get one attempt — it&apos;s graded automatically.
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
