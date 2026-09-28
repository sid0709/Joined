"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";

import {
  acceptTerms,
  activeUser,
  clawBack,
  expireJob,
  markAllNotificationsRead,
  markNotificationRead,
  moderatorDecide,
  needsOnboarding,
  recordConversion,
  recordHire,
  recordInterview,
  releaseDueHoldings,
  requestPayout,
  resetDemo,
  savePayoutMethod,
  saveTaxInfo,
  signIn,
  signOut,
  signUp,
  submitJob,
  updateAccount,
  verifyEmail,
  verifyIdentity,
  verifyPhone,
  type ActionResult,
} from "@/lib/actions";
import {
  parseStore,
  readStoreSnapshot,
  subscribeToStore,
  writeStore,
  EMPTY_SNAPSHOT,
} from "@/lib/storage";
import type { ScoutAccount, StoreState, SubmitJobInput } from "@/lib/types";

import type { ReactNode } from "react";

type ScoutContextValue = {
  state: StoreState;
  user: ScoutAccount | null;
  ready: boolean;
  needsOnboarding: boolean;
  commit: (result: ActionResult | StoreState) => ActionResult;
  signIn: (email: string, passwordText: string) => ActionResult;
  signUp: (input: { name: string; email: string; passwordText: string }) => ActionResult;
  signOut: () => void;
  acceptTerms: () => ActionResult;
  verifyEmail: (code: string) => ActionResult;
  verifyPhone: (phone: string, code: string) => ActionResult;
  verifyIdentity: () => ActionResult;
  saveTaxInfo: () => ActionResult;
  savePayoutMethod: (method: NonNullable<ScoutAccount["payoutMethod"]>) => ActionResult;
  updateAccount: (
    patch: Partial<Pick<ScoutAccount, "name" | "notifyDecisions" | "notifyRewards">>,
  ) => ActionResult;
  submitJob: (input: SubmitJobInput) => ActionResult;
  moderatorDecide: (id: string, decision: "approved" | "rejected", reason?: string) => ActionResult;
  recordInterview: (id: string) => ActionResult;
  recordHire: (id: string) => ActionResult;
  expireJob: (id: string) => ActionResult;
  recordConversion: (id: string, companyFeeCents: number) => ActionResult;
  clawBack: (id: string) => ActionResult;
  requestPayout: () => ActionResult;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  resetDemo: () => void;
};

const ScoutContext = createContext<ScoutContextValue | null>(null);

function asResult(value: ActionResult | StoreState): ActionResult {
  return "ok" in value ? value : { ok: true, state: value };
}

export function ScoutProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(subscribeToStore, readStoreSnapshot, () => EMPTY_SNAPSHOT);
  const ready = snapshot !== EMPTY_SNAPSHOT || typeof window !== "undefined";
  const state = useMemo(() => releaseDueHoldings(parseStore(snapshot)), [snapshot]);

  const commit = useCallback((value: ActionResult | StoreState): ActionResult => {
    const result = asResult(value);
    if (result.ok) writeStore(result.state);
    return result;
  }, []);

  const user = activeUser(state);
  const value = useMemo<ScoutContextValue>(
    () => ({
      state,
      user,
      ready,
      needsOnboarding: user ? needsOnboarding(user) : false,
      commit,
      signIn: (email, passwordText) => commit(signIn(state, email, passwordText)),
      signUp: (input) => commit(signUp(state, input)),
      signOut: () => writeStore(signOut(state)),
      acceptTerms: () => commit(acceptTerms(state)),
      verifyEmail: (code) => commit(verifyEmail(state, code)),
      verifyPhone: (phone, code) => commit(verifyPhone(state, phone, code)),
      verifyIdentity: () => commit(verifyIdentity(state)),
      saveTaxInfo: () => commit(saveTaxInfo(state)),
      savePayoutMethod: (method) => commit(savePayoutMethod(state, method)),
      updateAccount: (patch) => commit(updateAccount(state, patch)),
      submitJob: (input) => commit(submitJob(state, input)),
      moderatorDecide: (id, decision, reason) =>
        commit(moderatorDecide(state, id, decision, reason)),
      recordInterview: (id) => commit(recordInterview(state, id)),
      recordHire: (id) => commit(recordHire(state, id)),
      expireJob: (id) => commit(expireJob(state, id)),
      recordConversion: (id, companyFeeCents) =>
        commit(recordConversion(state, id, companyFeeCents)),
      clawBack: (id) => commit(clawBack(state, id)),
      requestPayout: () => commit(requestPayout(state)),
      markNotificationRead: (id) => writeStore(markNotificationRead(state, id)),
      markAllNotificationsRead: () => writeStore(markAllNotificationsRead(state)),
      resetDemo: () => writeStore(resetDemo()),
    }),
    [commit, ready, state, user],
  );

  return <ScoutContext.Provider value={value}>{children}</ScoutContext.Provider>;
}

export function useScout() {
  const value = useContext(ScoutContext);
  if (!value) throw new Error("useScout must be used inside ScoutProvider");
  return value;
}

export function useScoutUser() {
  return useScout().user;
}
