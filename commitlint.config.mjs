const config = {
  extends: ["@commitlint/config-conventional"],
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
