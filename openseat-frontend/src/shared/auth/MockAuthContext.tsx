"use client";

import React, { createContext, useContext, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { AccountUpdate, ClientProfile, RegisteredUser, UserRole, CandidateProfile } from "@/src/shared/types/auth";

interface MockAuthContextType {
  currentUser: RegisteredUser | null;
  profile: CandidateProfile;
  clientProfile: ClientProfile;
  loginUser: (email: string, passwordText: string) => { success: boolean; error?: string; role?: UserRole };
  registerUser: (fullName: string, email: string, passwordText: string) => { success: boolean; error?: string };
  assignRole: (role: UserRole) => void;
  updateProfile: (updated: Partial<CandidateProfile>) => void;
  updateClientProfile: (updated: Partial<ClientProfile>) => void;
  updateAccount: (updated: AccountUpdate) => { success: boolean; error?: string };
  logoutUser: () => void;
}

const MockAuthContext = createContext<MockAuthContextType | undefined>(undefined);

const USERS_STORAGE_KEY = "os_mock_db_users";
const ACTIVE_USER_STORAGE_KEY = "os_mock_db_active";
const AUTH_STORAGE_EVENT = "os-mock-auth-storage";
const EMPTY_USERS_SNAPSHOT = "[]";

function subscribeToAuthStorage(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};

  const handleStorage = (event: StorageEvent) => {
    if (event.key === USERS_STORAGE_KEY || event.key === ACTIVE_USER_STORAGE_KEY) onStoreChange();
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(AUTH_STORAGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(AUTH_STORAGE_EVENT, onStoreChange);
  };
}

function readUsersSnapshot() {
  return typeof window === "undefined" ? EMPTY_USERS_SNAPSHOT : window.localStorage.getItem(USERS_STORAGE_KEY) ?? EMPTY_USERS_SNAPSHOT;
}

function readActiveUserSnapshot() {
  return typeof window === "undefined" ? null : window.localStorage.getItem(ACTIVE_USER_STORAGE_KEY);
}

function parseUsers(snapshot: string): RegisteredUser[] {
  try {
    const parsed = JSON.parse(snapshot);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseActiveUser(snapshot: string | null): RegisteredUser | null {
  if (!snapshot) return null;
  try {
    return JSON.parse(snapshot) as RegisteredUser;
  } catch {
    return null;
  }
}

function notifyAuthStorage() {
  window.dispatchEvent(new Event(AUTH_STORAGE_EVENT));
}

export function MockAuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const usersSnapshot = useSyncExternalStore(subscribeToAuthStorage, readUsersSnapshot, () => EMPTY_USERS_SNAPSHOT);
  const activeUserSnapshot = useSyncExternalStore(subscribeToAuthStorage, readActiveUserSnapshot, () => null);
  const users = useMemo(() => parseUsers(usersSnapshot), [usersSnapshot]);
  const currentUser = useMemo(() => parseActiveUser(activeUserSnapshot), [activeUserSnapshot]);

  const [profile, setProfile] = useState<CandidateProfile>({
    title: "Full-Stack Next.js Developer",
    hourlyRate: "$45.00",
    bio: "Experienced developer building system tokens matching marketplace requirements layout parameters perfectly.",
    skills: ["Next.js", "TypeScript", "React"],
    specialty: "Product interfaces and workflow systems",
    yearsExperience: "5+ years",
    availability: "20+ hrs/week · Available to start soon",
    timezone: "Eastern Time (ET)",
    performanceScore: "86 / 100",
    schedulingReliability: "92%",
    workExamples: ["https://example.com/portfolio"],
    verificationStatus: "In review",
  });
  const [clientProfile, setClientProfile] = useState<ClientProfile>({
    organizationName: "OpenSeat Demo Studio",
    organizationType: "Growing company",
    industry: "Technology and services",
    location: "United States",
    description: "A team that hires specialist bidders for outcome-focused work.",
    hiringNeeds: "Product design, engineering, growth, and operational specialists",
    evaluationApproach: "Structured brief, practical evaluation, milestone contract",
    paymentStatus: "Verified",
    identityStatus: "Verified",
  });

  const registerUser = (fullName: string, email: string, passwordText: string) => {
    const exists = users.some((u) => u.email.toLowerCase() === email.toLowerCase());
    if (exists) return { success: false, error: "This email address is already registered." };

    const newUser: RegisteredUser = { email, passwordText, fullName, role: null };
    const nextUsers = [...users, newUser];

    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(nextUsers));
    localStorage.setItem(ACTIVE_USER_STORAGE_KEY, JSON.stringify(newUser));
    notifyAuthStorage();

    return { success: true };
  };

  const loginUser = (email: string, passwordText: string) => {
    const match = users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.passwordText === passwordText
    );
    if (!match) return { success: false, error: "Invalid email credentials or missing user registry entry." };

    localStorage.setItem(ACTIVE_USER_STORAGE_KEY, JSON.stringify(match));
    notifyAuthStorage();
    return { success: true, role: match.role };
  };

  const assignRole = (role: UserRole) => {
    if (!currentUser) return;
    const updatedUser = { ...currentUser, role };
    localStorage.setItem(ACTIVE_USER_STORAGE_KEY, JSON.stringify(updatedUser));

    const updatedUsers = users.map((u) => (u.email === currentUser.email ? updatedUser : u));
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updatedUsers));
    notifyAuthStorage();
  };

  const updateProfile = (updated: Partial<CandidateProfile>) => {
    setProfile((prev) => ({ ...prev, ...updated }));
  };

  const updateClientProfile = (updated: Partial<ClientProfile>) => {
    setClientProfile((prev) => ({ ...prev, ...updated }));
  };

  const updateAccount = ({ fullName, email }: AccountUpdate) => {
    if (!currentUser) return { success: false, error: "No active account is signed in." };
    if (!fullName.trim() || !email.trim()) return { success: false, error: "Name and email are required." };

    const emailChanged = email.trim().toLowerCase() !== currentUser.email.toLowerCase();
    const emailTaken = users.some((user) => user.email.toLowerCase() === email.trim().toLowerCase() && user.email !== currentUser.email);
    if (emailChanged && emailTaken) return { success: false, error: "That email address is already in use." };

    const updatedUser = { ...currentUser, fullName: fullName.trim(), email: email.trim() };
    const updatedUsers = users.map((user) => user.email === currentUser.email ? updatedUser : user);
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updatedUsers));
    localStorage.setItem(ACTIVE_USER_STORAGE_KEY, JSON.stringify(updatedUser));
    notifyAuthStorage();
    return { success: true };
  };

  const logoutUser = () => {
    localStorage.removeItem(ACTIVE_USER_STORAGE_KEY);
    notifyAuthStorage();
    router.push("/marketplace/login");
  };

  return (
    <MockAuthContext.Provider
      value={{ currentUser, profile, clientProfile, loginUser, registerUser, assignRole, updateProfile, updateClientProfile, updateAccount, logoutUser }}
    >
      {children}
    </MockAuthContext.Provider>
  );
}

export function useMockAuth() {
  const context = useContext(MockAuthContext);
  if (!context) {
    throw new Error("useMockAuth must be used within a MockAuthProvider.");
  }
  return context;
}
