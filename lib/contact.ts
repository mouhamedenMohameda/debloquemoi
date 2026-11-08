// Numéro WhatsApp du support (format international sans "+" ni "0" initial).
// Aligné sur le web (Bac/app/src/lib/contact.ts).
// +33 06 56 69 69 74 → 33656696974
export const SUPPORT_WHATSAPP = "33656696974";

export function whatsappContactUrl(message: string): string {
  return `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(message)}`;
}
