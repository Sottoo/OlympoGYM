import { HuecoDeSello, Sello } from "./Sello";

const DIAS = ["L", "M", "M", "J", "V", "S", "D"];

/**
 * El mes del socio como una tira de tela: cada día que vino lleva su parche
 * cosido; el de hoy va punteado en tinta y los que faltan quedan en blanco.
 */
export function Pasaporte({ mes, dias, hoy }: { mes: string; dias: number[]; hoy: string; semilla?: number }) {
  const [anio, numMes] = mes.split("-").map(Number);
  const totalDias = new Date(Date.UTC(anio, numMes, 0)).getUTCDate();
  // Lunes = 0 … domingo = 6
  const desfase = (new Date(Date.UTC(anio, numMes - 1, 1)).getUTCDay() + 6) % 7;
  const esEsteMes = hoy.slice(0, 7) === mes.slice(0, 7);
  const diaHoy = esEsteMes ? Number(hoy.slice(8, 10)) : 99;
  const vino = new Set(dias);

  return (
    <div className="grid grid-cols-7 gap-y-2">
      {DIAS.map((d, i) => (
        <div key={i} className="pb-1 text-center text-[0.68rem] font-bold tracking-[0.14em] text-gris">
          {d}
        </div>
      ))}
      {Array.from({ length: desfase }, (_, i) => (
        <div key={`v${i}`} />
      ))}
      {Array.from({ length: totalDias }, (_, i) => i + 1).map((d) => (
        <div key={d} className="grid h-[3.4rem] place-items-center border-t border-dashed border-linea">
          {vino.has(d) ? (
            <Sello texto={d} tamano={44} />
          ) : (
            <span className={d > diaHoy ? "opacity-50" : ""}>
              <HuecoDeSello tamano={40} texto={d} hoy={d === diaHoy} />
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
