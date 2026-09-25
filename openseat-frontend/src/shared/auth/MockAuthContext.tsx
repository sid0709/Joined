"use client";

import React, { createContext, useContext, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { RegisteredUser, UserRole, CandidateProfile } from "@/src/shared/types/auth";

interface MockAuthContextType {
  currentUser: RegisteredUser | null;
  profile: CandidateProfile;
  loginUser: (email: string, passwordText: string) => { success: boolean; error?: string; role?: UserRole };
  registerUser: (fullName: string, email: string, passwordText: string) => { success: boolean; error?: string };
  assignRole: (role: UserRole) => void;
  updateProfile: (updated: Partial<CandidateProfile>) => void;
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

  const logoutUser = () => {
    localStorage.removeItem(ACTIVE_USER_STORAGE_KEY);
    notifyAuthStorage();
    router.push("/marketplace/login");
  };

  return (
    <MockAuthContext.Provider
      value={{ currentUser, profile, loginUser, registerUser, assignRole, updateProfile, logoutUser }}
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
