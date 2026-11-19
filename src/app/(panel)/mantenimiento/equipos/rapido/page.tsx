import type { Metadata } from "next";
import { EQUIPOS_TIPICOS } from "@/domain/entities/Mantenimiento";
import { ultimoNumero } from "@/application/use-cases/mantenimiento/Mantenimiento";
import { exigirPermiso } from "@/infrastructure/auth/autenticacion";
import { casosDeUso } from "@/infrastructure/contenedor";
import { Encabezado } from "@/presentation/components/Encabezado";
import { AltaRapida } from "./AltaRapida";

export const metadata: Metadata = { title: "Agregar máquinas" };
export const dynamic = "force-dynamic";

export default async function PaginaAltaRapida() {
  await exigirPermiso("mantenimiento.gestionar");
  const { equipos } = await (await casosDeUso()).obtenerTableroDeMantenimiento.ejecutar();
  // Hasta qué número va cada tipo (Caminadora 1, 2, 3…), para seguir la numeración.
  const nombres = equipos.map((e) => e.equipo.nombre);
  const yaHay = Object.fromEntries(EQUIPOS_TIPICOS.map((t) => [t.clave, ultimoNumero(nombres, t.nombre)]));
  return (
    <div className="pagina">
      <Encabezado
        titulo="Agregar varias máquinas"
        volver={{ href: "/mantenimiento", texto: "Máquinas" }}
        descripcion="Marca cuántas tienes de cada una. Se numeran solas (Caminadora 1, 2, 3…)."
      />
      <AltaRapida catalogo={EQUIPOS_TIPICOS} yaHay={yaHay} />
    </div>
  );
}
