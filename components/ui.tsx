import { COLORS } from "@/lib/constants";
import type { CSSProperties, ReactNode } from "react";

export const inputStyle: CSSProperties = {
  width: "100%",
  border: `1px solid ${COLORS.line}`,
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 14,
  background: "#fff",
  outline: "none",
};

export function Card({ children, style, id }: { children: ReactNode; style?: CSSProperties; id?: string }) {
  return (
    <div
      id={id}
      style={{ background: COLORS.creamCard, border: `1px solid ${COLORS.line}`, borderRadius: 14, ...style }}
      className="p-4 shadow-sm"
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div className="mb-3">
      <h2 style={{ fontFamily: "var(--font-fraunces)", color: COLORS.plumDark }} className="text-lg font-semibold">
        {children}
      </h2>
      {sub && <p className="text-xs mt-0.5" style={{ color: "#8A7A75" }}>{sub}</p>}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium block mb-1" style={{ color: "#7A6B66" }}>{label}</span>
      {children}
    </label>
  );
}

export function PrimaryButton({
  children,
  onClick,
  type = "button",
  full,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  full?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold transition-transform active:scale-95 disabled:opacity-50 ${full ? "w-full" : ""}`}
      style={{ background: COLORS.plum, color: "#fff" }}
    >
      {children}
    </button>
  );
}

export function Row({ label, val, bold, highlight }: { label: string; val: string; bold?: boolean; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ color: highlight ? COLORS.plumDark : "#6B5C57", fontWeight: bold || highlight ? 700 : 400 }}>{label}</span>
      <span style={{ color: highlight ? COLORS.plumDark : COLORS.ink, fontWeight: bold || highlight ? 700 : 500 }}>{val}</span>
    </div>
  );
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      className="fixed bottom-5 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-full text-sm font-medium shadow-lg z-50"
      style={{ background: COLORS.charcoal, color: COLORS.butter }}
    >
      {message}
    </div>
  );
}
