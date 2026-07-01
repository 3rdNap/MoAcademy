// Study guide library model. Guides are user-owned and editable; each has a PDF
// (uploaded as a data URL or linked) and a thumbnail image. In production these
// files live in Supabase Storage (see supabase/migrations/0005_study_guides.sql);
// here they persist in the browser.

export interface StudyGuide {
  id: string;
  title: string;
  subject: string;
  description: string;
  /** External link to the PDF. */
  pdfUrl?: string;
  pdfFileName?: string;
  /** Data URL of a small uploaded PDF. */
  pdfData?: string;
  /** External thumbnail image URL. */
  thumbUrl?: string;
  /** Data URL of an uploaded thumbnail image. */
  thumbData?: string;
  createdAt: string;
}

export const seedGuides: StudyGuide[] = [
  {
    id: "sg_calc",
    title: "Calculus Cheat Sheet",
    subject: "Mathematics",
    description:
      "Derivatives, integrals and the key identities you need, condensed onto two pages.",
    createdAt: "2026-06-20T10:00:00Z",
  },
  {
    id: "sg_cell",
    title: "Cell Biology Summary",
    subject: "Life Sciences",
    description:
      "Organelles, the cell cycle and membrane transport summarised with diagrams.",
    createdAt: "2026-06-22T10:00:00Z",
  },
  {
    id: "sg_essay",
    title: "Essay Structure Guide",
    subject: "Academic Writing",
    description:
      "Thesis, topic sentences, evidence and signposting — a template for argumentative essays.",
    createdAt: "2026-06-24T10:00:00Z",
  },
];
