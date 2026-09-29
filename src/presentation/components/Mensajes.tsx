export function MensajeError({ mensaje }: { mensaje?: string }) {
  if (!mensaje) return null;
  return (
    <p role="alert" className="rounded-md border border-rojo/25 bg-rojo-tenue px-4 py-3 text-[0.93rem] text-tinta">
      <strong className="font-semibold text-rojo">No se pudo guardar. </strong>
      {mensaje}
    </p>
  );
}

export function MensajeExito({ mensaje }: { mensaje?: string }) {
  if (!mensaje) return null;
  return (
    <p role="status" className="rounded-md border border-verde/25 bg-verde-tenue px-4 py-3 text-[0.93rem] text-tinta">
      {mensaje}
    </p>
  );
}

/** Estado vacío de una lista: dice qué falta y qué hacer. */
export function Vacio({ children, accion }: { children: React.ReactNode; accion?: React.ReactNode }) {
  return (
    <div className="superficie px-6 py-10 text-center">
      <p className="text-gris">{children}</p>
      {accion && <div className="mt-4">{accion}</div>}
    </div>
  );
}
