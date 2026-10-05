import { Glyph, IconButton } from "sid-ui";

import { useColorMode } from "../theme/colorMode";

export default function ColorModeToggle() {
  const { mode, toggleMode } = useColorMode();
  const next = mode === "dark" ? "light" : "dark";
  return (
    <IconButton
      variant="ghost"
      size="sm"
      label={`Switch to ${next} mode`}
      tooltip={`Switch to ${next} mode`}
      icon={<Glyph name={mode === "dark" ? "sun" : "moon"} />}
      onClick={toggleMode}
    />
  );
}
