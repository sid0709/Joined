import { createContext } from "react";

export const BackendHealthContext = createContext({
  status: "unconfigured",
  serverInfo: null,
  apiUrl: null,
});
