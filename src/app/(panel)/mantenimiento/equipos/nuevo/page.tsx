import type { Metadata } from "next";
import Link from "next/link";
import { exigirPermiso } from "@/infrastructure/auth/autenticacion";
import { entorno } from "@/infrastructure/config/entorno";
import { hoyEn } from "@/domain/shared/fechas";
import { Encabezado } from "@/presentation/components/Encabezado";
import { FormularioEquipo } from "../FormularioEquipo";

export const metadata: Metadata = { title: "Nuevo equipo" };

export default async function PaginaNuevoEquipo() {
  await exigirPermiso("mantenimiento.gestionar");
  return (
    <div className="pagina max-w-4xl">
      <Encabezado
        titulo="Nuevo equipo"
        volver={{ href: "/mantenimiento", texto: "Mantenimiento" }}
        descripcion={
          <>
            Una máquina o instalación a la que se le da mantenimiento. ¿Son varias?{" "}
            <Link href="/mantenimiento/equipos/rapido" className="enlace text-tinta">Usa la alta rápida</Link>.
          </>
        }
      />
      <FormularioEquipo hoy={hoyEn(entorno.zonaHoraria)} />
    </div>
  );
}
