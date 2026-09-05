import type { CaseData, CaseOutcome, CaseSummary, GeneticEvidence, HPOTerm, PatientContext, PatientSubmission, PatientSummary, RankResult, VisitRecommendation } from "@/types/lumina";
import { getStoredCognitoToken } from "@/lib/cognito-auth";

const API = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "") || "/api";
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const recentCases = new Map<string, CaseData>();
type StoredCaseSummary = CaseSummary & { status: CaseOutcome };
export type ApiActor = { userId: string; role: "doctor" | "patient"; token?: string };

export interface ApiHealth {
  status: string;
  version?: string;
  db?: string;
}

export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("The server took too long to respond. Please try again.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function extractionError(res: Response, fallback: string): Promise<Error> {
  try {
    const body = await res.json();
    if (typeof body?.detail === "string" && body.detail.trim()) {
      return new Error(body.detail);
    }
  } catch {}
  return new Error(fallback);
}

export async function getApiHealth(signal?: AbortSignal): Promise<ApiHealth> {
  const res = await fetch(`${API}/health`, {
    method: "GET",
    cache: "no-store",
    signal,
  });
  if (!res.ok) throw new Error("Health check failed");
  return res.json();
}

function actorHeaders(actor: ApiActor): HeadersInit {
  const headers: Record<string, string> = {};
  if (actor.token) {
    headers["Authorization"] = `Bearer ${actor.token}`;
  } else {
    headers["Authorization"] = `Bearer local-${actor.role}`;
  }
  return headers;
}

export function apiUrl(path: string): string {
  return `${API}${path.startsWith("/") ? path : `/${path}`}`;
}

export function clinicalHeaders(contentType?: string): HeadersInit {
  const token = getStoredCognitoToken();
  const authorization = token
    ? `Bearer ${token}`
    : process.env.NODE_ENV !== "production"
      ? "Bearer local-doctor"
      : null;
  if (!authorization) throw new Error("Please sign in as a doctor to use clinical tools.");
  return contentType
    ? { Authorization: authorization, "Content-Type": contentType }
    : { Authorization: authorization };
}

function caseToSummary(caseData: CaseData): StoredCaseSummary {
  return {
    id: caseData.id,
    timestamp: caseData.timestamp,
    topDiagnosis: caseData.rankings[0]?.name ?? "Unknown",
    confidence: caseData.rankings[0]?.confidence ?? 0,
    modalities: caseData.modalities,
    hpoCount: caseData.hpoTerms.length,
    patientName: caseData.patientContext?.patientName,
    status: caseData.outcome ?? defaultCaseOutcome(caseData),
    hasLetter: Boolean(caseData.referralLetterDraft?.trim()),
  };
}

async function jsonOrThrow<T>(res: Response, fallback: string): Promise<T> {
  if (res.ok) return res.json();
  let detail = fallback;
  try {
    const body = await res.json();
    if (typeof body?.detail === "string") detail = body.detail;
  } catch {}
  throw new Error(detail);
}

export async function createPatientSubmissionRemote(input: {
  patientName?: string;
  age?: string;
  sex?: string;
  notes?: string;
  photo?: File | null;
  lab?: File | null;
  geneticEvidence?: GeneticEvidence;
}, actor: ApiActor): Promise<PatientSubmission> {
  const form = new FormData();
  if (input.patientName) form.append("patient_name", input.patientName);
  if (input.age) form.append("age", input.age);
  if (input.sex) form.append("sex", input.sex);
  if (input.notes) form.append("notes", input.notes);
  if (input.geneticEvidence) form.append("genetic_evidence", JSON.stringify(input.geneticEvidence));
  if (input.photo) form.append("photo", input.photo);
  if (input.lab) form.append("lab", input.lab);
  const res = await fetch(`${API}/submissions`, { method: "POST", headers: actorHeaders(actor), body: form });
  return jsonOrThrow<PatientSubmission>(res, "Submission failed");
}

export async function getPatientSubmissionsRemote(actor: ApiActor, status?: string): Promise<PatientSubmission[]> {
  const params = status ? `?status=${encodeURIComponent(status)}` : "";
  const res = await apiFetch(`${API}/submissions${params}`, { headers: actorHeaders(actor), cache: "no-store" });
  return jsonOrThrow<PatientSubmission[]>(res, "Could not load submissions");
}

