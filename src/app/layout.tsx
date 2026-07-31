import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#05060d",
};

export const metadata: Metadata = {
  title: "Faction Wars 2030 — Roguelike de Acción",
  description:
    "Roguelike de acción en el navegador. Oleadas de enemigos, armas con rarezas, power-ups y combos. 60fps en desktop y móvil.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>{children}</body>
    </html>
  );
}
