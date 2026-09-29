import type { Metadata } from "next";
import Link from "next/link";
import { entorno, modoDemo } from "@/infrastructure/config/entorno";
import { Logo, MarcaOlimpo } from "@/presentation/components/Logo";
import { FormularioLogin } from "./FormularioLogin";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default function PaginaLogin() {
  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,32rem)]">
      <section className="relative hidden overflow-hidden bg-carbon p-12 text-white lg:flex lg:flex-col">
        <Logo nombre={entorno.nombreGimnasio} />
        {/* La marca, grande y recortada por el borde: un solo gesto gráfico. */}
        <MarcaOlimpo className="pointer-events-none absolute -bottom-24 -right-24 size-[34rem] opacity-[0.14]" />
        <div className="mt-auto max-w-md">
          <p className="font-display text-5xl font-bold uppercase leading-[0.95]">Administración del gimnasio</p>
          <p className="mt-4 text-lg text-white/60">Socios, membresías, ventas de mostrador e inventario.</p>
        </div>
      </section>

      <section className="flex items-center px-6 py-16 sm:px-12">
        <div className="w-full max-w-sm">
          <div className="mb-10 rounded-md bg-carbon px-4 py-3 text-white lg:hidden">
            <Logo nombre={entorno.nombreGimnasio} />
          </div>
          <h1 className="titulo mb-2">Iniciar sesión</h1>
          <p className="mb-8 text-gris">Acceso exclusivo para el personal.</p>
          {modoDemo ? (
            <div className="space-y-5">
              <p className="rounded-md border border-linea bg-superficie px-4 py-3 text-[0.93rem]">
                Supabase aún no está configurado: la app funciona con datos de ejemplo y no pide contraseña.
              </p>
              <Link href="/panel" className="boton w-full">Entrar al modo demo</Link>
            </div>
          ) : (
            <FormularioLogin />
          )}
        </div>
      </section>
    </main>
  );
}
