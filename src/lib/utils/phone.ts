/**
 * Normalises phone numbers to E.164 (+381641234567) for wa.me links.
 * Serbian local formats (064..., 0038164...) are accepted; other countries need a leading +.
 */
export function normalizePhone(input: string | null | undefined, defaultCountryCode = "381"): string | null {
  if (!input) return null;
  let s = input.trim().replace(/[\s\-().\/]/g, "");
  if (s === "") return null;
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (!s.startsWith("+")) {
    if (s.startsWith("0")) s = "+" + defaultCountryCode + s.slice(1);
    else s = "+" + defaultCountryCode + s;
  }
  // Remove a trunk zero written after the country code, e.g. +381 (0)64...
  s = s.replace(/^\+381 ?0/, "+381");
  if (!/^\+[1-9]\d{6,14}$/.test(s)) return null;
  return s;
}

export function whatsappLink(e164: string | null | undefined, text?: string): string | null {
  if (!e164) return null;
  const digits = e164.replace(/^\+/, "");
  if (!/^[1-9]\d{6,14}$/.test(digits)) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const m = e164.match(/^\+381(\d{2})(\d{3})(\d{3,4})$/);
  if (m) return `+381 ${m[1]} ${m[2]} ${m[3]}`;
  return e164;
}
