import type { CompanyProfile, Job, PublicCompany } from "./types";
import type { GlyphName } from "@openseat/design-system";

const INDUSTRIES = [
  "Software",
  "Public sector technology",
  "Healthcare",
  "Financial services",
  "Developer tools",
  "Commerce",
] as const;

const SIZES = ["11–50", "51–200", "201–500", "501–1,000", "1,001–5,000"] as const;

const OFFICES = [
  "Remote",
  "United States",
  "New York · Remote",
  "San Francisco · Remote",
  "Chicago · New York",
] as const;

const HEADQUARTERS = [
  "San Francisco, CA",
  "New York, NY",
  "Austin, TX",
  "Chicago, IL",
  "Seattle, WA",
  "Remote-first",
] as const;

const COMPANY_TYPES = ["Privately held", "Public company", "Venture-backed startup"] as const;

const PERK_SETS = [
  ["Hybrid, 2 days in office", "Learning budget", "Health coverage"],
  ["Remote-first", "Home office stipend", "16 weeks parental leave"],
  ["Visa sponsorship", "Learning budget", "Equity"],
] as const;

const SPECIALTY_SETS = [
  ["Cloud infrastructure", "Platform engineering", "Developer tooling"],
  ["Consumer growth", "Product design", "Data platforms"],
  ["Regulatory compliance", "Enterprise integrations", "Security"],
] as const;

const MISSION_STATEMENTS = [
  "We believe great teams do their best work when the tools around them get out of the way.",
  "Our mission is to make the everyday parts of the job faster, so people can spend their time on the hard parts.",
  "We're building the infrastructure other companies quietly depend on — and we take that responsibility seriously.",
] as const;

export type CompanyValue = { icon: GlyphName; title: string; description: string };

const VALUE_SETS: readonly CompanyValue[][] = [
  [
    {
      icon: "sparkle",
      title: "Move with craft",
      description: "We ship fast without cutting corners on quality.",
    },
    {
      icon: "users",
      title: "Default to trust",
      description: "We hire adults and give them real ownership.",
    },
    {
      icon: "heart",
      title: "Care about outcomes",
      description: "We measure ourselves by what customers achieve.",
    },
  ],
  [
    {
      icon: "home",
      title: "Remote-first, always",
      description: "Async by default, meetings by exception.",
    },
    {
      icon: "star",
      title: "Raise the bar",
      description: "We hold a high standard and help each other reach it.",
    },
    {
      icon: "refresh",
      title: "Iterate in public",
      description: "We share work early and improve it in the open.",
    },
  ],
  [
    {
      icon: "seat",
      title: "Customer in the room",
      description: "Every roadmap decision starts with their problem.",
    },
    {
      icon: "sparkle",
      title: "Curiosity over certainty",
      description: "We'd rather ask a good question than guess.",
    },
    {
      icon: "users",
      title: "One team",
      description: "No silos between engineering, design, and support.",
    },
  ],
];

export type Leader = { name: string; title: string };

const LEADERSHIP_SETS: readonly Leader[][] = [
  [
    { name: "Morgan Ellis", title: "Chief Executive Officer" },
    { name: "Priya Raman", title: "VP of Engineering" },
    { name: "Diego Souza", title: "Head of People" },
  ],
  [
    { name: "Alex Tanaka", title: "Co-Founder & CEO" },
    { name: "Jamie Okafor", title: "Co-Founder & CTO" },
    { name: "Lena Petrov", title: "VP of Product" },
  ],
  [
    { name: "Sam Whitfield", title: "Chief Executive Officer" },
    { name: "Nora Haddad", title: "VP of Talent" },
    { name: "Theo Brandt", title: "Head of Engineering" },
  ],
];

export type BenefitCategory = { label: string; items: string[] };

const BENEFIT_CATEGORY_SETS: readonly BenefitCategory[][] = [
  [
    {
      label: "Health & wellbeing",
      items: ["Medical, dental, vision", "Mental health stipend", "Gym reimbursement"],
    },
    { label: "Time off", items: ["Flexible PTO", "Company-wide holidays", "Paid sick leave"] },
    { label: "Financial", items: ["Equity for every hire", "401(k) match", "Life insurance"] },
    {
      label: "Growth",
      items: ["Annual learning budget", "Conference travel", "Internal mobility"],
    },
  ],
  [
    {
      label: "Health & wellbeing",
      items: ["Full health coverage", "Wellness days", "On-demand therapy"],
    },
    {
      label: "Time off",
      items: ["Unlimited PTO", "16 weeks parental leave", "Sabbatical after 4 years"],
    },
    { label: "Financial", items: ["Home office stipend", "Commuter benefits", "401(k) match"] },
    {
      label: "Growth",
      items: ["Mentorship program", "Book & course budget", "Internal transfers"],
    },
  ],
  [
    {
      label: "Health & wellbeing",
      items: ["Medical, dental, vision", "Fitness stipend", "EAP counseling"],
    },
    { label: "Time off", items: ["25 days PTO", "Volunteer days", "Winter shutdown week"] },
    { label: "Financial", items: ["Visa sponsorship", "Relocation support", "Stock options"] },
    { label: "Growth", items: ["Learning budget", "Conference budget", "Promotion clarity"] },
  ],
];

