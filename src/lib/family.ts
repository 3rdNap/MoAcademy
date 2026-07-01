// Demo children for the Parent/Family dashboard. In a live deployment these come
// from guardian↔student links in the database; here they reuse the seed academic
// data with a per-child grade offset so each child reads differently.

export interface Child {
  id: string;
  name: string;
  grade: string;
  avatarColor: string;
  /** Points added to computed percentages, so siblings differ. */
  gradeDelta: number;
}

export const children: Child[] = [
  {
    id: "ch_lerato",
    name: "Lerato Dlamini",
    grade: "Grade 11",
    avatarColor: "#5d3fea",
    gradeDelta: 0,
  },
  {
    id: "ch_kabelo",
    name: "Kabelo Dlamini",
    grade: "Grade 9",
    avatarColor: "#10b6a3",
    gradeDelta: -8,
  },
];
