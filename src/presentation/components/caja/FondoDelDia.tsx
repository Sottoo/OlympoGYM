"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { accionGuardarFondoDeCaja } from "@/app/(panel)/panel/acciones";
import { CampoDinero } from "@/presentation/components/formulario/campos";
import { formatearDinero } from "@/shared/formato";

/**
 * Con cuánto cambio empezó la caja hoy. Mientras no se anote, se pide (con el
 * del último día ya escrito); una vez anotado queda en una línea con
 * «Corregir» (solo para quien puede corregir cobros). Se suma a «Efectivo en caja».
 */
export function FondoDelDia({ monto, sugerido, puedeCorregir }: { monto: number | null; sugerido: number | null; puedeCorregir: boolean }) {
  const router = useRouter();
  const [editando, setEditando] = useState(monto === null);
  const [valor, setValor] = useState(String(monto ?? sugerido ?? ""));
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciar] = useTransition();

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const numero = Number(valor);
    if (valor.trim() === "" || !Number.isFinite(numero)) return setError("Escribe con cuánto cambio empezó la caja (0 si empezó vacía).");
    iniciar(async () => {
      const r = await accionGuardarFondoDeCaja(numero);
      if (!r.ok) return setError(r.error);
      setEditando(false);
      router.refresh();
    });
  }

  if (!editando && monto !== null) {
    return (
      <p className="text-[0.86rem] text-tinta-suave">
        Fondo de caja de hoy: <b className="font-semibold text-tinta">{formatearDinero(monto)}</b> (ya va sumado en «Efectivo en caja»).{" "}
        {puedeCorregir ? (
          <button type="button" onClick={() => setEditando(true)} className="enlace">
            Corregir
          </button>
        ) : (
          <span className="text-gris">Si está mal, lo corrige la administración.</span>
        )}
      </p>
    );
  }

  return (
    <form onSubmit={guardar} className="grid gap-2 rounded-[12px] border-[1.5px] border-dashed border-linea-fuerte p-3.5">
      <label htmlFor="fondo-de-caja" className="text-[0.9rem]">
        <b className="font-semibold">¿Con cuánto cambio empezó la caja hoy?</b>{" "}
        <span className="text-tinta-suave">Se suma a lo cobrado en efectivo para saber cuánto debe haber en el cajón al cerrar.</span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <CampoDinero id="fondo-de-caja" nombre="monto" valor={valor} alCambiar={setValor} className="w-44" />
        <button type="submit" disabled={guardando} className="boton">
          {guardando ? "Guardando…" : monto === null ? "Anotar fondo" : "Guardar"}
        </button>
        {monto !== null && (
          <button type="button" onClick={() => (setEditando(false), setValor(String(monto)), setError(null))} className="enlace text-[0.86rem]">
            Cancelar
          </button>
        )}
        {monto === null && sugerido !== null && <span className="text-[0.8rem] text-gris">El último día fue {formatearDinero(sugerido)}.</span>}
      </div>
      {error && (
        <p role="alert" className="text-[0.86rem] font-semibold text-rojo">
          {error}
        </p>
      )}
    </form>
  );
}
