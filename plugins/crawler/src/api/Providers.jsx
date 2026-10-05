import { ColorModeProvider } from "../theme/colorMode.jsx";

import { ActiveTabProvider } from "./activeTab.jsx";
import { BackendHealthProvider } from "./backendHealth.jsx";
import { RuntimeProvider } from "./runtime.jsx";

const Providers = ({ children }) => {
  return (
    <ColorModeProvider>
      <BackendHealthProvider>
        <RuntimeProvider>
          <ActiveTabProvider>{children}</ActiveTabProvider>
        </RuntimeProvider>
      </BackendHealthProvider>
    </ColorModeProvider>
  );
};

export default Providers;
