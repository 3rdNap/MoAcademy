// Catalog of registrable subjects with their individual per-term list prices.
// Prices vary by subject; the volume discount (see pricing.ts) is applied on top
// of whichever subjects a student selects.

export interface Subject {
  id: string;
  name: string;
  code: string;
  category: string;
  /** Individual price per term, in ZAR. */
  price: number;
}

export const subjects: Subject[] = [
  { id: "sub_math", name: "Mathematics", code: "MATH", category: "Sciences", price: 1450 },
  { id: "sub_physci", name: "Physical Sciences", code: "PHSC", category: "Sciences", price: 1450 },
  { id: "sub_lifesci", name: "Life Sciences", code: "LFSC", category: "Sciences", price: 1300 },
  { id: "sub_it", name: "Information Technology", code: "INFT", category: "Sciences", price: 1500 },
  { id: "sub_mathlit", name: "Mathematical Literacy", code: "MLIT", category: "Sciences", price: 1100 },
  { id: "sub_english", name: "English", code: "ENGL", category: "Languages", price: 1050 },
  { id: "sub_afrikaans", name: "Afrikaans", code: "AFRK", category: "Languages", price: 1050 },
  { id: "sub_accounting", name: "Accounting", code: "ACCT", category: "Commerce", price: 1250 },
  { id: "sub_economics", name: "Economics", code: "ECON", category: "Commerce", price: 1200 },
  { id: "sub_business", name: "Business Studies", code: "BSTD", category: "Commerce", price: 1150 },
  { id: "sub_geography", name: "Geography", code: "GEOG", category: "Humanities", price: 1100 },
  { id: "sub_history", name: "History", code: "HIST", category: "Humanities", price: 1100 },
];
