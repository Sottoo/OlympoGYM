/**
 * Columnas de entradas por hora del día (una sola serie: sin leyenda, el
 * título la nombra). La hora actual va en vino y las demás en piedra; solo
 * se rotulan el pico y la hora actual, el resto vive en el tooltip. Se dibuja
 * con HTML para que el texto conserve su tamaño en cualquier ancho.
 */
const DESDE = 5;
const HASTA = 23;

export function EntradasPorHora({ porHora, horaActual }: { porHora: number[]; horaActual: number }) {
  const horas = Array.from({ length: HASTA - DESDE + 1 }, (_, i) => DESDE + i);
  const maximo = Math.max(1, ...horas.map((h) => porHora[h] ?? 0));
  const pico = horas.reduce((a, h) => ((porHora[h] ?? 0) > (porHora[a] ?? 0) ? h : a), horas[0]);
  const total = horas.reduce((t, h) => t + (porHora[h] ?? 0), 0);

  return (
    <figure className="grid gap-2 pt-5" aria-label={`Entradas por hora: ${total} en total; la hora con más entradas fue a las ${pico}:00.`}>
      <div className="grid h-24 items-end gap-1" style={{ gridTemplateColumns: `repeat(${horas.length}, minmax(0, 1fr))` }}>
        {horas.map((h) => {
          const valor = porHora[h] ?? 0;
          const actual = h === horaActual;
          const rotular = valor > 0 && (h === pico || actual);
          return (
            <div key={h} className="group relative flex h-full items-end justify-center" title={`${h}:00 – ${h + 1}:00 · ${valor} ${valor === 1 ? "entrada" : "entradas"}`}>
              {rotular && (
                <span className={`absolute text-[0.74rem] font-bold tabular-nums ${actual ? "text-vino" : "text-tinta"}`} style={{ bottom: `calc(${(valor / maximo) * 100}% + 3px)` }}>
                  {valor}
                </span>
              )}
              <span
                className={`block w-full max-w-[18px] rounded-t-[6px] rounded-b-[2px] transition-[height] duration-500 ${
                  actual ? "bg-vino" : h > horaActual ? "bg-hundido" : "bg-secuencia-2 group-hover:bg-secuencia-3"
                }`}
                style={{ height: valor > 0 ? `${Math.max(6, (valor / maximo) * 100)}%` : "4px" }}
              />
            </div>
          );
        })}
      </div>
      <div className="grid text-[0.7rem] font-medium text-gris tabular-nums" style={{ gridTemplateColumns: `repeat(${horas.length}, minmax(0, 1fr))` }}>
        {horas.map((h) => (
          <span key={h} className={`text-center ${h === horaActual ? "font-bold text-vino" : ""}`}>
            {h % 3 === 0 || h === horaActual ? `${h}h` : ""}
          </span>
        ))}
      </div>
    </figure>
  );
}
