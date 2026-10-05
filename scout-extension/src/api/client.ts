import { getApiHost, getSessionCookieName, getWebOrigin } from "./config";
import type {
  ApiError,
  ExtensionSubmissionInput,
  ExtensionSubmitResult,
  ScoutProfile,
} from "./types";

export const SCOUT_ME_PATH = "/v1/scout/me";
export const SCOUT_EXTENSION_SUBMIT_PATH = "/v1/scout/submissions/extension";
export const IDEMPOTENCY_HEADER = "Idempotency-Key";
export const IDEMPOTENT_REPLAYED_HEADER = "Idempotent-Replayed";

export const SIGN_IN_TO_SUBMIT_MESSAGE = "Sign in to Scout to submit.";
export const UNKNOWN_API_ERROR_MESSAGE = "Unknown error";
export const API_UNREACHABLE_MESSAGE = "Cannot connect to Scout API";

export function apiErrorMessage(error: ApiError): string {
  if (error.errors?.length) {
    return error.errors.map((item) => `${item.field}: ${item.detail}`).join("; ");
  }
  return error.detail || error.title || error.message || error.error || UNKNOWN_API_ERROR_MESSAGE;
}

export function readSubmissionId(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const submission = (payload as { submission?: unknown }).submission;
  if (typeof submission !== "object" || submission === null) {
    return null;
  }
  const id = (submission as { id?: unknown }).id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

export class ScoutApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = getApiHost();
  }

  private async getSessionToken(): Promise<string | null> {
    try {
      const webOrigin = getWebOrigin();
      const cookie = await chrome.cookies.get({
        url: webOrigin,
        name: getSessionCookieName(),
      });

      if (cookie && cookie.value) {
        return cookie.value;
      }
      return null;
    } catch (error) {
      console.error("Failed to read session cookie:", error);
      return null;
    }
  }

  private async readError(response: Response): Promise<string> {
    const error: ApiError = await response.json().catch(() => ({
      error: UNKNOWN_API_ERROR_MESSAGE,
    }));
    return apiErrorMessage(error);
  }

  async getMe(): Promise<ScoutProfile | null> {
    try {
      const token = await this.getSessionToken();
      if (!token) {
        return null;
      }

      const response = await fetch(`${this.baseUrl}${SCOUT_ME_PATH}`, {
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
        throw new Error(await this.readError(response));
      }

      const profile: ScoutProfile = await response.json();
      return profile;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new Error(API_UNREACHABLE_MESSAGE);
      }
      throw error;
    }
  }

  async submitExtension(
    input: ExtensionSubmissionInput,
    idempotencyKey: string,
  ): Promise<ExtensionSubmitResult> {
    try {
      const token = await this.getSessionToken();
      if (!token) {
        throw new Error(SIGN_IN_TO_SUBMIT_MESSAGE);
      }

      const response = await fetch(`${this.baseUrl}${SCOUT_EXTENSION_SUBMIT_PATH}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
          [IDEMPOTENCY_HEADER]: idempotencyKey,
        },
        body: JSON.stringify(input),
      });

      if (response.status === 401) {
        throw new Error(SIGN_IN_TO_SUBMIT_MESSAGE);
      }

      if (!response.ok) {
        throw new Error(await this.readError(response));
      }

      const payload: unknown = await response.json();
      const submissionId = readSubmissionId(payload);
      if (!submissionId) {
        throw new Error(UNKNOWN_API_ERROR_MESSAGE);
      }

      return {
        submission: { id: submissionId },
        replayed: response.headers.get(IDEMPOTENT_REPLAYED_HEADER) === "true",
      };
    } catch (error) {
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new Error(API_UNREACHABLE_MESSAGE);
      }
      throw error;
    }
  }
}
