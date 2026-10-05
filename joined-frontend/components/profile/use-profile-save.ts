"use client";

import { useToast } from "sid-ui";
import { saveProfile } from "@/lib/me/pipeline";
import { normalizeProfile, type Profile } from "@/lib/profile";

const SAVE_FAILED = "Couldn’t save your profile";

/**
 * Saves a profile patch, hands the saved profile to `onSaved`, and toasts the
 * outcome. Resolves true when the save went through.
 */
export function useProfileSave(onSaved: (profile: Profile) => void) {
  const toast = useToast();
  return async (patch: Partial<Profile>, message: string) => {
    try {
      onSaved(normalizeProfile(await saveProfile(patch)));
      toast({ body: message });
      return true;
    } catch (error) {
      toast({ body: error instanceof Error ? error.message : SAVE_FAILED, type: "error" });
      return false;
    }
  };
}
