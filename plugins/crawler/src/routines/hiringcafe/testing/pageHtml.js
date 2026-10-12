const COLLAPSE_A = "collapse-group-a";
const COLLAPSE_B = "collapse-group-b";

export function hit({
  requisitionId,
  title,
  collapseKey,
  companyName = "Acme",
  website = "acme.example",
  applyUrl = `https://boards.example/apply/${requisitionId}`,
  extras = {},
} = {}) {
  return {
    id: `src___${requisitionId}`,
    apply_url: applyUrl,
    requisition_id: requisitionId,
    collapse_key: collapseKey,
    job_information: { title, job_title_raw: title },
    v5_processed_job_data: {
      core_job_title: title,
      company_name: companyName,
      company_website: website,
      estimated_publish_date: "2026-10-12T18:03:03.455Z",
      formatted_workplace_location: "Austin, Texas, United States",
      workplace_type: "Onsite",
      commitment: ["Full Time"],
      seniority_level: "Mid",
      ...extras.v5,
    },
    enriched_company_data: {
      name: companyName,
      homepage_uri: website,
      external_id: extras.externalId || "org123",
      org_entity_id: extras.orgEntityId || "org_abc",
      industries: extras.industries || ["Software"],
      nb_employees: extras.employees ?? 150,
      year_founded: extras.founded ?? 2008,
      hq_country: extras.hq || "US",
      tagline: extras.tagline || "Build things",
    },
    attributed_org: {
      name: companyName,
      website,
      external_id: extras.externalId || "org123",
    },
  };
}

export function groupedHits() {
  return [
    hit({
      requisitionId: "reqaaa1111111111",
      title: "Help Desk Coordinator",
      collapseKey: COLLAPSE_A,
    }),
    hit({
      requisitionId: "reqbbb2222222222",
      title: "Associate Category Manager",
      collapseKey: COLLAPSE_A,
    }),
    hit({
      requisitionId: "reqccc3333333333",
      title: "Category Manager",
      collapseKey: COLLAPSE_A,
    }),
    hit({
      requisitionId: "reqddd4444444444",
      title: "Labor Production",
      collapseKey: COLLAPSE_B,
      companyName: "Rose Acre Farms",
      website: "roseacre.example",
    }),
  ];
}

export function overlayMarkup({ applied = false } = {}) {
  if (applied) {
    return `<div class="absolute top-0 right-0"><div class="flex items-center space-x-2"><span>Applied ✓</span><button class="bg-pink-600">App Tracker</button></div></div>`;
  }
  return `<div class="absolute top-0 right-0"><div class="flex items-center space-x-2"><div class="flex-none cursor-pointer">Save</div><div class="bg-white">Mark Applied</div></div></div>`;
}

export function carouselMarkup(size = 3, current = 1) {
  const dots = Array.from({ length: size }, (_, index) => {
    const n = index + 1;
    const currentAttr = n === current ? ' aria-current="true"' : "";
    return `<button aria-label="Show job ${n}"${currentAttr}></button>`;
  });
  return `<button aria-label="Previous job at this company"></button>${dots.join("")}<button aria-label="Next job at this company"></button><button>View all</button>`;
}

export function toastMarkup() {
  return `<div>Job marked successfully</div>`;
}

export function signInDialogMarkup() {
  return `<div role="dialog">Sign in so we can update your job tracker</div>`;
}

export function cardMarkup(href, postedRaw = "", extras = {}) {
  const overlay = extras.overlay || "";
  const carousel = extras.carousel || "";
  return `<div><a href="${href}">Job Posting</a>${overlay}${carousel}<div class="absolute top-2 right-2"><span>${postedRaw}</span></div></div>`;
}

export function listPageHtml({
  hits = groupedHits(),
  ssrPage = 0,
  ssrIsLastPage = false,
  ssrPageSize = 40,
  ssrTotalCount = 147,
  ssrSignedIn = true,
  cards,
  toast = false,
} = {}) {
  const visibleCards = cards ?? [
    cardMarkup(`/job/help-desk-coordinator-reqaaa1111111111`, "3h", {
      carousel: carouselMarkup(3, 1),
    }),
    cardMarkup(`/job/labor-production-reqddd4444444444`, "5h"),
  ];
  const payload = {
    props: {
      pageProps: {
        ssrHits: hits,
        ssrPage,
        ssrPageSize,
        ssrIsLastPage,
        ssrTotalCount,
        ssrUnpackJobCards: false,
        ...(ssrSignedIn !== undefined ? { ssrSignedIn } : {}),
      },
    },
    page: "/classic",
    query: ssrPage ? { page: String(ssrPage) } : {},
    buildId: "test-build",
  };
  return `<!DOCTYPE html><html><body>
    <div data-testid="job-results"><div class="hc-card-grid">${visibleCards.join("")}</div></div>
    ${toast ? toastMarkup() : ""}
    <script id="__NEXT_DATA__" type="application/json">${JSON.stringify(payload)}</script>
  </body></html>`;
}

export function detailJob(overrides = {}) {
  const base = hit({
    requisitionId: "uplqcnmhu405bzud",
    title: "Help Desk Coordinator",
    collapseKey: COLLAPSE_A,
    companyName: "Shell Mobility and Convenience USA",
    website: "texaspetroleumgroup.com",
    applyUrl:
      "https://myjobs.adp.com/shellmobilityandconvenience/cx/job-details?reqId=5001231308500",
    extras: {
      v5: {
        company_name: "Texas Petroleum Group",
        technical_tools: ["Excel", "Outlook"],
        yearly_min_compensation: null,
        hourly_min_compensation: 19.5,
        hourly_max_compensation: 22,
        listed_compensation_frequency: "Hourly",
        listed_compensation_currency: "USD",
        "401k_matching": true,
      },
      industries: ["Retail"],
      tagline: "Fuel and convenience",
    },
  });
  base.job_information.description = "<p>Coordinate help desk tickets and vendor access.</p>";
  base.job_information.num_applies = 2;
  return {
    ...base,
    ...overrides,
    job_information: { ...base.job_information, ...overrides.job_information },
    v5_processed_job_data: { ...base.v5_processed_job_data, ...overrides.v5_processed_job_data },
    enriched_company_data: { ...base.enriched_company_data, ...overrides.enriched_company_data },
  };
}

export function detailPageHtml({
  job = detailJob(),
  postedRaw = "Posted 3h ago",
  logoSrc = "https://s2.googleusercontent.com/s2/favicons?domain=texaspetroleumgroup.com&sz=128",
  jsonLd,
} = {}) {
  const posting = jsonLd ?? {
    "@type": "JobPosting",
    title: job.job_information.title,
    description: job.job_information.description,
    datePosted: job.v5_processed_job_data.estimated_publish_date,
    identifier: { value: job.requisition_id },
    hiringOrganization: {
      name: job.enriched_company_data.name,
      sameAs: "https://texaspetroleumgroup.com",
      logo: logoSrc,
    },
  };
  return `<!DOCTYPE html><html><body>
    <h1>${job.job_information.title}</h1>
    <span>${postedRaw}</span>
    <img class="w-full h-full object-contain" src="${logoSrc}" alt="${job.enriched_company_data.name}">
    <script type="application/ld+json">${JSON.stringify(posting)}</script>
    <script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: { pageProps: { job } },
      page: "/job/[requisitionId]",
      query: { requisitionId: `${job.job_information.title}-${job.requisition_id}` },
    })}</script>
  </body></html>`;
}
