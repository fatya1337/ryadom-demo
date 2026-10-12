/** Copyable browser client for the patient team. No browser storage or dependencies. */
export type DiaryEntry = {
  id: string;
  date: string;
  text: string;
  mood: number;
  sleepHours: number;
  energy: number;
  revision: number;
  updatedAt: string;
};
export type EntryInput = Omit<DiaryEntry, "id" | "updatedAt">;
export type ChecklistItem = { id: string; text: string; done: boolean };
export type Checklist = {
  items: ChecklistItem[];
  revision: number;
  updatedAt: string | null;
};
export type DailyPlan = Checklist & { date: string };
export type PlanInput = Omit<DailyPlan, "updatedAt">;
export type PatientSummary = {
  id: string;
  displayCode: string;
  grantedAt: string;
  entryCount: number;
  latestEntryDate: string | null;
};
export type AccessActivity = {
  events: {
    id: string;
    action: "entries.read" | "entries.exported";
    occurredAt: string;
    specialist: { name: string; email: string } | null;
  }[];
  hasMore: boolean;
};
export type SessionOverview = {
  total: number;
  hasMore: boolean;
  sessions: { current: boolean; createdAt: string; expiresAt: string }[];
};
export type Profile = {
  id: string;
  name: string;
  email: string;
  role: "patient" | "doctor";
  displayCode: string;
  consent: null | { version: string; adult: boolean; acceptedAt: string };
  requiredConsentVersion: string;
};
export class RyadomError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
export class ClientTransportError extends Error {
  constructor(public code: "NETWORK_ERROR" | "REQUEST_TIMEOUT" | "INVALID_RESPONSE") {
    super({
      NETWORK_ERROR: "Не удалось связаться с сервером. Проверьте подключение.",
      REQUEST_TIMEOUT: "Сервер не ответил вовремя. Проверьте подключение.",
      INVALID_RESPONSE: "Сервер вернул неожиданный ответ. Попробуйте загрузить данные снова.",
    }[code]);
    this.name = "ClientTransportError";
  }
}

// One deadline covers both response headers and its JSON body. No automatic retries:
// a timed-out write may already have committed; revision checks still govern retries.
export async function fetchJson(
  url: string,
  init: RequestInit = {},
  dependencies: { timeoutMs?: number; fetcher?: typeof fetch } = {},
): Promise<{ response: Response; payload: Record<string, unknown> }> {
  const controller = new AbortController();
  const caller = init.signal;
  if (caller?.aborted) throw new DOMException("Request cancelled", "AbortError");
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancel: (() => void) | undefined;
  const interrupted = new Promise<never>((_, reject) => {
    cancel = () => {
      reject(new DOMException("Request cancelled", "AbortError"));
      controller.abort();
    };
    caller?.addEventListener("abort", cancel, { once: true });
    timer = setTimeout(() => {
      reject(new ClientTransportError("REQUEST_TIMEOUT"));
      controller.abort();
    }, dependencies.timeoutMs ?? 15_000);
  });
  try {
    return await Promise.race([
      (async () => {
        const response = await (dependencies.fetcher ?? fetch)(url, { ...init, signal: controller.signal });
        let payload: unknown;
        try { payload = await response.json(); }
        catch {
          if (!response.ok) return { response, payload: {} };
          throw new ClientTransportError("INVALID_RESPONSE");
        }
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
          if (!response.ok) return { response, payload: {} };
          throw new ClientTransportError("INVALID_RESPONSE");
        }
        return { response, payload: payload as Record<string, unknown> };
      })(),
      interrupted,
    ]);
  } catch (error) {
    if (error instanceof ClientTransportError || (error instanceof Error && error.name === "AbortError")) throw error;
    throw new ClientTransportError("NETWORK_ERROR");
  } finally {
    clearTimeout(timer);
    if (cancel) caller?.removeEventListener("abort", cancel);
  }
}

