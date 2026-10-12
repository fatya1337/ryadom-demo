"use client";
import { useCallback } from "react";
import ChecklistEditor, {
  type Checklist,
  type ChecklistInput,
} from "./checklist";
import type { api } from "./api";
export default function Preparation({
  patientId,
  request,
  onDirty,
  onError,
  demo,
}: {
  patientId: string;
  request: typeof api;
  onDirty: (value: boolean) => void;
  onError: (error: unknown) => void;
  demo: boolean;
}) {
  const read = useCallback(
    () => request<Checklist>(`v1/therapist/patients/${patientId}/preparation`),
    [request, patientId],
  );
  const write = useCallback(
    (body: ChecklistInput) =>
      request<Checklist>(`v1/therapist/patients/${patientId}/preparation`, {
        method: "PUT",
        body,
      }),
    [request, patientId],
  );
  return (
    <ChecklistEditor
      read={read}
      write={write}
      onDirty={onDirty}
      onError={onError}
      title="В фокусе встречи."
      eyebrow="ЛИЧНЫЙ ЛИСТ СПЕЦИАЛИСТА"
      description={
        demo
          ? "Учебный список. Сохраняется в памяти вкладки до перезагрузки."
          : "Ваши вопросы и темы. Пациент и другие специалисты этот лист не видят. В сводку дневника он не включается."
      }
      demo={demo}
    />
  );
}