export async function getPatientSubmissionRemote(id: string, actor: ApiActor): Promise<PatientSubmission> {
  const res = await apiFetch(`${API}/submissions/${id}`, { headers: actorHeaders(actor), cache: "no-store" });
  return jsonOrThrow<PatientSubmission>(res, "Could not load submission");
}

export async function deletePatientSubmissionRemote(id: string, actor: ApiActor): Promise<void> {
  const res = await apiFetch(`${API}/submissions/${id}`, {
    method: "DELETE",
    headers: actorHeaders(actor),
  });
  if (res.status === 404) return;
  await jsonOrThrow<{ ok: boolean }>(res, "Could not delete submission");
}

export async function startSubmissionReview(id: string, actor: ApiActor): Promise<PatientSubmission> {
  const res = await fetch(`${API}/submissions/${id}/start-review`, { method: "POST", headers: actorHeaders(actor) });
  return jsonOrThrow<PatientSubmission>(res, "Could not start review");
}

export async function requestMoreSubmissionData(id: string, message: string, actor: ApiActor): Promise<PatientSubmission> {
  const res = await fetch(`${API}/submissions/${id}/request-more-data`, {
    method: "POST",
    headers: { ...actorHeaders(actor), "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  return jsonOrThrow<PatientSubmission>(res, "Could not request more data");
}

export async function linkSubmissionCase(id: string, caseId: string, actor: ApiActor): Promise<PatientSubmission> {
  const res = await fetch(`${API}/submissions/${id}/link-case`, {
    method: "POST",
    headers: { ...actorHeaders(actor), "Content-Type": "application/json" },
    body: JSON.stringify({ case_id: caseId }),
  });
  return jsonOrThrow<PatientSubmission>(res, "Could not link case");
}

export async function completeSubmissionReview(id: string, caseId: string, actor: ApiActor): Promise<PatientSubmission> {
  const res = await fetch(`${API}/submissions/${id}/complete-review`, {
    method: "POST",
    headers: { ...actorHeaders(actor), "Content-Type": "application/json" },
    body: JSON.stringify({ case_id: caseId }),
  });
  return jsonOrThrow<PatientSubmission>(res, "Could not complete review");
}

export async function releaseSubmissionToPatient(input: {
  submissionId: string;
  caseId: string;
  patientSummary: PatientSummary;
  letterMarkdown: string;
  visitRecommendation: VisitRecommendation;
}, actor: ApiActor): Promise<PatientSubmission> {
  const res = await fetch(`${API}/submissions/${input.submissionId}/release`, {
    method: "POST",
    headers: { ...actorHeaders(actor), "Content-Type": "application/json" },
    body: JSON.stringify({
      case_id: input.caseId,
      patient_summary: input.patientSummary,
      letter_markdown: input.letterMarkdown,
      visit_recommendation: input.visitRecommendation,
    }),
  });
  return jsonOrThrow<PatientSubmission>(res, "Could not release patient report");
}

export async function downloadSubmissionFile(id: string, kind: "photo" | "lab", fileName: string, actor: ApiActor): Promise<File> {
  const res = await fetch(`${API}/submissions/${id}/files/${kind}`, { headers: actorHeaders(actor), cache: "no-store" });
  if (!res.ok) throw new Error("Could not load evidence file");
  const blob = await res.blob();
  return new File([blob], fileName, { type: blob.type || "application/octet-stream" });
}

export async function saveCaseRemote(caseData: CaseData, actor: ApiActor, submissionId?: string): Promise<CaseData> {
  const res = await fetch(`${API}/cases`, {
    method: "POST",
    headers: { ...actorHeaders(actor), "Content-Type": "application/json" },
    body: JSON.stringify({ case_data: caseData, submission_id: submissionId }),
  });
  return jsonOrThrow<CaseData>(res, "Could not save case");
}

export async function updateCaseRemote(caseData: CaseData, actor: ApiActor, submissionId?: string): Promise<CaseData> {
  const res = await fetch(`${API}/cases/${caseData.id}`, {
    method: "PATCH",
    headers: { ...actorHeaders(actor), "Content-Type": "application/json" },
    body: JSON.stringify({ case_data: caseData, submission_id: submissionId }),
  });
  return jsonOrThrow<CaseData>(res, "Could not update case");
}

export async function getCasesRemote(actor: ApiActor): Promise<CaseData[]> {
  const res = await apiFetch(`${API}/cases`, { headers: actorHeaders(actor), cache: "no-store" });
  return jsonOrThrow<CaseData[]>(res, "Could not load cases");
}

export async function getCaseRemote(id: string, actor: ApiActor): Promise<CaseData> {
  const retryableStatuses = new Set([404, 408, 429, 500, 502, 503, 504]);
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const res = await apiFetch(`${API}/cases/${id}`, { headers: actorHeaders(actor), cache: "no-store" });
      if (res.ok) return res.json();
      if (!retryableStatuses.has(res.status) || attempt === 3) {
        return jsonOrThrow<CaseData>(res, "Could not load case");
      }
    } catch (error) {
      lastError = error;
      if (attempt === 3) throw error;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 300 * (attempt + 1)));
  }
  throw lastError instanceof Error ? lastError : new Error("Could not load case");
}

