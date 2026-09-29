"use client";

import { useEffect } from "react";
import { accionRespaldoDiario } from "./acciones";

/** Al abrir el panel, pide al servidor el respaldo del día (si ya existe, no hace nada). */
export function RespaldoAutomatico() {
  useEffect(() => {
    void accionRespaldoDiario();
  }, []);
  return null;
}
