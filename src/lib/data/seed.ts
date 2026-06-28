import type {
  Announcement,
  Assignment,
  ActivityEvent,
  CalendarEvent,
  Course,
  CourseModule,
  User,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Bundled seed data. The app is fully usable on this data alone, so it runs
// with zero configuration. When Supabase env vars are present the data layer
// transparently switches to the live backend (see lib/data/index.ts).
// ---------------------------------------------------------------------------

export const currentUser: User = {
  id: "u_morgan",
  name: "Morgan Sefako",
  email: "morgan.sefako@moacademy.edu",
  role: "student",
  avatarColor: "#5d3fea",
  initials: "MS",
};

export const courses: Course[] = [
  {
    id: "c_cs101",
    code: "CS-101",
    name: "Introduction to Computer Science",
    shortName: "Intro to CS",
    term: "Fall 2026",
    description:
      "Foundations of computing: problem solving, algorithms, and your first programs in Python.",
    color: "#5d3fea",
    instructor: "Dr. Lerato Khumalo",
    credits: 4,
    published: true,
    progress: 62,
  },
  {
    id: "c_math210",
    code: "MATH-210",
    name: "Linear Algebra",
    shortName: "Linear Algebra",
    term: "Fall 2026",
    description:
      "Vectors, matrices, linear transformations, and their applications to data and graphics.",
    color: "#0ea5e9",
    instructor: "Prof. Daniel Okafor",
    credits: 3,
    published: true,
    progress: 41,
  },
  {
    id: "c_eng150",
    code: "ENG-150",
    name: "Academic Writing & Rhetoric",
    shortName: "Academic Writing",
    term: "Fall 2026",
    description:
      "Develop clear, persuasive academic prose through drafting, peer review, and revision.",
    color: "#e11d48",
    instructor: "Dr. Amara Botha",
    credits: 3,
    published: true,
    progress: 78,
  },
  {
    id: "c_bio120",
    code: "BIO-120",
    name: "Cell Biology",
    shortName: "Cell Biology",
    term: "Fall 2026",
    description:
      "Structure and function of cells, from membranes and organelles to signaling and division.",
    color: "#10b6a3",
    instructor: "Prof. Naledi Mokoena",
    credits: 4,
    published: true,
    progress: 28,
  },
  {
    id: "c_hist101",
    code: "HIST-101",
    name: "World History Since 1500",
    shortName: "World History",
    term: "Fall 2026",
    description:
      "Global connections, empires, revolutions, and the making of the modern world.",
    color: "#f59e0b",
    instructor: "Dr. Sipho Dlamini",
    credits: 3,
    published: false,
    progress: 12,
  },
];

export const modules: CourseModule[] = [
  {
    id: "m_cs101_1",
    courseId: "c_cs101",
    title: "Module 1 · Getting Started",
    published: true,
    items: [
      { id: "mi_1", title: "Welcome & Syllabus", type: "page", completed: true, durationMin: 10 },
      { id: "mi_2", title: "Setting Up Python", type: "page", completed: true, durationMin: 20 },
      { id: "mi_3", title: "Lecture: What is Computation?", type: "video", completed: true, durationMin: 45 },
      { id: "mi_4", title: "Quiz 1 · Vocabulary", type: "quiz", dueAt: "2026-06-30T23:59:00Z", durationMin: 15 },
    ],
  },
  {
    id: "m_cs101_2",
    courseId: "c_cs101",
    title: "Module 2 · Variables & Control Flow",
    published: true,
    items: [
      { id: "mi_5", title: "Reading: Data Types", type: "page", completed: true, durationMin: 25 },
      { id: "mi_6", title: "Lab: Conditionals", type: "assignment", dueAt: "2026-07-02T23:59:00Z", durationMin: 60 },
      { id: "mi_7", title: "Discussion: When do loops help?", type: "discussion", dueAt: "2026-07-03T23:59:00Z", durationMin: 30 },
    ],
  },
  {
    id: "m_cs101_3",
    courseId: "c_cs101",
    title: "Module 3 · Functions",
    published: false,
    items: [
      { id: "mi_8", title: "Reading: Defining Functions", type: "page", durationMin: 25 },
      { id: "mi_9", title: "Project 1 · Text Adventure", type: "assignment", dueAt: "2026-07-12T23:59:00Z", durationMin: 180 },
    ],
  },
  {
    id: "m_math210_1",
    courseId: "c_math210",
    title: "Unit 1 · Systems of Equations",
    published: true,
    items: [
      { id: "mi_10", title: "Gaussian Elimination", type: "video", completed: true, durationMin: 40 },
      { id: "mi_11", title: "Problem Set 1", type: "assignment", dueAt: "2026-07-01T23:59:00Z", durationMin: 90 },
    ],
  },
  {
    id: "m_eng150_1",
    courseId: "c_eng150",
    title: "Week 4 · The Argumentative Essay",
    published: true,
    items: [
      { id: "mi_12", title: "Reading: Claims & Evidence", type: "page", completed: true, durationMin: 30 },
      { id: "mi_13", title: "Essay 2 · First Draft", type: "assignment", dueAt: "2026-06-29T23:59:00Z", durationMin: 120 },
      { id: "mi_14", title: "Peer Review Workshop", type: "discussion", dueAt: "2026-07-01T23:59:00Z", durationMin: 45 },
    ],
  },
];

export const assignments: Assignment[] = [
  {
    id: "a_eng2",
    courseId: "c_eng150",
    title: "Essay 2 · First Draft",
    type: "assignment",
    dueAt: "2026-06-29T23:59:00Z",
    points: 100,
    status: "in_progress",
    description:
      "Submit a 1,200-word first draft of your argumentative essay. Bring two peer-review-ready copies.",
  },
  {
    id: "a_math_ps1",
    courseId: "c_math210",
    title: "Problem Set 1",
    type: "assignment",
    dueAt: "2026-07-01T23:59:00Z",
    points: 50,
    status: "not_started",
    description: "Exercises 1.1–1.4. Show all row operations.",
  },
  {
    id: "a_cs_quiz1",
    courseId: "c_cs101",
    title: "Quiz 1 · Vocabulary",
    type: "quiz",
    dueAt: "2026-06-30T23:59:00Z",
    points: 20,
    status: "not_started",
    description: "Ten questions covering Module 1 terminology. One attempt, 15 minutes.",
  },
  {
    id: "a_cs_lab2",
    courseId: "c_cs101",
    title: "Lab: Conditionals",
    type: "assignment",
    dueAt: "2026-07-02T23:59:00Z",
    points: 30,
    status: "not_started",
    description: "Implement a grade calculator using if/elif/else.",
  },
  {
    id: "a_bio_lab1",
    courseId: "c_bio120",
    title: "Lab Report · Microscopy",
    type: "assignment",
    dueAt: "2026-06-27T23:59:00Z",
    points: 40,
    status: "missing",
    description: "Document your observations of onion epidermal cells.",
  },
  {
    id: "a_cs_hw1",
    courseId: "c_cs101",
    title: "Homework 1 · Expressions",
    type: "assignment",
    dueAt: "2026-06-20T23:59:00Z",
    points: 25,
    status: "graded",
    score: 23,
    description: "Evaluate and write arithmetic and boolean expressions.",
  },
  {
    id: "a_eng1",
    courseId: "c_eng150",
    title: "Essay 1 · Narrative",
    type: "assignment",
    dueAt: "2026-06-15T23:59:00Z",
    points: 100,
    status: "graded",
    score: 92,
    description: "A 900-word personal narrative.",
  },
  {
    id: "a_math_quiz1",
    courseId: "c_math210",
    title: "Quiz · Vectors",
    type: "quiz",
    dueAt: "2026-06-18T23:59:00Z",
    points: 20,
    status: "graded",
    score: 17,
    description: "Dot products and projections.",
  },
];

export const announcements: Announcement[] = [
  {
    id: "an_1",
    courseId: "c_cs101",
    title: "Office hours moved to Thursday",
    author: "Dr. Lerato Khumalo",
    postedAt: "2026-06-26T14:00:00Z",
    body: "This week only, office hours move to Thursday 2–4pm in the Lab Annex. Bring questions on functions!",
  },
  {
    id: "an_2",
    courseId: "c_eng150",
    title: "Peer review pairs posted",
    author: "Dr. Amara Botha",
    postedAt: "2026-06-25T09:30:00Z",
    body: "Your peer-review partner for Essay 2 is listed under People. Exchange drafts by Monday morning.",
  },
  {
    id: "an_3",
    courseId: "c_math210",
    title: "Problem Set 1 hint",
    author: "Prof. Daniel Okafor",
    postedAt: "2026-06-24T17:15:00Z",
    body: "For 1.3, reduce to row-echelon form first — the back-substitution is much cleaner that way.",
  },
];

export const activity: ActivityEvent[] = [
  {
    id: "ev_1",
    kind: "grade",
    courseId: "c_eng150",
    title: "Essay 1 · Narrative graded",
    detail: "You scored 92/100 — great work on the opening.",
    at: "2026-06-27T16:20:00Z",
  },
  {
    id: "ev_2",
    kind: "announcement",
    courseId: "c_cs101",
    title: "Office hours moved to Thursday",
    detail: "Dr. Lerato Khumalo posted an announcement.",
    at: "2026-06-26T14:00:00Z",
  },
  {
    id: "ev_3",
    kind: "due_soon",
    courseId: "c_eng150",
    title: "Essay 2 · First Draft due tomorrow",
    detail: "Due Mon, Jun 29 at 11:59 PM.",
    at: "2026-06-28T08:00:00Z",
  },
  {
    id: "ev_4",
    kind: "grade",
    courseId: "c_math210",
    title: "Quiz · Vectors graded",
    detail: "You scored 17/20.",
    at: "2026-06-25T11:05:00Z",
  },
  {
    id: "ev_5",
    kind: "comment",
    courseId: "c_cs101",
    title: "New reply in 'When do loops help?'",
    detail: "Thabo replied to your discussion post.",
    at: "2026-06-24T19:42:00Z",
  },
];

export const calendar: CalendarEvent[] = [
  { id: "ca_1", courseId: "c_bio120", title: "Lab Report · Microscopy", at: "2026-06-27T23:59:00Z", type: "assignment" },
  { id: "ca_2", courseId: "c_eng150", title: "Essay 2 · First Draft", at: "2026-06-29T23:59:00Z", type: "assignment" },
  { id: "ca_3", courseId: "c_cs101", title: "Quiz 1 · Vocabulary", at: "2026-06-30T23:59:00Z", type: "quiz" },
  { id: "ca_4", courseId: "c_math210", title: "Problem Set 1", at: "2026-07-01T23:59:00Z", type: "assignment" },
  { id: "ca_5", courseId: "c_cs101", title: "Lab: Conditionals", at: "2026-07-02T23:59:00Z", type: "assignment" },
  { id: "ca_6", courseId: "c_cs101", title: "Office Hours (Dr. Khumalo)", at: "2026-07-02T14:00:00Z", type: "office_hours" },
];
