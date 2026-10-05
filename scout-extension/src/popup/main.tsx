import { createRoot } from "react-dom/client";
import { JoinedProvider } from "@joined/design-system/theme";
import App from "./App";
import "./popup.css";

createRoot(document.getElementById("root")!).render(
  <JoinedProvider mode="light">
    <App />
  </JoinedProvider>,
);
