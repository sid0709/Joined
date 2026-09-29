const config = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Several feat/mode-company bodies wrap past 100; keep type/scope/subject strict.
    "body-max-line-length": [2, "always", 300],
  },
};
export default config;