const TECH_STACK_FALLBACK = [
  ["TypeScript", "React", "Node.js", "PostgreSQL"],
  ["Go", "Kubernetes", "AWS", "gRPC"],
  ["Python", "Django", "GraphQL", "Terraform"],
] as const;

const FOUNDED_START = 1996;
const FOUNDED_SPAN = 25;
const REPLY_START = 2;
const REPLY_SPAN = 6;
const OFFICE_LIMIT = 3;
const SKILLS_LIMIT = 6;

/** Stand-in profile fields. Athens only stores name, logo, and website. */
export type PresentedCompany = CompanyProfile & {
  id: string;
  logo?: string;
  url?: string;
  tagline: string;
  perks: string[];
  verified: boolean;
  headquarters: string;
  companyType: string;
  specialties: string[];
  mission: string;
  values: CompanyValue[];
  leadership: Leader[];
  benefitCategories: BenefitCategory[];
  techStack: string[];
};

export function companyFromJob(job: Job): PublicCompany | null {
  const id = job.companyId?.trim();
  if (!id) return null;
  return {
    id,
    name: job.company,
    url: job.companyUrl?.trim() || undefined,
    logo: job.companyLogo?.trim() || undefined,
  };
}

export function openRolesFor(companyId: string, jobs: Job[]) {
  return jobs.filter((job) => job.companyId === companyId).length;
}

/** Same-origin logo URL. Third-party hosts block the browser from loading their files directly. */
export function companyLogoSrc(companyId?: string, logo?: string) {
  const raw = logo?.trim();
  if (!raw) return undefined;
  if (raw.startsWith("/")) return raw;
  const id = companyId?.trim();
  if (!id) return undefined;
  return `/companies/${encodeURIComponent(id)}/logo`;
}

export function presentCompany(company: PublicCompany, jobs: Job[]): PresentedCompany {
  const seed = hash(company.id || company.name);
  const companyJobs = jobs.filter((job) => job.companyId === company.id);
  const offices = [...new Set(companyJobs.map((job) => job.location.trim()).filter(Boolean))].slice(
    0,
    OFFICE_LIMIT,
  );
  const skills = [...new Set(companyJobs.flatMap((job) => job.skills))].slice(0, SKILLS_LIMIT);

  return {
    id: company.id,
    slug: company.id,
    name: company.name,
    logo: company.logo,
    url: company.url,
    locations: offices.length > 0 ? offices.join(" · ") : OFFICES[seed % OFFICES.length],
    about: `${company.name} posts roles on its own site. Opened keeps the listing, the company page, and the application link together.`,
    industry: INDUSTRIES[seed % INDUSTRIES.length],
    size: SIZES[seed % SIZES.length],
    founded: FOUNDED_START + (seed % FOUNDED_SPAN),
    replyDays: REPLY_START + (seed % REPLY_SPAN),
    tagline: `${company.name} is hiring.`,
    perks: [...PERK_SETS[seed % PERK_SETS.length]],
    verified: true,
    headquarters: HEADQUARTERS[seed % HEADQUARTERS.length],
    companyType: COMPANY_TYPES[seed % COMPANY_TYPES.length],
    specialties: [...SPECIALTY_SETS[seed % SPECIALTY_SETS.length]],
    mission: MISSION_STATEMENTS[seed % MISSION_STATEMENTS.length],
    values: [...VALUE_SETS[seed % VALUE_SETS.length]],
    leadership: [...LEADERSHIP_SETS[seed % LEADERSHIP_SETS.length]],
    benefitCategories: [...BENEFIT_CATEGORY_SETS[seed % BENEFIT_CATEGORY_SETS.length]],
    techStack:
      skills.length > 0 ? skills : [...TECH_STACK_FALLBACK[seed % TECH_STACK_FALLBACK.length]],
  };
}

function hash(value: string) {
  let sum = 0;
  for (const char of value) sum = (sum * 31 + char.charCodeAt(0)) >>> 0;
  return sum;
}

export function websiteHref(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function websiteLabel(url: string) {
  const href = websiteHref(url);
  try {
    return new URL(href).host.replace(/^www\./, "");
  } catch {
    return url.trim();
  }
}