export async function deleteCaseRemote(id: string, actor: ApiActor): Promise<void> {
  const res = await apiFetch(`${API}/cases/${id}`, {
    method: "DELETE",
    headers: actorHeaders(actor),
  });
  if (res.status === 404) return;
  await jsonOrThrow<{ ok: boolean }>(res, "Could not delete case");
}

export function summarizeCases(cases: CaseData[]): StoredCaseSummary[] {
  return cases.map(caseToSummary);
}

export function reconcileCaseStorage(cases: CaseData[]): StoredCaseSummary[] {
  const remoteSummaries = summarizeCases(cases);
  if (typeof window === "undefined") return remoteSummaries;

  const remoteIds = new Set(remoteSummaries.map((summary) => summary.id));
  for (const localSummary of getCaseSummaries()) {
    if (!remoteIds.has(localSummary.id)) {
      recentCases.delete(localSummary.id);
      try {
        localStorage.removeItem(`lumina_case_${localSummary.id}`);
      } catch {
        // Continue with the authoritative server list if storage is unavailable.
      }
    }
  }
  try {
    localStorage.setItem("lumina_cases", JSON.stringify(remoteSummaries));
  } catch {
    // Accurate server-backed UI does not depend on the optional browser cache.
  }
  return remoteSummaries;
}

export async function submitNotes(notes: string): Promise<HPOTerm[]> {
  const res = await fetch(apiUrl("/intake/text"), {
    method: "POST",
    headers: clinicalHeaders("application/json"),
    body: JSON.stringify({ notes }),
  });
  if (!res.ok) throw await extractionError(res, "Notes extraction failed");
  return res.json();
}

export async function suggestNotes(notes: string): Promise<HPOTerm[]> {
  const res = await fetch(apiUrl("/intake/text/suggest"), {
    method: "POST",
    headers: clinicalHeaders("application/json"),
    body: JSON.stringify({ notes }),
  });
  if (!res.ok) throw await extractionError(res, "Notes suggestion failed");
  return res.json();
}

export async function submitPhoto(file: File, facial = false): Promise<HPOTerm[]> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(apiUrl(`/intake/photo?facial=${facial}`), { method: "POST", headers: clinicalHeaders(), body: form });
  if (!res.ok) throw await extractionError(res, "Photo extraction failed");
  return res.json();
}

export async function suggestPhoto(file: File, facial = false): Promise<HPOTerm[]> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(apiUrl(`/intake/photo/suggest?facial=${facial}`), { method: "POST", headers: clinicalHeaders(), body: form });
  if (!res.ok) throw await extractionError(res, "Photo suggestion failed");
  return res.json();
}

export async function submitLab(file: File): Promise<HPOTerm[]> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API}/intake/lab`, { method: "POST", headers: clinicalHeaders(), body: form });
  if (!res.ok) throw await extractionError(res, "Lab extraction failed");
  return res.json();
}

export async function suggestLab(file: File): Promise<HPOTerm[]> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API}/intake/lab/suggest`, { method: "POST", headers: clinicalHeaders(), body: form });
  if (!res.ok) throw await extractionError(res, "Lab suggestion failed");
  return res.json();
}

