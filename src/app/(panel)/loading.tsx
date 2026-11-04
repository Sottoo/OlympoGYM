/**
 * Lo que se ve en el instante en que se da clic a otra sección, mientras
 * llegan sus datos: una costura que se va cosiendo. Hace que el cambio de
 * pantalla responda de inmediato.
 */
export default function Cargando() {
  return (
    <div aria-busy="true" aria-label="Cargando" className="grid gap-6 pt-2">
      <div className="h-10 w-72 rounded-[8px] bg-linea/60" />
      <svg aria-hidden className="h-3 w-full max-w-xl text-linea-fuerte" preserveAspectRatio="none" viewBox="0 0 600 6">
        <line x1="0" y1="3" x2="600" y2="3" stroke="currentColor" strokeWidth="3" strokeDasharray="10 7" className="animate-[costura_0.9s_linear_infinite]" />
      </svg>
      <div className="panel h-64" />
    </div>
  );
}
