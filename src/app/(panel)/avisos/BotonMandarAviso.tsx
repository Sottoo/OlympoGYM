"use client";

import { useTransition } from "react";
import { IconoWhatsApp } from "@/presentation/components/BotonWhatsApp";
import { accionMarcarAviso } from "./acciones";

/** Abre WhatsApp con el mensaje escrito y marca el aviso como enviado. */
export function BotonMandarAviso({ enlace, suscripcionId, etapa }: { enlace: string; suscripcionId: string; etapa: number }) {
  const [marcando, iniciar] = useTransition();
  return (
    <a
      href={enlace}
      target="_blank"
      rel="noopener noreferrer"
      aria-disabled={marcando}
      onClick={() => iniciar(() => accionMarcarAviso(suscripcionId, etapa))}
      className={`boton-secundario boton-chico ${marcando ? "pointer-events-none opacity-60" : ""}`}
      title="Abre WhatsApp con el mensaje listo; solo falta presionar enviar"
    >
      <IconoWhatsApp />
      {marcando ? "Marcando…" : "Mandar por WhatsApp"}
    </a>
  );
}
