"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { METODOS_PAGO, type MetodoPago } from "@/domain/entities/Pago";
import { formatearDinero } from "@/shared/formato";
import { accionCobrarVisita } from "../../panel/acciones";

/**
 * «Solo viene hoy»: cobra la visita del día y registra su entrada desde la
 * ficha, igual que en el mostrador. Antes la visita solo se cobraba en el
 * mostrador: quien llegaba aquí desde el aviso de «ya está inscrito» (que dice
 * «cóbrale desde su ficha») no encontraba cómo cobrarle la visita.
 */
export function CobrarVisitaDeHoy({ socioId, nombre, precio }: { socioId: string; nombre: string; precio: number }) {
  const router = useRouter();
  const [metodo, setMetodo] = useState<MetodoPago>("efectivo");
  const [error, setError] = useState<string | null>(null);
  const [cobrando, iniciar] = useTransition();

  function cobrar() {
    setError(null);
    iniciar(async () => {
      const r = await accionCobrarVisita(socioId, metodo);
      if (!r.ok) return setError(r.error);
      router.replace(`/socios/${socioId}?aviso=visita`, { scroll: false });
    });
  }

  return (
    <div className="mt-5 grid gap-2.5 rounded-[12px] border-[1.5px] border-dashed border-linea-fuerte p-3.5">
      <p className="text-[0.86rem] text-tinta-suave">
        <b className="font-semibold text-tinta">¿Solo viene hoy?</b> Cóbrale la visita del día a {nombre} y su entrada queda registrada.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[0.86rem] font-semibold text-tinta-suave">Pago en</span>
        <div role="radiogroup" aria-label="Método de pago de la visita" className="flex gap-1 rounded-[9px] border-[1.5px] border-linea-fuerte bg-elevado p-0.5">
          {(Object.keys(METODOS_PAGO) as MetodoPago[]).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={metodo === m}
              onClick={() => setMetodo(m)}
              className={`rounded-[7px] px-2.5 py-1 text-[0.8rem] font-bold ${metodo === m ? "bg-tinta text-[#f2efe8]" : "text-gris hover:text-tinta"}`}
            >
              {METODOS_PAGO[m]}
            </button>
          ))}
        </div>
        <button type="button" onClick={cobrar} disabled={cobrando} className="boton-secundario ml-auto">
          {cobrando ? "Cobrando…" : `Cobrar visita ${formatearDinero(precio)} y registrar`}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-[0.86rem] font-semibold text-rojo">
          {error}
        </p>
      )}
    </div>
  );
}
