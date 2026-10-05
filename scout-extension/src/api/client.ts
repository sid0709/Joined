import { getApiHost } from "./config";
import type { ScoutProfile, ApiError } from "./types";

export class ScoutApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = getApiHost();
  }

  async getMe(): Promise<ScoutProfile | null> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/scout/me`, {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      if (response.status === 401) {
        return null;
      }

      if (!response.ok) {
        const error: ApiError = await response.json().catch(() => ({
          error: "Unknown error",
        }));
        throw new Error(error.message || error.error);
      }

      const profile: ScoutProfile = await response.json();
      return profile;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new Error("Cannot connect to Scout API");
      }
      throw error;
    }
  }
}
