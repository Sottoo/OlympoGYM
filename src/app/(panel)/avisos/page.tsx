import type { Metadata } from "next";
import Link from "next/link";
import type { AvisoPendiente } from "@/application/use-cases/avisos/AvisosWhatsApp";
import { DIAS_DE_AVISO, type EtapaDeAviso } from "@/domain/entities/Suscripcion";
import { entorno } from "@/infrastructure/config/entorno";
import { casosDeUso } from "@/infrastructure/contenedor";
import { Encabezado } from "@/presentation/components/Encabezado";
import { Vacio } from "@/presentation/components/Mensajes";
import { enlaceWhatsApp, mensajeRecordatorio } from "@/presentation/whatsapp";
import { formatearFecha, formatearTelefono } from "@/shared/formato";
import { BotonMandarAviso } from "./BotonMandarAviso";

export const metadata: Metadata = { title: "Avisos" };
export const dynamic = "force-dynamic";

const GRUPOS: Record<EtapaDeAviso, string> = {
  1: "Vencen hoy o mañana",
  3: "Vencen en 2 o 3 días",
  7: "Vencen en 4 a 7 días",
};

export default async function PaginaAvisos() {
  const avisos = await (await casosDeUso()).obtenerAvisosPendientes.ejecutar();
  const etapas = [...DIAS_DE_AVISO].reverse();

  return (
    <div className="space-y-8">
      <Encabezado
        titulo="Avisos por WhatsApp"
        descripcion="Recordatorios que toca mandar hoy: 7, 3 y 1 día antes de que venza cada membresía. El botón abre WhatsApp con el mensaje listo; solo falta presionar enviar."
      />

      {avisos.length === 0 ? (
        <Vacio>No hay avisos pendientes. Cuando a alguien le falten 7 días o menos para vencer, aparecerá aquí.</Vacio>
      ) : (
        etapas.map((etapa) => {
          const grupo = avisos.filter((a) => a.etapa === etapa);
          if (grupo.length === 0) return null;
          return (
            <section key={etapa} aria-labelledby={`etapa-${etapa}`}>
              <h2 id={`etapa-${etapa}`} className="subtitulo mb-3">
                {GRUPOS[etapa]} <span className="font-normal text-gris">· {grupo.length}</span>
              </h2>
              <ol className="superficie divide-y divide-linea">
                {grupo.map((aviso) => (
                  <FilaAviso key={aviso.suscripcionId} aviso={aviso} />
                ))}
              </ol>
            </section>
          );
        })
      )}
    </div>
  );
}

function FilaAviso({ aviso }: { aviso: AvisoPendiente }) {
  const urgente = aviso.diasRestantes <= 1;
  const numero = aviso.diasRestantes === 0 ? "Hoy" : String(aviso.diasRestantes);
  const unidad = aviso.diasRestantes === 0 ? "" : aviso.diasRestantes === 1 ? "día" : "días";
  const mensaje = mensajeRecordatorio(aviso.nombre.split(" ")[0], aviso, entorno.nombreGimnasio);

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:flex-nowrap">
      <div
        className={`flex w-14 shrink-0 flex-col items-center rounded-md border py-1.5 ${
          urgente ? "border-rojo/30 bg-rojo-tenue text-rojo" : "border-linea bg-hundido text-tinta"
        }`}
      >
        <span className="cifra text-[1.7rem]">{numero}</span>
        {unidad && <span className="text-[0.7rem] font-semibold uppercase tracking-wider">{unidad}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <Link href={`/socios/${aviso.socioId}`} className="enlace block truncate text-[1.02rem]">
          {aviso.nombre}
        </Link>
        <p className="text-sm text-gris">
          <span className="tabular-nums">{formatearTelefono(aviso.telefono)}</span> · {aviso.planNombre} · válido hasta el{" "}
          {formatearFecha(aviso.fechaFin)}
        </p>
      </div>
      <div className="flex w-full gap-2 sm:w-auto">
        <BotonMandarAviso enlace={enlaceWhatsApp(aviso.telefono, mensaje)} suscripcionId={aviso.suscripcionId} etapa={aviso.etapa} />
        <Link href={`/socios/${aviso.socioId}#renovar`} className="boton-secundario boton-chico">Renovar</Link>
      </div>
    </li>
  );
}
