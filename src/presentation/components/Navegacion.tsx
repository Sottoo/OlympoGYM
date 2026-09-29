"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icono, type NombreIcono } from "./Icono";

const GRUPOS: { titulo: string; enlaces: { href: string; texto: string; icono: NombreIcono }[] }[] = [
  {
    titulo: "Operación",
    enlaces: [
      { href: "/panel", texto: "Resumen", icono: "resumen" },
      { href: "/avisos", texto: "Avisos", icono: "avisos" },
      { href: "/socios", texto: "Socios", icono: "socios" },
      { href: "/ventas", texto: "Ventas", icono: "ventas" },
    ],
  },
  {
    titulo: "Catálogo",
    enlaces: [
      { href: "/inventario", texto: "Inventario", icono: "inventario" },
      { href: "/planes", texto: "Planes", icono: "planes" },
    ],
  },
];

/** `avisosPendientes` pinta un contador junto a "Avisos" para que no se olviden. */
export function Navegacion({ avisosPendientes = 0 }: { avisosPendientes?: number }) {
  const ruta = usePathname();
  return (
    <nav aria-label="Secciones" className="flex gap-1 lg:flex-col lg:gap-6">
      {GRUPOS.map((grupo) => (
        <div key={grupo.titulo} className="contents lg:block">
          <p className="mb-2 hidden px-3 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-white/35 lg:block">
            {grupo.titulo}
          </p>
          <ul className="contents lg:flex lg:flex-col lg:gap-0.5">
            {grupo.enlaces.map(({ href, texto, icono }) => {
              const activo = ruta === href || ruta.startsWith(`${href}/`);
              return (
                <li key={href} className="contents lg:block">
                  <Link
                    href={href}
                    aria-current={activo ? "page" : undefined}
                    className={`relative flex items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2 text-[0.95rem] font-medium transition-colors ${
                      activo ? "bg-white/[0.08] text-white" : "text-white/60 hover:bg-white/[0.04] hover:text-white"
                    }`}
                  >
                    {activo && <span aria-hidden className="absolute inset-x-3 -bottom-px h-0.5 bg-rojo lg:inset-x-auto lg:inset-y-2 lg:left-0 lg:h-auto lg:w-0.5" />}
                    <Icono nombre={icono} className={`size-[18px] ${activo ? "text-rojo" : ""}`} />
                    {texto}
                    {href === "/avisos" && avisosPendientes > 0 && (
                      <span className="ml-auto grid min-w-5 place-items-center rounded-full bg-rojo px-1.5 text-[0.72rem] font-bold leading-5 text-white tabular-nums">
                        {avisosPendientes}
                        <span className="sr-only"> pendientes</span>
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