export async function submitVcf(file: File): Promise<HPOTerm[]> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API}/intake/vcf`, { method: "POST", headers: clinicalHeaders(), body: form });
  if (!res.ok) throw await extractionError(res, "VCF extraction failed");
  return res.json();
}

export async function scoreCase(terms: HPOTerm[], topK = 10, modalities = 1, geneticEvidence: GeneticEvidence[] = []): Promise<RankResult[]> {
  const res = await fetch(`${API}/score`, {
    method: "POST",
    headers: clinicalHeaders("application/json"),
    body: JSON.stringify({ terms, top_k: topK, modalities, genetic_evidence: geneticEvidence }),
  });
  if (!res.ok) throw await extractionError(res, "Scoring failed");
  return res.json();
}

export interface AgentSuggestion {
  modality: string;
  reasoning: string;
  cycles_remaining: number;
}

export async function getAgentSuggestion(
  top5: RankResult[],
  modalitiesUsed: string[],
  cycle = 0,
  lang = "en"
): Promise<AgentSuggestion> {
  const res = await fetch(`${API}/agent/next`, {
    method: "POST",
    headers: clinicalHeaders("application/json"),
    body: JSON.stringify({ top5, modalities_used: modalitiesUsed, cycle, lang }),
  });
  if (!res.ok) throw new Error("Agent suggestion failed");
  return res.json();
}

export async function* streamLetter(
  caseData: CaseData,
  lang = "en",
  options?: Partial<PatientContext> & {
    to?: string;
    from?: string;
    letterLengthPreference?: "shorter" | "fuller";
  }
): AsyncGenerator<string> {
  let doctorProfile = {};
  if (typeof window !== "undefined") {
    try {
      doctorProfile = JSON.parse(localStorage.getItem("lumina_doc_info") ?? localStorage.getItem("lumina_doctor_profile") ?? "{}");
    } catch {}
  }
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 90_000);
  try {
    const res = await fetch(`${API}/agent/letter`, {
      method: "POST",
      headers: clinicalHeaders("application/json"),
      signal: controller.signal,
      body: JSON.stringify({
        top5: caseData.rankings.slice(0, 10),
        evidence: { hpo_terms: caseData.hpoTerms, modalities: caseData.modalities },
        patient_context: { ...(caseData.patientContext ?? {}), doctorProfile, ...options },
        length_preference: options?.letterLengthPreference,
        lang,
      }),
    });
    if (!res.ok || !res.body) throw await extractionError(res, "Letter generation failed");
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") return;
        try {
          yield JSON.parse(data).text as string;
        } catch {}
      }
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Letter generation timed out. Please try again.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function generatePatientSummary(
  caseData: CaseData,
  visitRecommendation: VisitRecommendation,
  lang = "en"
): Promise<PatientSummary> {
  const res = await fetch(`${API}/agent/patient-summary`, {
    method: "POST",
    headers: clinicalHeaders("application/json"),
    body: JSON.stringify({ case_data: caseData, visit_recommendation: visitRecommendation, lang }),
  });
  return jsonOrThrow<PatientSummary>(res, "Could not generate patient summary");
}

export function saveCaseToStorage(caseData: CaseData): void {
  if (typeof window === "undefined") return;
  const normalizedCase: CaseData = {
    ...caseData,
    outcome: caseData.outcome ?? defaultCaseOutcome(caseData),
  };
  recentCases.set(normalizedCase.id, normalizedCase);
  try {
    localStorage.setItem(`lumina_case_${caseData.id}`, JSON.stringify(normalizedCase));
  } catch {
    // The in-memory copy still carries a newly scored case across client navigation.
  }
  const summaries = getCaseSummaries();
  const summary: StoredCaseSummary = {
    id: normalizedCase.id,
    timestamp: normalizedCase.timestamp,
    topDiagnosis: normalizedCase.rankings[0]?.name ?? "Unknown",
    confidence: normalizedCase.rankings[0]?.confidence ?? 0,
    modalities: normalizedCase.modalities,
    hpoCount: normalizedCase.hpoTerms.length,
    patientName: normalizedCase.patientContext?.patientName,
    status: normalizedCase.outcome ?? "pending",
    hasLetter: Boolean(normalizedCase.referralLetterDraft?.trim()),
  };
  summaries.unshift(summary);
  try {
    localStorage.setItem("lumina_cases", JSON.stringify(summaries.slice(0, 50)));
  } catch {
    // A full local cache must never block navigation to the freshly scored case.
  }
}

export function getCaseSummaries(): StoredCaseSummary[] {
  if (typeof window === "undefined") return [];
  try {
    const summaries = JSON.parse(localStorage.getItem("lumina_cases") ?? "[]") as StoredCaseSummary[];
    return summaries.map((summary) => ({
      ...summary,
      status: normalizeCaseOutcome(summary.status),
    }));
  } catch {
    return [];
  }
}

export function getCaseById(id: string): CaseData | null {
  if (typeof window === "undefined") return null;
  const recentCase = recentCases.get(id);
  if (recentCase) return recentCase;
  try {
    return JSON.parse(localStorage.getItem(`lumina_case_${id}`) ?? "null");
  } catch {
    return null;
  }
}

export function updateCaseInStorage(caseId: string, updated: CaseData): void {
  if (typeof window === "undefined") return;
  const summaries = getCaseSummaries();
  const existingStatus = summaries.find((s: CaseSummary) => s.id === caseId)?.status;
  const normalizedCase: CaseData = {
    ...updated,
    outcome: normalizeCaseOutcome(updated.outcome ?? existingStatus),
  };
  recentCases.set(caseId, normalizedCase);
  try {
    localStorage.setItem(`lumina_case_${caseId}`, JSON.stringify(normalizedCase));
  } catch {
    // Keep the current result available even when persistent browser storage is full.
  }
  const idx = summaries.findIndex((s: CaseSummary) => s.id === caseId);
  const summary: StoredCaseSummary = {
    id: normalizedCase.id,
    timestamp: normalizedCase.timestamp,
    topDiagnosis: normalizedCase.rankings[0]?.name ?? "Unknown",
    confidence: normalizedCase.rankings[0]?.confidence ?? 0,
    modalities: normalizedCase.modalities,
    hpoCount: normalizedCase.hpoTerms.length,
    patientName: normalizedCase.patientContext?.patientName,
    status: normalizedCase.outcome ?? "pending",
    hasLetter: Boolean(normalizedCase.referralLetterDraft?.trim()),
  };
  if (idx >= 0) summaries[idx] = summary;
  else summaries.unshift(summary);
  try {
    localStorage.setItem("lumina_cases", JSON.stringify(summaries.slice(0, 50)));
  } catch {
    // The current in-memory case remains usable even if the summary cache is full.
  }
}

export function deleteCaseFromStorage(caseId: string): void {
  if (typeof window === "undefined") return;
  recentCases.delete(caseId);
  localStorage.removeItem(`lumina_case_${caseId}`);
  const summaries = getCaseSummaries().filter((summary) => summary.id !== caseId);
  localStorage.setItem("lumina_cases", JSON.stringify(summaries));
}

export function exportAllCases(): void {
  if (typeof window === "undefined") return;
  const summaries = getCaseSummaries();
  const full = summaries.map((summary: StoredCaseSummary) => {
    try {
      const caseData = JSON.parse(localStorage.getItem(`lumina_case_${summary.id}`) ?? "null") as CaseData | null;
      if (!caseData) return summary;
      return {
        ...caseData,
        outcome: normalizeCaseOutcome(caseData.outcome ?? summary.status),
      };
    } catch {
      return summary;
    }
  }).filter(Boolean);
  const blob = new Blob([JSON.stringify(full, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lumina_cases_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function normalizeCaseOutcome(outcome?: string | null): CaseOutcome {
  if (outcome === "confirmed" || outcome === "ruled_out" || outcome === "pending") return outcome;
  return "pending";
}

function defaultCaseOutcome(caseData: Pick<CaseData, "sourceSubmissionId">): CaseOutcome {
  return caseData.sourceSubmissionId ? "pending" : "confirmed";
}

export function savePatientSubmission(submission: PatientSubmission): void {
  if (typeof window === "undefined") return;
  const submissions = getPatientSubmissions();
  localStorage.setItem("lumina_patient_submissions", JSON.stringify([submission, ...submissions].slice(0, 50)));
}

export function getPatientSubmissions(): PatientSubmission[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("lumina_patient_submissions") ?? "[]") as PatientSubmission[];
  } catch {
    return [];
  }
}

export function getPatientSubmissionById(id: string): PatientSubmission | null {
  return getPatientSubmissions().find((submission) => submission.id === id) ?? null;
}

export function updatePatientSubmission(id: string, patch: Partial<PatientSubmission>): void {
  if (typeof window === "undefined") return;
  const submissions = getPatientSubmissions();
  localStorage.setItem(
    "lumina_patient_submissions",
    JSON.stringify(submissions.map((submission) => submission.id === id ? { ...submission, ...patch } : submission))
  );
}

export function deletePatientSubmissionFromStorage(id: string): void {
  if (typeof window === "undefined") return;
  const submissions = getPatientSubmissions().filter((submission) => submission.id !== id);
  localStorage.setItem("lumina_patient_submissions", JSON.stringify(submissions));
}
