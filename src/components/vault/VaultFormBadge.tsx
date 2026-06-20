"use client";

const FORM_CONFIG: Record<string, { label: string; dots: string; color: string; bg: string }> = {
  strong:  { label: "Strong",  dots: "\u25CF\u25CF\u25CF", color: "text-green-400",  bg: "bg-green-500/15" },
  mixed:   { label: "Mixed",   dots: "\u25CF\u25CF\u25CB", color: "text-amber-400",  bg: "bg-amber-500/15" },
  poor:    { label: "Poor",    dots: "\u25CF\u25CB\u25CB", color: "text-red-400",    bg: "bg-red-500/15" },
  unknown: { label: "Unknown", dots: "\u25CB\u25CB\u25CB", color: "text-gray-500",   bg: "bg-gray-500/15" },
};

export default function VaultFormBadge({ form }: { form: string | null }) {
  const conf = FORM_CONFIG[form ?? "unknown"] ?? FORM_CONFIG.unknown;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${conf.color} ${conf.bg}`}>
      <span className="tracking-tight">{conf.dots}</span>
      {conf.label}
    </span>
  );
}
