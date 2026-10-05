import { createRoot } from "react-dom/client";
import { JoinedProvider } from "sid-ui/theme";
import SidebarApp from "./SidebarApp";
import { ErrorBoundary } from "./ErrorBoundary";
import { AcornNoticeHost } from "./AcornNoticeHost";
import "./sidebar.css";

createRoot(document.getElementById("root")!).render(
  <JoinedProvider mode="light">
    <ErrorBoundary>
      <SidebarApp />
    </ErrorBoundary>
    <AcornNoticeHost />
  </JoinedProvider>,
);
