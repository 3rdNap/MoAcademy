// A small shared class roster used by the People page and the instructor
// gradebook. In a live deployment this comes from the enrollments table.

export interface Student {
  id: string;
  name: string;
}

export const roster: Student[] = [
  { id: "st_thabo", name: "Thabo Nkosi" },
  { id: "st_aisha", name: "Aisha Patel" },
  { id: "st_liam", name: "Liam O'Connor" },
  { id: "st_zinhle", name: "Zinhle Mthembu" },
  { id: "st_noah", name: "Noah Williams" },
  { id: "st_fatima", name: "Fatima Hassan" },
  { id: "st_ethan", name: "Ethan Brooks" },
  { id: "st_lerato", name: "Lerato Sithole" },
];
