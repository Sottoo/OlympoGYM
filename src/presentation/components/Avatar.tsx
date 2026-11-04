/**
 * Avatar del socio: su foto, o sus iniciales como un parche pequeño (negro
 * con la orilla cosida).
 */
export function iniciales(nombre: string) {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

const TAMANOS = {
  chico: "size-8 text-[0.7rem]",
  normal: "size-10 text-[0.82rem]",
  grande: "size-16 text-[1.25rem]",
};

export function Avatar({
  nombre,
  fotoUrl,
  tamano = "normal",
}: {
  nombre: string;
  fotoUrl?: string | null;
  tamano?: keyof typeof TAMANOS;
}) {
  return (
    <span aria-hidden className={`relative grid shrink-0 place-items-center rounded-full bg-tinta font-titulos text-[#f2efe8] ${TAMANOS[tamano]}`}>
      {fotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- foto local del socio
        <img src={fotoUrl} alt="" className="size-full rounded-full object-cover" />
      ) : (
        <>
          <span className="absolute inset-[3px] rounded-full border border-dashed border-[#f2efe8]/45" />
          {iniciales(nombre)}
        </>
      )}
    </span>
  );
}
