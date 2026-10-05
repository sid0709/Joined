// Subjects already on stage-roadmap / stage-roadmap-w34. Commitlint reads every
// commit since main, so these stay listed until that history changes.
const historicalSubjects = new Set([
  "Add email authentication: sign-up, verification, sign-in, and password reset",
  "Add scout share-of-applies earnings",
  "Add server-side job search with filters, sorting, and paging",
  "Document RecordApply integration point",
  "Fix markdown formatting",
  "roadmap: add W1-W4 index and step-01 Scout extension scaffold",
]);

const config = {
  extends: ["@commitlint/config-conventional"],
  ignores: [(commit) => historicalSubjects.has(commit.split(/\r?\n/, 1)[0])],
  rules: {
    // Several feat/mode-company bodies wrap past 100; keep type/scope/subject strict.
    "body-max-line-length": [2, "always", 300],
    // Merge commits that bring a base branch forward use type `merge`.
    "type-enum": [
      2,
      "always",
      [
        "build",
        "chore",
        "ci",
        "docs",
        "feat",
        "fix",
        "merge",
        "perf",
        "refactor",
        "revert",
        "style",
        "test",
      ],
    ],
  },
};
export default config;
