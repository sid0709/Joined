export type Workplace = "remote" | "hybrid" | "onsite";
export type JobSource = "direct" | "aggregated" | "scouted";
export type Seniority = "Junior" | "Mid" | "Senior" | "Lead";

export type Job = {
  id: string;
  title: string;
  company: string;
  companySlug: string;
  location: string;
  workplace: Workplace;
  salary: string;
  seniority: Seniority;
  employment: string;
  posted: string;
  source: JobSource;
  visa: boolean;
  /** Present when a profile exists to score against. */
  match?: number;
  summary: string;
  requirements: string[];
};

export type CompanyProfile = {
  slug: string;
  name: string;
  locations: string;
  about: string;
};

export const WORKPLACE_LABEL: Record<Workplace, string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  onsite: "On-site",
};

export const SOURCE_LABEL: Record<JobSource, string> = {
  direct: "Posted here",
  aggregated: "Aggregated",
  scouted: "Hidden job",
};

export const COMPANIES: CompanyProfile[] = [
  {
    slug: "northwind",
    name: "Northwind",
    locations: "Chicago · New York",
    about: "A product studio hiring designers and analysts for in-house teams.",
  },
  {
    slug: "harbor",
    name: "Harbor",
    locations: "Remote",
    about: "Infrastructure software. Most roles are remote, with visa support on senior engineering.",
  },
  {
    slug: "lumen",
    name: "Lumen Health",
    locations: "Austin · Seattle",
    about: "A clinic network hiring operators and engineering managers.",
  },
  {
    slug: "fieldnote",
    name: "Fieldnote",
    locations: "Remote",
    about: "A small brand studio. Some roles are shared by scouts before they hit the big boards.",
  },
];

export const JOBS: Job[] = [
  {
    id: "product-designer-northwind",
    title: "Product Designer",
    company: "Northwind",
    companySlug: "northwind",
    location: "Chicago, IL",
    workplace: "hybrid",
    salary: "$140k–$170k",
    seniority: "Senior",
    employment: "Full-time",
    posted: "2d ago",
    source: "direct",
    visa: false,
    match: 92,
    summary: "Own the hiring product from search through interview scheduling. You will pair with research and write the interface yourself.",
    requirements: ["5+ years in product design", "A portfolio of complex tools", "Comfortable with weekly research"],
  },
  {
    id: "frontend-engineer-harbor",
    title: "Frontend Engineer",
    company: "Harbor",
    companySlug: "harbor",
    location: "Remote — United States",
    workplace: "remote",
    salary: "$160k–$190k",
    seniority: "Senior",
    employment: "Full-time",
    posted: "1d ago",
    source: "aggregated",
    visa: true,
    match: 88,
    summary: "Build the logged-in app: search, lists, and the interview calendar. The stack is React and a small design system.",
    requirements: ["Strong React and TypeScript", "Care for accessible UI", "Visa sponsorship available"],
  },
  {
    id: "recruiter-lumen",
    title: "Technical Recruiter",
    company: "Lumen Health",
    companySlug: "lumen",
    location: "Austin, TX",
    workplace: "onsite",
    salary: "$90k–$110k",
    seniority: "Mid",
    employment: "Full-time",
    posted: "5d ago",
    source: "direct",
    visa: false,
    match: 71,
    summary: "Run full-cycle hiring for clinical engineering. You will schedule on the platform and pay only when an interview happens.",
    requirements: ["3+ years recruiting engineers", "On-site in Austin three days a week", "Clear writing"],
  },
  {
    id: "brand-designer-fieldnote",
    title: "Brand Designer",
    company: "Fieldnote",
    companySlug: "fieldnote",
    location: "Remote",
    workplace: "remote",
    salary: "$80–$100/hr",
    seniority: "Mid",
    employment: "Contract",
    posted: "3d ago",
    source: "scouted",
    visa: false,
    summary: "A three-month identity project that is not on the major boards yet. Apply through the studio’s own form.",
    requirements: ["Identity and packaging work", "Available 20 hours a week", "Contract through June"],
  },
  {
    id: "data-analyst-northwind",
    title: "Data Analyst",
    company: "Northwind",
    companySlug: "northwind",
    location: "New York, NY",
    workplace: "hybrid",
    salary: "$120k–$145k",
    seniority: "Mid",
    employment: "Full-time",
    posted: "6d ago",
    source: "aggregated",
    visa: false,
    match: 80,
    summary: "Measure search quality and interview rates. You will sit with design and write the definitions, not only the charts.",
    requirements: ["SQL and a notebook tool", "Experience with product metrics", "Hybrid in New York"],
  },
  {
    id: "support-lead-harbor",
    title: "Support Lead",
    company: "Harbor",
    companySlug: "harbor",
    location: "Remote",
    workplace: "remote",
    salary: "$75k–$95k",
    seniority: "Junior",
    employment: "Full-time",
    posted: "8d ago",
    source: "direct",
    visa: false,
    match: 64,
    summary: "Lead the first response team for candidates and companies. You will write the macros and the escalation path.",
    requirements: ["2+ years in support", "Calm writing under volume", "Overlap with US hours"],
  },
  {
    id: "engineering-manager-lumen",
    title: "Engineering Manager",
    company: "Lumen Health",
    companySlug: "lumen",
    location: "Seattle, WA",
    workplace: "onsite",
    salary: "$180k–$210k",
    seniority: "Lead",
    employment: "Full-time",
    posted: "4h ago",
    source: "scouted",
    visa: true,
    match: 85,
    summary: "A hidden role for a clinic platform team of eight. The company has not posted it on LinkedIn or Indeed.",
    requirements: ["Managed engineers before", "Healthcare or regulated-industry experience", "Seattle on-site"],
  },
  {
    id: "content-designer-fieldnote",
    title: "Content Designer",
    company: "Fieldnote",
    companySlug: "fieldnote",
    location: "Remote",
    workplace: "remote",
    salary: "$110k–$130k",
    seniority: "Mid",
    employment: "Full-time",
    posted: "12d ago",
    source: "aggregated",
    visa: false,
    summary: "Write the product interface and the job posts. You will work with design on empty states, errors, and search.",
    requirements: ["Product writing samples", "Comfort editing with designers", "Remote, US time zones"],
  },
];

export function jobById(id: string) {
  return JOBS.find((job) => job.id === id);
}

export function companyBySlug(slug: string) {
  return COMPANIES.find((company) => company.slug === slug);
}

export function jobsForCompany(slug: string) {
  return JOBS.filter((job) => job.companySlug === slug);
}
