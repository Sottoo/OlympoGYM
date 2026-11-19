import { Icono } from "./Icono";
import { Emblema } from "./pictogramas/Emblema";

export function MensajeError({ mensaje, titulo = "No se pudo guardar." }: { mensaje?: string; titulo?: string | null }) {
  if (!mensaje) return null;
  return (
    <p key={mensaje} role="alert" className="aparece temblor flex items-start gap-2.5 rounded-[10px] bg-rojo-tenue px-4 py-3 text-[0.92rem] text-tinta outline-1 -outline-offset-4 outline-dashed outline-rojo/35">
      <Icono nombre="alerta" className="mt-0.5 size-[18px] text-rojo" />
      <span>
      {titulo && <strong className="font-semibold text-rojo">{titulo} </strong>}
      {mensaje}
      </span>
    </p>
  );
}

export function MensajeExito({ mensaje }: { mensaje?: string }) {
  if (!mensaje) return null;
  return (
    <p key={mensaje} role="status" data-exito="" className="aparece flex items-start gap-2.5 rounded-[10px] bg-verde-tenue px-4 py-3 text-[0.92rem] text-tinta outline-1 -outline-offset-4 outline-dashed outline-verde/35">
      {/* La palomita llega como un sello que se estampa. */}
      <span aria-hidden className="sello-nuevo mt-px grid size-[19px] shrink-0 place-items-center rounded-full bg-verde text-white shadow-[0_0_0_2px_rgb(255_255_255/0.7)]">
        <Icono nombre="check" className="size-3" />
      </span>
      <span>{mensaje}</span>
    </p>
  );
}

/** Estado vacío de una lista: dice qué falta y qué hacer. */
export function Vacio({ children, accion }: { children: React.ReactNode; accion?: React.ReactNode }) {
  return (
    <div className="grid place-items-center gap-3 rounded-[12px] border-[1.5px] border-dashed border-linea-fuerte px-6 py-12 text-center">
      <span className="flota">
        <Emblema icono="pesas" hilo="gris" tamano="lg" />
      </span>
      <p className="max-w-sm text-gris">{children}</p>
      {accion && <div className="mt-4">{accion}</div>}
    </div>
  );
}
