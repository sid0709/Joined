import { getApiHost, getSessionCookieName, getWebOrigin } from "./config";
import type { ScoutProfile, ApiError } from "./types";

export class ScoutApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = getApiHost();
  }

  private async getSessionToken(): Promise<string | null> {
    try {
      const webOrigin = getWebOrigin();
      const url = new URL(webOrigin);
      const cookies = await chrome.cookies.getAll({
        name: getSessionCookieName(),
        domain: url.hostname,
      });

      if (cookies.length > 0 && cookies[0].value) {
        return cookies[0].value;
      }
      return null;
    } catch (error) {
      console.error("Failed to read session cookie:", error);
      return null;
    }
  }

  async getMe(): Promise<ScoutProfile | null> {
    try {
      const token = await this.getSessionToken();
      if (!token) {
        return null;
      }

      const response = await fetch(`${this.baseUrl}/v1/scout/me`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
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
        const message = error.detail || error.title || error.message || error.error;
        throw new Error(message);
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
