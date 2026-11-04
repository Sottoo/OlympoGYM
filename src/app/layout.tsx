import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const nombreGimnasio = process.env.NEXT_PUBLIC_NOMBRE_GIMNASIO ?? "Olimpo GYM";

// Las fuentes viven dentro del proyecto (src/app/fuentes): el programa abre con
// su tipografía aunque no haya internet. Las dos son de licencia libre (OFL).
// · Archivo: el texto de todos los días. Es variable (peso y ancho).
// · Marcellus: títulos, nombres y cifras. Sus mayúsculas recuerdan las letras
//   bordadas del logo de Olimpo.
const texto = localFont({
  src: "./fuentes/archivo.woff2",
  variable: "--fuente-texto",
  weight: "100 900",
  display: "swap",
  declarations: [{ prop: "font-stretch", value: "62% 125%" }],
});
const titulos = localFont({ src: "./fuentes/marcellus.woff2", variable: "--fuente-titulos", weight: "400", display: "swap" });
// El cero de Marcellus es redondo como una "O" ($0 se leía "$O"). Solo ese
// carácter se toma de Archivo, delgado y un poco condensado, para que case.
const cero = localFont({
  src: "./fuentes/archivo.woff2",
  variable: "--fuente-cero",
  weight: "100 900",
  display: "swap",
  declarations: [
    { prop: "unicode-range", value: "U+0030" },
    { prop: "font-stretch", value: "62% 125%" },
  ],
});

export const metadata: Metadata = {
  title: { default: nombreGimnasio, template: `%s · ${nombreGimnasio}` },
  description: "Recepción, socios, asistencias, ventas e inventario",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${texto.variable} ${titulos.variable} ${cero.variable}`}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
