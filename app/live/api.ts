import { ClientTransportError, fetchJson, responseErrorCode } from "../../lib/client";
export type Me = { id: string; name: string; email?: string; role: "patient" | "doctor" };
export type Patient = {
  id: string;
  displayCode: string;
  grantedAt: string;
  entryCount: number;
  latestEntryDate: string | null;
};
export type Entry = {
  id: string;
  date: string;
  text: string;
  mood: number;
  sleepHours: number;
  energy: number;
  revision: number;
};
export type Note = { text: string; revision: number; updatedAt: string | null };
export const API_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "";
const messages: Record<string, string> = {
  UNAUTHENTICATED: "Сессия закончилась. Войдите снова.",
  NOT_FOUND: "Доступ к истории закрыт или пациент больше недоступен.",
  INVITATION_UNAVAILABLE:
    "Приглашение недоступно: истекло, отменено, уже принято или адресовано другой почте. Проверьте свой аккаунт; если почта верна, попросите пациента создать новое приглашение.",
  REVISION_CONFLICT:
    "Заметка уже изменена в другом окне. Скопируйте свой текст и обновите историю перед сохранением.",
  DOCTOR_REQUIRED: "Для этого кабинета нужна учётная запись специалиста.",
  EMAIL_NOT_VERIFIED: "Подтвердите адрес электронной почты.",
  INVALID_EMAIL_OR_PASSWORD: "Проверьте почту и пароль.",
  INVALID_PERIOD:
    "Проверьте даты: начало не позже окончания, до 366 календарных дней.",
  INVALID_INPUT: "Проверьте заполненные поля.",
  TOO_MANY_REQUESTS: "Слишком много попыток. Подождите минуту.",
  SESSION_NOT_FRESH: "Для проверки входов войдите в аккаунт заново.",
  SESSIONS_UNAVAILABLE: "Не удалось проверить входы. Обновите список.",
  SERVICE_UNAVAILABLE: "Сервер временно недоступен. Попробуйте позже.",
  FORBIDDEN: "Сервер не разрешил запрос. Войдите снова или обратитесь к команде.",
};
export class RequestError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(messages[code] || "Не удалось выполнить запрос. Попробуйте ещё раз.");
  }
}
export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  if (!API_URL)
    throw new Error("Адрес API не настроен. См. backend/README.md.");
  const { response, payload } = await fetchJson(`${API_URL}/api/${path}`, {
      method: options.method || "GET",
      credentials: "include",
      cache: "no-store",
      signal: options.signal,
      headers:
        options.body === undefined
          ? {}
          : { "Content-Type": "application/json" },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (!response.ok)
    throw new RequestError(
      response.status,
      responseErrorCode(response, payload),
    );
  if (!path.startsWith("auth/") && !Object.hasOwn(payload, "data"))
    throw new ClientTransportError("INVALID_RESPONSE");
  return (path.startsWith("auth/") ? payload : payload.data) as T;
}
