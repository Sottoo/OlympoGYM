import type { Metadata } from "next";
import "./globals.css";

const nombreGimnasio = process.env.NEXT_PUBLIC_NOMBRE_GIMNASIO ?? "Olimpo GYM";

export const metadata: Metadata = {
  title: { default: nombreGimnasio, template: `%s · ${nombreGimnasio}` },
  description: "Panel de administración: socios, membresías, ventas e inventario",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Barlow:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
