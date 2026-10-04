import { useContext } from "react";
import { BackendHealthContext } from "./backendHealthContext";

export default function useBackendHealth() {
  return useContext(BackendHealthContext);
}
