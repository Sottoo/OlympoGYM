"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Icono, type NombreIcono } from "./Icono";

/** Orden = frecuencia de uso en recepción. Lo de consulta ocasional va abajo, aparte. */
const PRINCIPALES: { href: string; texto: string; icono: NombreIcono }[] = [
  { href: "/panel", texto: "Hoy", icono: "hoy" },
  { href: "/asistencias", texto: "Entradas", icono: "entradas" },
  { href: "/socios", texto: "Socios", icono: "socios" },
  { href: "/ventas", texto: "Tienda", icono: "ventas" },
  { href: "/inventario", texto: "Inventario", icono: "inventario" },
  { href: "/mantenimiento", texto: "Mantenimiento", icono: "llave" },
  { href: "/planes", texto: "Planes", icono: "planes" },
  { href: "/metricas", texto: "Métricas", icono: "metricas" },
];
const ADMINISTRACION: { href: string; texto: string; icono: NombreIcono }[] = [
  { href: "/personal", texto: "Personal", icono: "usuario" },
  { href: "/bitacora", texto: "Bitácora", icono: "bitacora" },
  { href: "/respaldos", texto: "Respaldos", icono: "respaldos" },
];

const esActiva = (ruta: string, href: string) => ruta === href || ruta.startsWith(`${href}/`);

/**
 * Menú del riel negro, en mayúsculas espaciadas como las letras bordadas.
 * La sección activa lleva una costura punteada alrededor.
 */
export function Navegacion({ ocultas = [] }: { /** Secciones que el perfil no puede abrir. */ ocultas?: string[] }) {
  const ruta = usePathname();
  const visibles = (lista: typeof PRINCIPALES) => lista.filter((e) => !ocultas.includes(e.href));
  const administracion = visibles(ADMINISTRACION);
  return (
    <nav aria-label="Secciones" className="grid gap-[3px]">
      {visibles(PRINCIPALES).map((e) => (
        <Enlace key={e.href} {...e} activo={esActiva(ruta, e.href)} />
      ))}
      {administracion.length > 0 && <p className="mt-5 [@media(max-height:780px)]:mt-3 px-3.5 pb-1 text-[0.62rem] font-bold tracking-[0.2em] text-white/50">ADMINISTRACIÓN</p>}
      {administracion.map((e) => (
        <Enlace key={e.href} {...e} activo={esActiva(ruta, e.href)} chico />
      ))}
    </nav>
  );
}

function Enlace({
  href,
  texto,
  icono,
  activo,
  chico = false,
}: {
  href: string;
  texto: string;
  icono: NombreIcono;
  activo: boolean;
  chico?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={activo ? "page" : undefined}
      className={`group flex items-center gap-3 rounded-[10px] px-2.5 font-semibold uppercase tracking-[0.07em] ${chico ? "py-[3px] text-[0.74rem]" : "py-[5px] text-[0.84rem] [@media(max-height:780px)]:py-[3px]"} ${
        activo ? "bg-white/[0.07] text-white outline-[1.5px] -outline-offset-[3px] outline-dashed outline-white/45" : "text-[#f2efe8]/70 hover:bg-white/[0.05] hover:text-white"
      }`}
    >
      <Pendiente icono={icono} activo={activo} chico={chico} />
      {texto}
    </Link>
  );
}

/**
 * El ícono va en su ojal cosido; el de la sección activa se borda en hilo
 * rojo, como el logo. Mientras carga la sección elegida, late.
 */
function Pendiente({ icono, activo, chico }: { icono: NombreIcono; activo: boolean; chico: boolean }) {
  const { pending } = useLinkStatus();
  return (
    <span
      className={`ojal-menu grid shrink-0 place-items-center rounded-full ${chico ? "size-7 [@media(max-height:700px)]:size-6" : "size-[31px] [@media(max-height:780px)]:size-7"} ${
        activo ? "ojal-activo text-white" : "text-[#f2efe8]/75 group-hover:text-white"
      } ${pending ? "animate-pulse" : ""}`}
    >
      <Icono nombre={icono} className={chico ? "size-[16px]" : "size-[19px]"} />
    </span>
  );
}
