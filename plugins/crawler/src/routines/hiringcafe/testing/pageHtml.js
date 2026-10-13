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

export const INTERIM_COLLAPSE = "collapse-interim";

export const INTERIM_JOBS = Object.freeze([
  Object.freeze({
    requisitionId: "v1f7zi9s9sjs7nuw",
    title: "Custodian I",
    path: "/job/custodian-i-interim-inc-salinas-california-v1f7zi9s9sjs7nuw",
  }),
  Object.freeze({
    requisitionId: "8exxx344cu65m97q",
    title: "Administrative Assistant II/Counselor I (Sandy Shores)",
    path: "/job/administrative-assistant-ii-counselor-i-sandy-shores-interim-inc-8exxx344cu65m97q",
  }),
  Object.freeze({
    requisitionId: "sj62vr6lcpw185gn",
    title: "Custodian I - Sun Rose Housing",
    path: "/job/custodian-i-sun-rose-housing-sun-rose-housing-salinas-california-sj62vr6lcpw185gn",
  }),
  Object.freeze({
    requisitionId: "bhzhzp7x4upf48f0",
    title: "Community Support Worker III - MCHOME",
    path: "/job/community-support-worker-iii-mchome-interim-inc-salinas-california-bhzhzp7x4upf48f0",
  }),
]);

export function interimHits() {
  return INTERIM_JOBS.map((job) =>
    hit({
      requisitionId: job.requisitionId,
      title: job.title,
      collapseKey: INTERIM_COLLAPSE,
      companyName: "Interim, Inc.",
      website: "interiminc.org",
    }),
  );
}

export function viewAllDialogMarkup(jobs = INTERIM_JOBS) {
  const links = jobs.map((job) => `<a href="${job.path}">${job.title}</a>`).join("");
  return `<div role="dialog" data-testid="view-all">${links}</div>`;
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

function hoverLayerMarkup(cluster, rowExtra = "") {
  return `<div class="absolute inset-y-0 left-0 w-full cursor-zoom-in"><div class="absolute inset-y-0 left-0 bg-black w-full opacity-50"></div>${cluster}<div class="absolute bottom-0 w-full p-2 h-full"><div class="flex justify-between items-end text-sm w-full space-x-2 h-full"><button type="button">Apply Directly</button>${rowExtra}</div></div></div>`;
}

/** Live hover chrome: Mark Applied is a sibling of the justify-between row. */
export function overlayMarkup({ applied = false, control = "button", live = false } = {}) {
  if (applied === true && !live) {
    return hoverLayerMarkup(
      `<div class="flex items-center space-x-2 absolute font-bold top-2 right-2 text-white"><span class="text-sm flex items-center space-x-1"><span>Applied</span><svg></svg></span></div><div class="absolute top-0 right-0 z-10 m-2 flex flex-col items-start text-xs font-bold"><div class="flex items-center space-x-2"></div></div>`,
      `<a class="bg-pink-50 text-pink-600 font-bold rounded px-4 py-2 text-xs" href="/myhiringcafe/tracker">App Tracker</a>`,
    );
  }
  if (live || applied === "toggle" || applied === "tracker") {
    const toggle = applied === "tracker" ? "" : `<button class="bg-white">Applied</button>`;
    const tracker = applied === "toggle" ? "" : `<button class="bg-pink-600">App Tracker</button>`;
    return hoverLayerMarkup(
      `<div class="absolute top-0 right-0 z-10"><div class="flex items-center space-x-2">${toggle}${tracker}</div></div>`,
    );
  }
  const mark =
    control === "div"
      ? `<div class="bg-white">Mark Applied</div>`
      : `<button class="p-2 bg-white hover:bg-gray-100 rounded flex-none text-black">Mark Applied</button>`;
  return hoverLayerMarkup(
    `<div class="absolute top-0 right-0 z-10 m-2 flex flex-col items-start text-xs font-bold"><div class="flex items-center space-x-2"><button type="button">Save</button>${mark}</div></div>`,
  );
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
  return `<div role="status" class="toast">Job marked successfully</div>`;
}

export function trackerNavMarkup() {
  return `<nav><a href="/applied">Applied</a><button type="button">App Tracker</button></nav>`;
}

export function signInDialogMarkup() {
  return `<div role="dialog">Sign in so we can update your job tracker</div>`;
}

export function cardMarkup(href, postedRaw = "", extras = {}) {
  const overlay = extras.overlay || "";
  const extra = extras.extra || "";
  const carousel = extras.carousel || "";
  const viewAll = extras.viewAll || "";
  const className =
    extras.className || (extras.greyed ? "opacity-50 grayscale pointer-events-none" : "");
  const classes = className ? ` class="${className}"` : "";
  return `<div${classes}><div class="flex justify-between"><a href="${href}">Job Posting</a><span>${postedRaw}</span></div>${extra}${overlay}${carousel}${viewAll}<div class="absolute top-2 right-2"><span>${postedRaw}</span></div></div>`;
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
  extraHits,
  viewAll,
  nav = "",
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
        ...(Array.isArray(extraHits) ? { ssrViewAllHits: extraHits } : {}),
        ...(ssrSignedIn !== undefined ? { ssrSignedIn } : {}),
      },
    },
    page: "/classic",
    query: ssrPage ? { page: String(ssrPage) } : {},
    buildId: "test-build",
  };
  return `<!DOCTYPE html><html><body>
    ${nav}
    <div data-testid="job-results"><div class="hc-card-grid">${visibleCards.join("")}</div></div>
    ${toast ? toastMarkup() : ""}
    ${viewAll || ""}
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
