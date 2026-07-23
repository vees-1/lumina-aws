import { z } from "zod";

export const HPOTermSchema = z.object({
  hpo_id: z.string(),
  confidence: z.number().min(-1).max(1),
  source: z.string(),
  assertion: z.enum(["present", "absent"]).optional(),
  source_type: z
    .enum(["notes", "lab", "photo", "vcf", "text_panel", "unknown"])
    .optional(),
});

export type HPOTerm = z.infer<typeof HPOTermSchema>;
