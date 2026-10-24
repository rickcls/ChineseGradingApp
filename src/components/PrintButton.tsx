"use client";

export function PrintButton({ label = "列印／下載 PDF" }: { label?: string }) {
  return (
    <button type="button" className="btn-primary" onClick={() => window.print()}>
      {label}
    </button>
  );
}
