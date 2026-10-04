export const DEFAULT_SCHEMA = {
  type: "object",
  properties: {
    missing_components: {
      type: "array",
      items: {
        type: "object",
        properties: {
          component_hint: {
            type: "string",
          },
          selectors: {
            type: "array",
            items: {
              type: "object",
              properties: {
                element_selector: {
                  type: "string",
                },
                element_type: {
                  type: "string",
                  enum: ["CSS_SELECTOR", "ID", "NAME", "DATA_ATTRIBUTE", "XPATH"],
                },
              },
              propertyOrdering: ["element_selector", "element_type"],
              required: ["element_selector", "element_type"],
            },
          },
          action_suggestion: {
            type: "object",
            properties: {
              command: {
                type: "string",
                enum: ["TYPING", "CLICK", "FILEUPLOAD", "DROPDOWN_SELECT"],
              },
              payload: {
                type: "object",
                properties: {
                  value: {
                    type: "string",
                  },
                  timeout_ms: {
                    type: "integer",
                  },
                },
                propertyOrdering: ["value", "timeout_ms"],
                required: ["value", "timeout_ms"],
              },
            },
            propertyOrdering: ["command", "payload"],
            required: ["command", "payload"],
          },
        },
        propertyOrdering: ["component_hint", "selectors", "action_suggestion"],
        required: ["component_hint", "selectors", "action_suggestion"],
      },
    },
  },
  propertyOrdering: ["missing_components"],
  required: ["missing_components"],
};

export const REFINED_SYSTEM_INSTRUCTION = `### Missing Component Selector Planner

Goal: Given an HTML snippet of the minimal container (the smallest ancestor containing all interactable elements), and optional feedback (DOM hints + list of unmatched components), return JSON strictly matching the schema with missing_components only.

For each missing component provide:
- selectors: 1–5 robust locators (prefer id > data-testid/data-cy/data-automation-id > name > specific CSS; use XPATH only if necessary). Selectors must be document.querySelectorAll compatible (no :has-text()).
- component_hint: short label of the UI block (e.g., "Email", "Visa status", "Reason for applying").
- action_suggestion (optional): command and payload value if obvious.

Rules:
- Use only allowed element_type values: CSS_SELECTOR, ID, NAME, DATA_ATTRIBUTE, XPATH.
- Prefer stable attributes; avoid volatile class names.
- Output missing_components array only. Do not include any prose or analysis.
`;
