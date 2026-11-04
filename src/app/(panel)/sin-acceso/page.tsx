import type { Metadata } from "next";
import Link from "next/link";
import { PERMISOS, ROLES, type Permiso } from "@/domain/shared/permisos";
import { requerirSesion } from "@/infrastructure/auth/autenticacion";

export const metadata: Metadata = { title: "Sin acceso" };
export const dynamic = "force-dynamic";

/** A dónde llega quien abre una pantalla que su perfil no permite. */
export default async function SinAcceso({ searchParams }: { searchParams: Promise<{ para?: string }> }) {
  const yo = await requerirSesion();
  const { para } = await searchParams;
  const motivo = para && Object.hasOwn(PERMISOS, para) ? PERMISOS[para as Permiso] : "abrir esta sección";

  return (
    <section className="superficie mx-auto mt-10 max-w-xl px-8 py-10 text-center">
      <svg aria-hidden viewBox="0 0 64 64" className="mx-auto mb-5 size-16">
        <circle cx="32" cy="32" r="29" fill="none" stroke="var(--color-tinta)" strokeWidth="2" />
        <rect x="21" y="29" width="22" height="17" rx="3" fill="var(--color-tinta)" />
        <path d="M25 29v-5a7 7 0 0 1 14 0v5" fill="none" stroke="var(--color-tinta)" strokeWidth="3" />
        <circle cx="32" cy="37" r="2.4" fill="var(--color-hilo)" />
      </svg>
      <h1 className="titulo mb-3">Área solo para la administración</h1>
      <p className="text-tinta-suave">
        Tu perfil ({ROLES[yo.rol].nombre}) no permite {motivo}. Si lo necesitas, pídelo a quien administra el gimnasio.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link href="/panel" className="boton-oscuro">Volver a Hoy</Link>
        <Link href="/cuenta" className="boton-secundario">Mi cuenta</Link>
      </div>
    </section>
  );
}
