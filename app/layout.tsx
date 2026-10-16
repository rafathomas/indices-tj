import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Índices TJSP",
  description: "Monitoramento mensal dos índices judiciais publicados pelo TJSP.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
