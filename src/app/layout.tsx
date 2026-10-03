import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Calori",
  description: "A experiência digital do seu restaurante.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