export function responseErrorCode(response: Response, payload: Record<string, unknown>) {
  if (response.status === 401) return "UNAUTHENTICATED";
  const nested = payload.error;
  const code = nested && typeof nested === "object" && "code" in nested ? nested.code : payload.code;
  if (typeof code === "string") return code;
  if (response.status === 403) return "FORBIDDEN";
  if (response.status === 429) return "TOO_MANY_REQUESTS";
  if (response.status >= 500) return "SERVICE_UNAVAILABLE";
  return "REQUEST_FAILED";
}

export function createRyadomClient(baseURL: string) {
  const base = baseURL.replace(/\/$/, "");
  async function request<T>(
    path: string,
    method = "GET",
    body?: unknown,
  ): Promise<T> {
    const { response, payload } = await fetchJson(`${base}/api/${path}`, {
      method,
      credentials: "include",
      cache: "no-store",
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok)
      throw new RyadomError(response.status, responseErrorCode(response, payload));
    if (!path.startsWith("auth/") && !Object.hasOwn(payload, "data"))
      throw new ClientTransportError("INVALID_RESPONSE");
    return (path.startsWith("auth/") ? payload : payload.data) as T;
  }
  const period = (from: string, to: string) =>
    new URLSearchParams({ from, to });
  return {
    signIn: (email: string, password: string) =>
      request("auth/sign-in/email", "POST", { email, password }),
    signOut: () => request("auth/sign-out", "POST", {}),
    patients: () => request<PatientSummary[]>("v1/therapist/patients"),
    me: () => request<Profile>("v1/me"),
    sessions: () => request<SessionOverview>("v1/me/sessions"),
    revokeOtherSessions: () => request<{ revoked: boolean }>("v1/me/sessions/revoke-others", "POST", { confirmation: "REVOKE_OTHER_SESSIONS" }),
    consent: (version: string, adult: true) =>
      request("v1/me/consents", "POST", { version, adult }),
    entries: (from: string, to: string) =>
      request<{ patientCode: string; entries: DiaryEntry[] }>(
        `v1/me/entries?${period(from, to)}`,
      ),
    saveEntry: (entry: EntryInput) =>
      request<DiaryEntry>("v1/me/entries", "PUT", entry),
    exportEntries: (from: string, to: string) =>
      request<{ patientCode: string; entries: DiaryEntry[] }>(
        `v1/me/export?${period(from, to)}`,
      ),
    plan: (date: string) =>
      request<DailyPlan>(`v1/me/plan?${new URLSearchParams({ date })}`),
    savePlan: (plan: PlanInput) =>
      request<DailyPlan>("v1/me/plan", "PUT", plan),
    exportPlans: (from: string, to: string) =>
      request<{ plans: DailyPlan[] }>(`v1/me/plans/export?${period(from, to)}`),
    preparation: (patientId: string) =>
      request<Checklist>(
        `v1/therapist/patients/${encodeURIComponent(patientId)}/preparation`,
      ),
    savePreparation: (
      patientId: string,
      input: Pick<Checklist, "items" | "revision">,
    ) =>
      request<Checklist>(
        `v1/therapist/patients/${encodeURIComponent(patientId)}/preparation`,
        "PUT",
        input,
      ),
    invite: (doctorEmail: string) =>
      request<{
        id: string;
        code: string;
        doctorEmail: string;
        expiresAt: string;
      }>("v1/me/invitations", "POST", { doctorEmail }),
    sharing: () =>
      request<{
        grants: {
          id: string;
          grantedAt: string;
          revokedAt: string | null;
          doctor: { name: string; email: string };
        }[];
        invitations: { id: string; doctorEmail: string; expiresAt: string }[];
      }>("v1/me/sharing"),
    accessActivity: () => request<AccessActivity>("v1/me/access-activity"),
    revoke: (id: string) =>
      request(`v1/me/grants/${encodeURIComponent(id)}`, "DELETE"),
    cancelInvitation: (id: string) =>
      request(`v1/me/invitations/${encodeURIComponent(id)}`, "DELETE"),
    deleteData: (confirmation: "DELETE_MY_DATA") =>
      request("v1/me/data", "DELETE", { confirmation }),
  };
}
