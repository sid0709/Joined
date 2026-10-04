import { requestAiAnalyze } from "./api/analyze";

/** When match-option returns null, re-plan this one control with live options in the tree. */
export async function matchOptionViaAnalyze(input: {
  intendedValue: string;
  options: string[];
  fieldLabel: string;
  apiUrl: string;
}): Promise<string | null> {
  const options = input.options
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 64);
  const intended = input.intendedValue.trim();
  const label = input.fieldLabel.replace(/\s+/g, " ").trim() || "Dropdown";
  if (!options.length || !intended) return null;

  const optionLines = options.map(
    (opt, i) => `    option[${i + 5}] ${JSON.stringify(opt.slice(0, 200))}`,
  );
  const pureTree = [
    "form[1]",
    `  p[2] ${JSON.stringify(`Intended answer: ${intended.slice(0, 200)}`)}`,
    `  label[3] ${JSON.stringify(label.slice(0, 200))}`,
    `  input[4] role=combobox aria-label=${JSON.stringify(label.slice(0, 120))} placeholder=Select...`,
    ...optionLines,
  ].join("\n");
  const result = await requestAiAnalyze({ pureTree }, input.apiUrl);
  const value = String(
    result.plan?.actions?.find((action) => action.action === "fill" && action.value)?.value || "",
  ).trim();
  if (!value) return null;
  return (
    options.find((opt) => opt === value) ||
    options.find((opt) => opt.toLowerCase() === value.toLowerCase()) ||
    null
  );
}
