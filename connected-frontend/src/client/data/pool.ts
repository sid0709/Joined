import type { Ats, PoolJob } from "@/src/client/types/hunter";

interface PoolSource {
  ats: Ats;
  count: number;
  companies: string[];
  urlTemplate: (company: string, n: number) => string;
}

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");

function uuidLike(n: number) {
  const hex = ((n * 2654435761) >>> 0).toString(16).padStart(8, "0");
  return `${hex}-${hex.slice(0, 4)}-4${hex.slice(1, 4)}-a${hex.slice(2, 5)}-${hex}${hex.slice(0, 4)}`;
}

const TITLES: { title: string; function: string }[] = [
  { title: "Product Manager, Growth", function: "Product" },
  { title: "Senior Product Manager, Platform", function: "Product" },
  { title: "Technical Program Manager", function: "Program Management" },
  { title: "Operations Strategy Lead", function: "Operations" },
  { title: "Senior Data Analyst", function: "Data" },
  { title: "Customer Success Manager, Enterprise", function: "Customer Success" },
  { title: "Product Designer", function: "Design" },
  { title: "Senior Software Engineer, Backend", function: "Engineering" },
  { title: "Partnerships Manager", function: "Business Development" },
  { title: "Finance Business Partner", function: "Finance" },
  { title: "Marketing Manager, Lifecycle", function: "Marketing" },
  { title: "Solutions Engineer", function: "Sales Engineering" },
  { title: "Recruiting Operations Manager", function: "People" },
  { title: "Senior Engineering Manager", function: "Engineering" },
];

const LOCATIONS = [
  "New York, NY",
  "San Francisco, CA",
  "Seattle, WA",
  "Austin, TX",
  "Boston, MA",
  "Chicago, IL",
  "Denver, CO",
  "Remote · US",
  "Remote · EMEA",
  "London, UK",
];
const WORKPLACES: PoolJob["workplace"][] = ["Remote", "Hybrid", "On-site", "Hybrid", "Remote"];
const SENIORITY: PoolJob["seniority"][] = ["Mid", "Senior", "Senior", "Lead", "Director"];
const SALARY_BASE: Record<PoolJob["seniority"], number> = {
  Mid: 105,
  Senior: 140,
  Lead: 175,
  Director: 215,
};

const SOURCES: PoolSource[] = [
  {
    ats: "Greenhouse",
    count: 60,
    companies: [
      "Airbnb",
      "Stripe",
      "Figma",
      "Notion",
      "Datadog",
      "Cloudflare",
      "Coinbase",
      "Instacart",
      "Asana",
      "Pinterest",
    ],
    urlTemplate: (c, n) => `https://boards.greenhouse.io/${slug(c)}/jobs/${4_100_000 + n}`,
  },
  {
    ats: "Lever",
    count: 16,
    companies: ["Palantir", "Spotify", "Plaid", "Kraken", "Zendesk"],
    urlTemplate: (c, n) => `https://jobs.lever.co/${slug(c)}/${uuidLike(n)}`,
  },
  {
    ats: "Ashby",
    count: 20,
    companies: ["Ramp", "Linear", "Vercel", "Deel", "Retool", "Mercury"],
    urlTemplate: (c, n) => `https://jobs.ashbyhq.com/${slug(c)}/${uuidLike(n)}`,
  },
  {
    ats: "Workday",
    count: 56,
    companies: ["Salesforce", "Adobe", "Nvidia", "Intel", "Walmart", "Target", "Cisco", "PayPal"],
    urlTemplate: (c, n) =>
      `https://${slug(c)}.wd5.myworkdayjobs.com/en-US/careers/job/R-${70_000 + n}`,
  },
  {
    ats: "iCIMS",
    count: 44,
    companies: ["UnitedHealth Group", "Comcast", "Humana", "Cigna", "Lockheed Martin", "Kroger"],
    urlTemplate: (c, n) => `https://careers-${slug(c)}.icims.com/jobs/${30_000 + n}/job`,
  },
  {
    ats: "SmartRecruiters",
    count: 24,
    companies: ["Visa", "Bosch", "Ubisoft", "Skechers", "Equinix"],
    urlTemplate: (c, n) => `https://jobs.smartrecruiters.com/${slug(c)}/${7_430_000 + n}`,
  },
];

function buildPool(): PoolJob[] {
  const jobs: PoolJob[] = [];
  let serial = 0;
  for (const source of SOURCES) {
    for (let i = 0; i < source.count; i += 1) {
      serial += 1;
      const company = source.companies[i % source.companies.length];
      const title = TITLES[(i * 5 + serial) % TITLES.length];
      const seniority = SENIORITY[(i + serial) % SENIORITY.length];
      const base = SALARY_BASE[seniority] + ((i * 7) % 20);
      jobs.push({
        id: `pool-${String(serial).padStart(3, "0")}`,
        company,
        title: title.title,
        ats: source.ats,
        location: LOCATIONS[(i * 3 + serial) % LOCATIONS.length],
        workplace: WORKPLACES[(i + serial) % WORKPLACES.length],
        seniority,
        function: title.function,
        salary: `$${base}k–$${base + 35}k`,
        postedDaysAgo: (i * 3 + serial) % 21,
        applyUrl: source.urlTemplate(company, serial),
      });
    }
  }
  return jobs;
}

export const POOL_JOBS: PoolJob[] = buildPool();
export const POOL_ATS: Ats[] = SOURCES.map((source) => source.ats);

export const POOL_BY_ID = new Map(POOL_JOBS.map((job) => [job.id, job]));
