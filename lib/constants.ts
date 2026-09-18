// Paleta de marca UMAMI: navy marino, crema, marroncito, dorado.
// Sin rojo ni tonos vino (excepto el rojo suave reservado para "pendiente").
export const COLORS = {
  plum: "#1B2A4A",
  plumDark: "#101B33",
  charcoal: "#2B2320",
  butter: "#C9A24B",
  cream: "#F8F3EA",
  creamCard: "#FFFFFF",
  sage: "#6E8A70",
  sageBg: "#E9F0E7",
  blush: "#EFE3D2",
  ink: "#332A24",
  line: "#E4D8C6",
} as const;

export interface InvoiceTemplate {
  id: string;
  label: string;
  header: string;
  text: string;
  body: string;
}

export const TEMPLATES: InvoiceTemplate[] = [
  { id: "recetario", label: "Recetario", header: COLORS.plum, text: "#FFFFFF", body: "#FFF9F0" },
  { id: "moderno", label: "Moderno", header: "#FFFFFF", text: COLORS.plumDark, body: "#FFFFFF" },
  { id: "elegante", label: "Elegante", header: COLORS.charcoal, text: COLORS.butter, body: "#F8F3EA" },
  { id: "rustico", label: "Rústico", header: "#8B6A4F", text: "#FFF6E9", body: "#F3E6D3" },
];

export const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pendiente: { label: "Pendiente", color: "#B25C5C", bg: "#F6E3E1" },
  abonado: { label: "Abonado", color: "#A9822F", bg: "#FBF0D8" },
  pagado: { label: "Pagado", color: "#4E7A50", bg: "#E4F0E4" },
};

export const MONTH_NAMES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export const UNITS = ["g", "kg", "ml", "l", "unidad", "oz", "lb"];

export const uid = () => crypto.randomUUID();
