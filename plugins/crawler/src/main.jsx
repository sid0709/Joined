import { createRoot } from "react-dom/client";

import "./styles/crawler.css";
import Providers from "./api/Providers.jsx";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <Providers>
    <App />
  </Providers>,
);
