import { entorno } from "@/infrastructure/config/entorno";
import { LogoBordado, MarcaOlimpo } from "@/presentation/components/Logo";

/**
 * Marco común de las pantallas de entrada. A la izquierda, la playera negra
 * con el logo bordado al centro; a la derecha, el formulario en una hoja
 * cruda con su costura.
 */
export function MarcoDeEntrada({ titulo, descripcion, children }: { titulo: string; descripcion: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section
        aria-hidden
        className="relative hidden place-items-center overflow-hidden bg-carbon text-[#f2efe8] lg:grid after:pointer-events-none after:absolute after:inset-y-3 after:right-[9px] after:border-r-[1.5px] after:border-dashed after:border-white/25"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgb(255 255 255 / 0.025) 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, rgb(255 255 255 / 0.02) 0 1px, transparent 1px 3px)",
        }}
      >
        <div className="grid justify-items-center gap-8">
          <LogoBordado ancho={300} />
          <p className="text-[0.78rem] font-bold tracking-[0.3em] text-white/50">RECEPCIÓN · SOCIOS · ENTRADAS</p>
        </div>
      </section>

      <section className="flex flex-col px-6 py-10 sm:px-14 lg:px-20">
        <div className="flex items-center gap-3 lg:hidden">
          <MarcaOlimpo className="size-10" />
          <span className="font-titulos text-[1.3rem] tracking-[0.18em]">{entorno.nombreGimnasio.toUpperCase()}</span>
        </div>
        <div className="pantalla my-auto w-full max-w-[26rem] py-10">
          <p className="rotulo">Acceso del personal</p>
          <h1 className="titulo mt-2 !text-[2.7rem]">{titulo}</h1>
          <p className="mb-7 mt-2 text-tinta-suave">{descripcion}</p>
          <div className="panel px-7 py-7">{children}</div>
        </div>
        <p className="text-[0.76rem] text-gris">
          {entorno.nombreGimnasio} · <span className="font-semibold text-tinta-suave">versión {entorno.versionPrograma}</span>
        </p>
      </section>
    </main>
  );
}
