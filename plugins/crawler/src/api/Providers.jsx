import { ColorModeProvider } from "../theme/colorMode.jsx";

import { BackendHealthProvider } from "./backendHealth.jsx";
import { RuntimeProvider } from "./runtime.jsx";

const Providers = ({ children }) => {
  return (
    <ColorModeProvider>
      <BackendHealthProvider>
        <RuntimeProvider>{children}</RuntimeProvider>
      </BackendHealthProvider>
    </ColorModeProvider>
  );
};

export default Providers;
