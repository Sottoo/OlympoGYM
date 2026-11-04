import type { Metadata } from "next";
import { EQUIPOS_TIPICOS } from "@/domain/entities/Mantenimiento";
import { ultimoNumero } from "@/application/use-cases/mantenimiento/Mantenimiento";
import { exigirPermiso } from "@/infrastructure/auth/autenticacion";
import { casosDeUso } from "@/infrastructure/contenedor";
import { Encabezado } from "@/presentation/components/Encabezado";
import { AltaRapida } from "./AltaRapida";

export const metadata: Metadata = { title: "Alta rápida de equipos" };
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
        titulo="Alta rápida de equipos"
        volver={{ href: "/mantenimiento", texto: "Mantenimiento" }}
        descripcion="Marca lo que hay en tu gimnasio y cuántos. Se numeran solos (Caminadora 1, 2, 3) y ya llevan el preventivo que suele recomendarse; después puedes ajustar cada uno."
      />
      <AltaRapida catalogo={EQUIPOS_TIPICOS} yaHay={yaHay} />
    </div>
  );
}
