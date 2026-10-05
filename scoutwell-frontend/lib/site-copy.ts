import { SENIORITIES, SENIORITY_LABEL, formatMoney, formatRate, type Meta } from "@joined/scout";

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

/** Public pay figures taken from the live rulebook — never hard-coded rates. */
export function earnFigures(meta: Meta) {
  const { rewards } = meta;
  const junior = SENIORITY_LABEL.Junior;
  const senior = SENIORITY_LABEL.Senior;
  return {
    apply: formatMoney(rewards.apply_reward),
    interviews: `${formatMoney(rewards.interview_by_seniority.Junior)}–${formatMoney(rewards.interview_by_seniority.Senior)}`,
    hires: `${formatMoney(rewards.hire_by_seniority.Junior)}–${formatMoney(rewards.hire_by_seniority.Senior)}`,
    conversion: formatRate(rewards.conversion_share),
    holdDays: rewards.hold_days,
    minPayout: formatMoney(rewards.min_payout),
    juniorLabel: junior,
    seniorLabel: senior,
    interviewRows: SENIORITIES.map((seniority) => ({
      seniority,
      label: SENIORITY_LABEL[seniority],
      interview: formatMoney(rewards.interview_by_seniority[seniority]),
      hire: formatMoney(rewards.hire_by_seniority[seniority]),
    })),
  };
}

/** FAQ answers interpolate live reward numbers so rates cannot drift from config. */
export function faqItems(meta: Meta): FaqItem[] {
  const earn = earnFigures(meta);
  const start = meta.levels[0];
  return [
    {
      id: "what",
      question: "What is Scout?",
      answer:
        "Scout is how Joined finds official openings the big boards miss. You submit a real apply link from a company careers page or its ATS. When job hunters use that job, you earn.",
    },
    {
      id: "earn",
      question: "How do scouts earn?",
      answer: `Each qualifying apply on a job you submitted credits ${earn.apply} (one credit per candidate per job). Settled interviews pay ${earn.interviews} by seniority, and confirmed hires pay ${earn.hires}. Interview and hire rewards hold ${earn.holdDays} days. Payouts start at ${earn.minPayout}.`,
    },
    {
      id: "install",
      question: "How do I install the extension?",
      answer:
        "Open Install in the main nav and add Scout to Chrome when the store listing is live. Until then that page shows a placeholder. You can also submit jobs from the website.",
    },
    {
      id: "extension-signin",
      question: "How do I sign in from the extension?",
      answer:
        "The extension opens a Scout sign-in tab. Sign in with Google, then close that tab and return to the extension. It picks up your session on its own.",
    },
    {
      id: "jobs",
      question: "What jobs can I submit?",
      answer:
        "Official openings on the employer's careers site or its ATS (Greenhouse, Lever, Ashby, Workday, and others). Not LinkedIn, Indeed, or another job board. Write the summary in your own words.",
    },
    {
      id: "limits",
      question: "Is there a daily limit?",
      answer: start
        ? `You start on ${start.label} with ${start.daily_limit} submissions a day. Quality raises your limit, auto-approval, and interview multiplier.`
        : "Quality raises your daily limit, auto-approval, and interview multiplier.",
    },
    {
      id: "payouts",
      question: "When do I get paid?",
      answer: `Request a payout once your available balance reaches ${earn.minPayout}. Set up verification and a payout method on the Payouts page after you sign in.`,
    },
  ];
}

export const EXTENSION_SIGNED_IN_TITLE = "You're signed in";
export const EXTENSION_SIGNED_IN_BODY = "You can close this tab and return to the extension";

export const INSTALL_PLACEHOLDER_TITLE = "Chrome Web Store listing coming soon";
export const INSTALL_PLACEHOLDER_BODY =
  "The Scout extension is not published yet. This page will link to the store once the listing is live. You can still create an account and submit jobs from the website.";

export const EXTENSION_SIGN_IN_TITLE = "Sign in to Scout";
export const EXTENSION_SIGN_IN_BODY =
  "The Scout extension opened this tab. After you sign in, you can close it and go back.";
