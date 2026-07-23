export function formatNumber(locale: string, value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatFileSize(locale: string, bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
  return new Intl.NumberFormat(locale).format(val) + " " + sizes[i];
}

export function formatDateTime(locale: string, date: Date | string | number, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale, options || {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export function formatConfidence(locale: string, score: number): string {
  if (score >= 0.8) return "High";
  if (score >= 0.5) return "Medium";
  return "Review";
}