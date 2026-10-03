"use client";

export function PrintButton() {
  return (
    <button className="primary-button qr-print-button" type="button" onClick={() => window.print()}>
      Imprimir QR Code
    </button>
  );
}
