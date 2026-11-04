"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { BotonFecha } from "@/presentation/components/formulario/CampoFecha";

/** Abre el calendario y lleva a las entradas del día elegido. */
export function SaltoDeDia({ dia, hoy }: { dia: string; hoy: string }) {
  const router = useRouter();
  const [cargando, iniciar] = useTransition();
  return (
    <div className={`ml-auto ${cargando ? "opacity-60" : ""}`}>
      <BotonFecha
        valor={dia}
        max={hoy}
        texto={cargando ? "Abriendo…" : "Ir a otro día"}
        alElegir={(f) => iniciar(() => router.push(f === hoy ? "/asistencias" : `/asistencias?dia=${f}`))}
      />
    </div>
  );
}
