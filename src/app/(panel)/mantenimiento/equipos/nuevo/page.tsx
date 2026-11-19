import type { Metadata } from "next";
import Link from "next/link";
import { exigirPermiso } from "@/infrastructure/auth/autenticacion";
import { entorno } from "@/infrastructure/config/entorno";
import { hoyEn } from "@/domain/shared/fechas";
import { Encabezado } from "@/presentation/components/Encabezado";
import { FormularioEquipo } from "../FormularioEquipo";

export const metadata: Metadata = { title: "Agregar máquina" };

export default async function PaginaNuevoEquipo() {
  await exigirPermiso("mantenimiento.gestionar");
  return (
    <div className="pagina max-w-4xl">
      <Encabezado
        titulo="Agregar máquina"
        volver={{ href: "/mantenimiento", texto: "Máquinas" }}
        acciones={
          <Link href="/mantenimiento/equipos/rapido" className="boton-secundario boton-chico">
            Agregar varias a la vez
          </Link>
        }
      />
      <FormularioEquipo hoy={hoyEn(entorno.zonaHoraria)} />
    </div>
  );
}
