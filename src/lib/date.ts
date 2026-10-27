/**
 * Helper pemformatan tanggal yang aman dari RangeError / Invalid Date
 * untuk lingkungan serverless Next.js dan SSR.
 */

export function safeFormatDate(
  dateInput: Date | string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateInput) return "-";
  try {
    const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString(
      "id-ID",
      options || { day: "numeric", month: "short", year: "numeric" }
    );
  } catch {
    return "-";
  }
}

export function safeMonthShort(dateInput: Date | string | null | undefined): string {
  if (!dateInput) return "BLN";
  try {
    const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return "BLN";
    return d.toLocaleDateString("id-ID", { month: "short" });
  } catch {
    return "BLN";
  }
}

export function safeDayNumber(dateInput: Date | string | null | undefined): string | number {
  if (!dateInput) return "-";
  try {
    const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return "-";
    return d.getDate();
  } catch {
    return "-";
  }
}
