import { z } from "zod";
import { HPOTermSchema } from "./hpo";

export const RankTermContextSchema = z.object({
  hpo_id: z.string(),
  label: z.string(),
  frequency: z.number().nullable().optional(),
  patient_confidence: z.number().nullable().optional(),
  source: z.string().nullable().optional(),
  assertion: z.enum(["present", "absent"]).nullable().optional(),
  matched_hpo_id: z.string().nullable().optional(),
  matched_label: z.string().nullable().optional(),
});

export const RankedDiseaseSchema = z.object({
  orpha_code: z.string(),
  name: z.string(),
  confidence: z.number().min(0).max(1),
  icd10: z.string().nullable(),
  contributing_terms: z.array(z.string()),
  missing_terms: z.array(z.string()).optional(),
  distinguishing_terms: z.array(z.string()).optional(),
  contributing_term_details: z.array(RankTermContextSchema).optional(),
  missing_term_details: z.array(RankTermContextSchema).optional(),
  distinguishing_term_details: z.array(RankTermContextSchema).optional(),
});

export type RankedDisease = z.infer<typeof RankedDiseaseSchema>;

export const ScoreRequestSchema = z.object({
  terms: z.array(HPOTermSchema),
  age_range: z.string().optional(),
  sex: z.enum(["male", "female", "unknown"]).optional(),
  inheritance: z.string().optional(),
});

export type ScoreRequest = z.infer<typeof ScoreRequestSchema>;

export const AgentSuggestionSchema = z.object({
  modality: z.string(),
  reasoning: z.string(),
  cycles_remaining: z.number(),
});

export type AgentSuggestion = z.infer<typeof AgentSuggestionSchema>;
