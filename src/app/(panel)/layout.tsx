import Link from "next/link";
import { redirect } from "next/navigation";
import { entorno, obtenerAcceso } from "@/infrastructure/auth/autenticacion";
import { Icono } from "@/presentation/components/Icono";
import { LogoBordado } from "@/presentation/components/Logo";
import { AtajoMostrador } from "@/presentation/components/AtajoMostrador";
import { Navegacion } from "@/presentation/components/Navegacion";
import { DefinicionesDeHilo } from "@/presentation/components/pictogramas/Pictograma";
import { accionCerrarSesion } from "./acciones";
import { programarRespaldoDiario } from "@/infrastructure/respaldo/respaldo";
import { PERMISO_DE_SECCION, puede, ROLES } from "@/domain/shared/permisos";

/**
 * El marco del panel: a la izquierda el riel negro (la playera, con el logo
 * bordado y una costura en la orilla) y a la derecha la mesa de trabajo.
 */
export default async function LayoutPanel({ children }: { children: React.ReactNode }) {
  const acceso = await obtenerAcceso();
  if (acceso.tipo === "sin_sesion") redirect("/login");

  const { personal } = acceso;
  // El respaldo del día se hace por detrás, sin hacer esperar a nadie.
  programarRespaldoDiario();
  // El menú no muestra lo que el perfil no puede abrir.
  const ocultas = Object.entries(PERMISO_DE_SECCION)
    .filter(([, permiso]) => permiso && !puede(personal.rol, permiso))
    .map(([ruta]) => ruta);

  return (
    <div className="grid min-h-screen grid-cols-[236px_minmax(0,1fr)]">
      <aside
        className="sticky top-0 flex h-screen flex-col gap-6 bg-carbon px-[18px] pb-5 pt-6 [@media(max-height:780px)]:gap-3 [@media(max-height:780px)]:pt-4 text-[#f2efe8] after:pointer-events-none after:absolute after:inset-y-2 after:right-[7px] after:border-r-[1.5px] after:border-dashed after:border-white/25"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgb(255 255 255 / 0.025) 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, rgb(255 255 255 / 0.02) 0 1px, transparent 1px 3px)",
        }}
      >
        <Link href="/panel" aria-label={`${entorno.nombreGimnasio}, ir a Hoy`} className="mx-auto block">
          {/* En ventanas bajitas el logo se achica para que quepa todo el menú. */}
          <LogoBordado ancho={124} className="h-auto [@media(max-height:780px)]:w-[76px]" />
        </Link>
        <div className="-mx-0.5 min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:rgb(255_255_255/0.25)_transparent]">
          <Navegacion ocultas={ocultas} />
        </div>
        <div className="flex items-center gap-2 border-t-[1.5px] border-dashed border-white/20 pt-4">
          <Link href="/cuenta" className="min-w-0 flex-1 rounded-[8px] text-[0.82rem] leading-snug text-[#f2efe8]/65 hover:text-white" title="Mi cuenta">
            <b className="block truncate text-[0.9rem] text-white">{personal.nombre.split(" ")[0]}</b>
            {ROLES[personal.rol].nombre}
          </Link>
          <form action={accionCerrarSesion}>
            <button className="grid size-9 place-items-center rounded-[9px] text-[#f2efe8]/60 hover:bg-white/[0.06] hover:text-white" title="Cerrar sesión">
              <Icono nombre="salir" className="size-[18px]" />
              <span className="sr-only">Cerrar sesión</span>
            </button>
          </form>
        </div>
      </aside>

      <main className="min-w-0 px-9 pb-12 pt-8">
        <div className="contenido">{children}</div>
      </main>
      <AtajoMostrador />
      <DefinicionesDeHilo />
    </div>
  );
}
