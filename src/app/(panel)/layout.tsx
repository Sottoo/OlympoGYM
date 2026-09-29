import Link from "next/link";
import { redirect } from "next/navigation";
import { entorno, modoDemo, obtenerAcceso } from "@/infrastructure/auth/autenticacion";
import { casosDeUso } from "@/infrastructure/contenedor";
import { Icono } from "@/presentation/components/Icono";
import { Logo } from "@/presentation/components/Logo";
import { Navegacion } from "@/presentation/components/Navegacion";
import { accionCerrarSesion } from "./acciones";
import { RespaldoAutomatico } from "./RespaldoAutomatico";

export default async function LayoutPanel({ children }: { children: React.ReactNode }) {
  const acceso = await obtenerAcceso();
  if (acceso.tipo === "sin_sesion") redirect("/login");

  if (acceso.tipo === "sin_permiso") {
    return (
      <main className="mx-auto max-w-lg px-6 py-24">
        <h1 className="titulo mb-3">Tu cuenta aún no tiene acceso</h1>
        <p className="mb-6 text-gris">
          Iniciaste sesión como {acceso.email}, pero esa cuenta no está registrada como personal del gimnasio. Pide al
          administrador que te agregue.
        </p>
        <form action={accionCerrarSesion}>
          <button className="boton-secundario">Cerrar sesión</button>
        </form>
      </main>
    );
  }

  const { personal } = acceso;
  const avisosPendientes = (await (await casosDeUso()).obtenerAvisosPendientes.ejecutar()).length;
  const iniciales = personal.nombre
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
      <aside className="bg-carbon text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="flex h-14 items-center px-4 lg:h-16 lg:px-5">
          <Link href="/panel" aria-label={`${entorno.nombreGimnasio}, ir al resumen`}>
            <Logo nombre={entorno.nombreGimnasio} />
          </Link>
        </div>
        <div className="overflow-x-auto border-t border-white/[0.07] px-2 py-2 lg:px-3 lg:py-6">
          <Navegacion avisosPendientes={avisosPendientes} />
        </div>
        <div className="mt-auto hidden border-t border-white/[0.07] p-4 lg:block">
          <div className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-carbon-claro text-sm font-semibold text-white/80 ring-1 ring-white/10">
              {iniciales}
            </span>
            <div className="min-w-0 text-sm">
              <p className="truncate font-semibold">{personal.nombre}</p>
              <p className="truncate text-white/45">{personal.rol === "administrador" ? "Administrador" : "Recepción"}</p>
            </div>
            {!modoDemo && (
              <form action={accionCerrarSesion} className="ml-auto">
                <button className="rounded p-1.5 text-white/50 hover:bg-white/[0.06] hover:text-white" title="Cerrar sesión">
                  <Icono nombre="salir" />
                  <span className="sr-only">Cerrar sesión</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        {modoDemo && (
          <p className="flex items-center gap-2 border-b border-linea bg-superficie px-4 py-2 text-[0.85rem] text-gris sm:px-8">
            <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-ambar" />
            <span>
              <strong className="font-semibold text-tinta">Modo demo.</strong> Datos de ejemplo que se borran al cerrar el
              programa. Configura Supabase en <code className="text-tinta">.env.local</code> para usar datos reales.
            </span>
          </p>
        )}
        <main className="mx-auto max-w-[76rem] px-4 py-7 sm:px-8 lg:py-10">{children}</main>
      </div>
      <RespaldoAutomatico />
    </div>
  );
}
