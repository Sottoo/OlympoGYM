import { exigirPermiso } from "@/infrastructure/auth/autenticacion";
import type { Metadata } from "next";
import { requerirSesion } from "@/infrastructure/auth/autenticacion";
import { entorno } from "@/infrastructure/config/entorno";
import { carpetaDeRespaldos, carpetaExtra, listarRespaldos, type TipoRespaldo, ultimoRespaldo } from "@/infrastructure/respaldo/respaldo";
import { Panel, PanelTabla } from "@/presentation/components/Panel";
import { Encabezado } from "@/presentation/components/Encabezado";
import { Insignia } from "@/presentation/components/Insignia";
import { Marcador } from "@/presentation/components/Marcador";
import { MensajeExito, Vacio } from "@/presentation/components/Mensajes";
import { BotonesRespaldo, CarpetaExtra, FormularioRestaurar } from "./AccionesRespaldo";

export const metadata: Metadata = { title: "Respaldos" };
export const dynamic = "force-dynamic";

const TIPOS: Record<TipoRespaldo, string> = {
  diario: "Automático",
  manual: "Manual",
  "antes-de-restaurar": "Antes de restaurar",
  "antes-de-actualizar": "Antes de actualizar",
};

const tamano = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toLocaleString("es-MX", { maximumFractionDigits: 1 })} MB`;

const fechaYHora = (instante: string) =>
  new Intl.DateTimeFormat("es-MX", { timeZone: entorno.zonaHoraria, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(
    new Date(instante),
  );

export default async function PaginaRespaldos({ searchParams }: { searchParams: Promise<{ restaurado?: string }> }) {
  await exigirPermiso("respaldos.gestionar");
  await requerirSesion();
  const { restaurado } = await searchParams;
  const respaldos = listarRespaldos();
  const extra = carpetaExtra();
  const ultimo = ultimoRespaldo();
  const horasDesdeUltimo = ultimo ? (Date.now() - new Date(ultimo).getTime()) / 3_600_000 : Infinity;

  return (
    <div className="pagina">
      <Encabezado guia="respaldos" icono="respaldos"
        titulo="Respaldos"
        descripcion="Todo vive en esta computadora. Cada respaldo es una copia completa: socios, pagos, ventas, inventario, entradas y fotos."
      />

      {restaurado && (
        <MensajeExito mensaje={`Respaldo restaurado. La información anterior quedó guardada en ${restaurado}, por si hiciera falta regresar.`} />
      )}

      <Marcador
        cifras={[
          {
            etiqueta: "Último respaldo", icono: "respaldos",
            valor: ultimo ? fechaYHora(ultimo) : "Ninguno",
            alerta: horasDesdeUltimo > 48,
            detalle: horasDesdeUltimo > 48 ? "Crea uno ahora" : "Se hace solo cada día y cada 3 horas de uso",
          },
          { etiqueta: "Respaldos guardados", icono: "caja", valor: respaldos.length, detalle: "Se conservan 30 diarios y 20 manuales" },
          {
            etiqueta: "Copia fuera de la computadora", icono: "descargar",
            valor: extra ? "Activa" : "Sin configurar",
            alerta: !extra,
            detalle: extra ? "Cada respaldo se copia también a la carpeta extra" : "Recomendado: Google Drive o una USB",
          },
        ]}
      />

      <div className="mitades">
        <Panel titulo="Respaldar ahora" descripcion="Útil antes de un cambio grande, o para mandarte una copia por WhatsApp.">
          <BotonesRespaldo carpeta={carpetaDeRespaldos()} />
        </Panel>
        <Panel
          titulo="Copia fuera de la computadora"
          descripcion={
            <>
              Si la computadora se descompone, esta copia salva la información. Lo más cómodo es{" "}
              <span className="font-medium text-tinta">Google Drive para escritorio</span> (gratis): elige una carpeta dentro de
              «Mi unidad» y cada respaldo se sube solo. También sirve OneDrive o una USB.
            </>
          }
        >
          <CarpetaExtra actual={extra} />
        </Panel>
      </div>

      <PanelTabla
        titulo="Respaldos guardados"
        descripcion={<span className="block max-w-full truncate" title={carpetaDeRespaldos()}>{carpetaDeRespaldos()}</span>}
      >
        {respaldos.length === 0 ? (
          <div className="px-2 pb-2">
            <Vacio>Todavía no hay respaldos. Crea el primero con «Crear respaldo ahora».</Vacio>
          </div>
        ) : (
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th className="numero">Tamaño</th>
                  <th><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {respaldos.map((r) => (
                  <tr key={r.nombre}>
                    <td className="whitespace-nowrap">{fechaYHora(r.creadoEn)}</td>
                    <td>
                      <Insignia tono={r.tipo === "manual" ? "oscuro" : r.tipo === "diario" ? "verde" : "ambar"}>{TIPOS[r.tipo]}</Insignia>
                    </td>
                    <td className="numero text-gris">{tamano(r.tamano)}</td>
                    <td className="text-right">
                      <a href={`/api/respaldos/${encodeURIComponent(r.nombre)}`} className="boton-secundario boton-chico">
                        Descargar
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        )}
      </PanelTabla>

      <Panel
        titulo="Restaurar un respaldo"
        descripcion="Reemplaza toda la información del programa por la de un respaldo: por ejemplo, al instalar el programa en una computadora nueva. Antes se guarda automáticamente una copia de la información actual."
        className="shadow-[inset_0_0_0_1.5px_rgb(168_35_27/0.25)]"
      >
        <FormularioRestaurar />
      </Panel>
    </div>
  );
}
