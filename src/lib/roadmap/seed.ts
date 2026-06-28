import type {
  ApplicationEntry,
  Scholarship,
  TargetInstitution,
} from "./types";

// ---------------------------------------------------------------------------
// Starter examples only. Everything here is fully editable and deletable from
// the UI — the roadmap is meant to be populated by each student with their own
// goals, requirements, dates and opportunities, which change over time.
// ---------------------------------------------------------------------------

export const seedTargets: TargetInstitution[] = [
  {
    id: "t_uct_cs",
    institution: "University of Cape Town",
    program: "BSc Computer Science",
    location: "Cape Town",
    priority: "reach",
    minAps: 42,
    targetAps: 48,
    currentAps: 40,
    notes:
      "Highly competitive — aim well above the minimum and apply early. Maths is weighted heavily.",
    requirements: [
      { id: "r1", label: "Mathematics", minimum: "70%", recommended: "85%", met: false },
      { id: "r2", label: "English Home/FAL", minimum: "60%", recommended: "70%", met: true },
      { id: "r3", label: "Physical Sciences", minimum: "60%", recommended: "75%", met: false },
      { id: "r4", label: "National Benchmark Test (NBT)", minimum: "Written", recommended: "Proficient", met: false },
    ],
  },
  {
    id: "t_wits_eng",
    institution: "University of the Witwatersrand",
    program: "BEng Electrical Engineering",
    location: "Johannesburg",
    priority: "target",
    minAps: 42,
    targetAps: 46,
    currentAps: 44,
    requirements: [
      { id: "r1", label: "Mathematics", minimum: "70%", recommended: "80%", met: true },
      { id: "r2", label: "Physical Sciences", minimum: "70%", recommended: "80%", met: false },
      { id: "r3", label: "English", minimum: "50%", recommended: "65%", met: true },
    ],
  },
];

export const seedApplications: ApplicationEntry[] = [
  {
    id: "a_uct",
    institution: "University of Cape Town",
    program: "BSc Computer Science",
    opensAt: "2026-04-01T00:00:00Z",
    closesAt: "2026-07-31T23:59:00Z",
    applyUrl: "https://apply.uct.ac.za",
    prospectusUrl: "https://www.uct.ac.za/main/apply/undergraduate/prospectus",
    status: "in_progress",
  },
  {
    id: "a_wits",
    institution: "University of the Witwatersrand",
    program: "BEng Electrical Engineering",
    opensAt: "2026-04-01T00:00:00Z",
    closesAt: "2026-09-30T23:59:00Z",
    applyUrl: "https://www.wits.ac.za/applications",
    status: "not_started",
  },
];

export const seedScholarships: Scholarship[] = [
  {
    id: "s_nsfas",
    name: "NSFAS Bursary",
    provider: "National Student Financial Aid Scheme",
    coverage: "Full tuition, accommodation & allowances",
    closesAt: "2026-11-30T23:59:00Z",
    url: "https://www.nsfas.org.za",
    requirements: [
      "South African citizen",
      "Combined household income below the NSFAS threshold",
      "Accepted into a public university or TVET college",
    ],
  },
  {
    id: "s_funza",
    name: "Funza Lushaka Bursary",
    provider: "Department of Basic Education",
    coverage: "Full-cost teaching bursary",
    closesAt: "2027-01-13T23:59:00Z",
    url: "https://www.funzalushaka.doe.gov.za",
    requirements: [
      "Studying towards a teaching qualification",
      "Strong academic record",
      "Commitment to teach a priority subject after graduating",
    ],
  },
];
