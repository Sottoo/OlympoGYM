import Link from "next/link";
import type { Parecido } from "@/application/use-cases/socios/Duplicados";
import { Icono } from "@/presentation/components/Icono";

/**
 * «Ya está inscrito»: aparece al inscribir cuando el celular o el nombre ya
 * son de alguien. Con el mismo celular no se puede seguir (se abre su ficha y
 * se le cobra ahí). Con el mismo nombre se puede, pero solo marcando que es
 * otra persona. Así nadie queda registrado dos veces.
 */
export function AvisoParecidos({ parecidos, otraPersona, alMarcar }: { parecidos: Parecido[]; otraPersona: boolean; alMarcar: (v: boolean) => void }) {
  if (parecidos.length === 0) return null;
  const porCelular = parecidos.some((p) => p.motivo === "celular");
  return (
    <section role="status" aria-label="Socio ya inscrito" className="aparece grid gap-3 rounded-[12px] bg-ambar-tenue px-4 py-3.5 outline-1 -outline-offset-4 outline-dashed outline-ambar/40">
      <p className="flex items-start gap-2 text-[0.92rem]">
        <Icono nombre="alerta" className="mt-0.5 size-[18px] shrink-0 text-ambar" />
        <span>
          <strong className="font-semibold">{porCelular ? "Esta persona ya está inscrita." : "Ya hay alguien inscrito con este nombre."}</strong>{" "}
          Si regresó, no la inscribas otra vez: ábrela y cóbrale desde su ficha (renovar membresía o visita). Así su historial sigue en un solo lugar.
        </span>
      </p>
      <ul className="grid gap-2">
        {parecidos.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[10px] bg-superficie px-3.5 py-2.5">
            <span className="min-w-0">
              <b className="font-semibold">{p.nombre}</b>{" "}
              <span className="text-[0.84rem] text-gris">
                {p.numero} · {p.motivo === "celular" ? "mismo celular" : "mismo nombre"}
                {p.activo ? "" : " · en espera (dado de baja)"}
              </span>
            </span>
            <Link href={`/socios/${p.id}#renovar`} className="boton boton-chico">
              Abrir su ficha y cobrar
            </Link>
          </li>
        ))}
      </ul>
      {!porCelular && (
        <label className="flex w-fit cursor-pointer items-center gap-2.5 text-[0.88rem] font-semibold">
          <input type="checkbox" checked={otraPersona} onChange={(e) => alMarcar(e.target.checked)} className="size-4 accent-tinta" />
          Es otra persona con el mismo nombre: inscribirla aparte
        </label>
      )}
      {otraPersona && !porCelular && <input type="hidden" name="otraPersona" value="1" />}
    </section>
  );
}
