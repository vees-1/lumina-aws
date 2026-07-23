import { z } from "zod";

export const DiseaseDetailSchema = z.object({
  orpha_code: z.string(),
  name: z.string(),
  definition: z.string().nullable(),
  icd10: z.array(z.string()),
  omim: z.array(z.string()),
  phenotypes: z.array(z.record(z.unknown())),
  genes: z.array(z.record(z.unknown())),
  prevalence: z.array(z.record(z.unknown())),
});

export type DiseaseDetail = z.infer<typeof DiseaseDetailSchema>;
