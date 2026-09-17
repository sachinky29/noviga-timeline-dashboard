import type {
  AssetNode,
  CycleTimeRow,
  MachineIntervals,
  ShiftDefinition,
  User,
} from "../types";

export const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "https://fractaldmsdev.centralindia.cloudapp.azure.com";

export class ApiError extends Error {
  status: number;
  serverMessage?: string;
  fieldErrors?: unknown;

  constructor(status: number, message: string, serverMessage?: string, fieldErrors?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.serverMessage = serverMessage;
    this.fieldErrors = fieldErrors;
  }
}

type Envelope<T> = {
  trace_id?: string;
  status_code?: number;
  message?: string;
  data: T;
};

function dispatchAuthExpired() {
  localStorage.removeItem("access_token");
  window.dispatchEvent(new Event("auth-expired"));
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  authenticated = true,
  retries = 2,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const headers = new Headers(options.headers);
      if (options.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }

      if (authenticated) {
        const token = localStorage.getItem("access_token");
        if (token) headers.set("Authorization", `Bearer ${token}`);
      }

      const response = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers,
      });

      let payload: Envelope<T> | null = null;
      try {
        payload = (await response.json()) as Envelope<T>;
      } catch {
        payload = null;
      }

      const serverMessage = payload?.message;

      if (response.status === 401 && authenticated) {
        dispatchAuthExpired();
        throw new ApiError(401, "Session expired. Please log in again.", serverMessage);
      }

      if (response.status === 403) {
        throw new ApiError(403, "Access denied.", serverMessage);
      }

      if (response.status === 422) {
        throw new ApiError(422, serverMessage || "Validation error.", serverMessage, payload?.data);
      }

      if (!response.ok) {
        throw new ApiError(response.status, serverMessage || `Request failed (${response.status}).`, serverMessage);
      }

      if (payload && typeof payload === "object" && "data" in payload) {
        if (typeof payload.status_code === "number" && payload.status_code >= 400) {
          throw new ApiError(payload.status_code, payload.message || "Request failed.", payload.message, payload.data);
        }
        return payload.data;
      }

      return payload as T;
    } catch (error) {
      lastError = error;
      const isRetryable =
        (error instanceof ApiError && error.status === 500) ||
        !(error instanceof ApiError);

      if (!isRetryable || attempt >= retries) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Request failed.");
}

export function login(username: string, password: string) {
  return request<{ access_token: string; token_type: string }>(
    "/auth/login",
    { method: "POST", body: JSON.stringify({ username, password }) },
    false,
    0,
  );
}

export function getCurrentUser() {
  return request<User>("/auth/me");
}

export async function logout() {
  try {
    await request<null>("/auth/logout", { method: "POST" });
  } finally {
    localStorage.removeItem("access_token");
  }
}

export function getAssetsTree() {
  return request<AssetNode[]>("/core/assets/tree");
}

export function getShifts() {
  return request<ShiftDefinition[]>("/core/shifts");
}

export function getMachineIntervals(body: unknown) {
  return request<MachineIntervals>("/analytics-query/machine-intervals", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getCycleTime(body: unknown) {
  return request<CycleTimeRow[]>("/analytics-query", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
