import { useContext, createContext } from "react";

const RuntimeContext = createContext(null);

export const useRuntime = () => {
  const ctx = useContext(RuntimeContext);
  if (!ctx) throw new Error("useRuntime must be used within RuntimeProvider");
  return ctx;
};

export default RuntimeContext;
