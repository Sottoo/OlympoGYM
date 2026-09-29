export interface Indicador {
  etiqueta: string;
  valor: React.ReactNode;
  detalle?: React.ReactNode;
  /** Resalta la cifra en rojo cuando pide atención. */
  alerta?: boolean;
}

/** Tira de cifras clave: una sola superficie dividida, no tarjetas sueltas. */
export function Indicadores({ datos }: { datos: Indicador[] }) {
  return (
    <dl className="superficie grid grid-cols-2 overflow-hidden lg:grid-cols-4">
      {datos.map((d, i) => (
        <div
          key={d.etiqueta}
          className={`border-linea px-5 py-4 ${i % 2 === 1 ? "border-l" : ""} ${i >= 2 ? "border-t lg:border-t-0" : ""} ${
            i === 2 ? "lg:border-l" : ""
          }`}
        >
          <dt className="rotulo">{d.etiqueta}</dt>
          <dd className={`cifra mt-2 text-[2rem] ${d.alerta ? "text-rojo" : ""}`}>{d.valor}</dd>
          {d.detalle && <dd className="mt-1.5 text-[0.85rem] text-gris">{d.detalle}</dd>}
        </div>
      ))}
    </dl>
  );
}
