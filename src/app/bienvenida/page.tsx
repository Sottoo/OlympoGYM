import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { codigoPorMostrar, olvidarCodigoMostrado, requerirSesion } from "@/infrastructure/auth/autenticacion";
import { BotonEnviar } from "@/presentation/components/BotonEnviar";
import { MarcoDeEntrada } from "../login/MarcoDeEntrada";

export const metadata: Metadata = { title: "Código de recuperación" };
export const dynamic = "force-dynamic";

async function continuar() {
  "use server";
  await olvidarCodigoMostrado();
  redirect("/panel");
}

/** Muestra una sola vez el código de recuperación recién creado. */
export default async function PaginaBienvenida({ searchParams }: { searchParams: Promise<{ recuperada?: string; nuevo?: string }> }) {
  await requerirSesion();
  const codigo = await codigoPorMostrar();
  if (!codigo) redirect("/panel");
  const { recuperada, nuevo } = await searchParams;
  const titulo = recuperada ? "Contraseña cambiada" : nuevo ? "Código nuevo" : "Tu cuenta está lista";
  const descripcion = recuperada
    ? "El código anterior ya no sirve. Este es tu código nuevo."
    : nuevo
      ? "El código anterior ya no sirve. Guarda este, que es el de tu cuenta."
      : "Antes de entrar, guarda tu código de recuperación.";

  return (
    <MarcoDeEntrada titulo={titulo} descripcion={descripcion}>
      <form action={continuar} className="aparece grid gap-5">
        <div className="rounded-[18px] border-2 border-dashed border-vino/40 bg-white p-5">
          <p className="rotulo mb-2 text-vino">Código de recuperación</p>
          <p className="dorsal select-all text-[1.5rem] tracking-[0.06em]">{codigo}</p>
        </div>
        <p className="text-[0.92rem] text-tinta-suave">
          <strong className="font-semibold text-vino">Anótalo y guárdalo en un lugar seguro.</strong> Es la única forma de entrar si se olvida la
          contraseña. No se volverá a mostrar.
        </p>
        <BotonEnviar textoEnviando="Entrando…" className="w-full py-3">Ya lo guardé, entrar</BotonEnviar>
      </form>
    </MarcoDeEntrada>
  );
}
