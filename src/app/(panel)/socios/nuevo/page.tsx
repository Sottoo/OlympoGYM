import type { Metadata } from "next";
import Link from "next/link";
import { describirDuracion, esPlanDeVisita } from "@/domain/entities/Plan";
import { tienePermiso } from "@/infrastructure/auth/autenticacion";
import { casosDeUso } from "@/infrastructure/contenedor";
import { Encabezado } from "@/presentation/components/Encabezado";
import { Vacio } from "@/presentation/components/Mensajes";
import { FormularioSocio } from "../FormularioSocio";

export const metadata: Metadata = { title: "Inscribir socio" };
export const dynamic = "force-dynamic";

export default async function PaginaNuevoSocio() {
  const casos = await casosDeUso();
  const [planes, cambiaMonto, creaPlanes] = await Promise.all([
    casos.listarPlanes.ejecutar(true),
    tienePermiso("cobros.otroMonto"),
    tienePermiso("planes.gestionar"),
  ]);
  // Primero las membresías (de menor a mayor duración tal como se crearon) y al final la visita.
  const opciones = [...planes]
    .sort((a, b) => Number(esPlanDeVisita(a)) - Number(esPlanDeVisita(b)))
    .map((p) => ({ id: p.id, nombre: p.nombre, precio: p.precio, duracion: describirDuracion(p), esVisita: esPlanDeVisita(p) }));

  return (
    <div className="pagina mx-auto w-full max-w-3xl">
      <Encabezado
        titulo="Inscribir socio"
        volver={{ href: "/socios", texto: "Socios" }}
        descripcion="Sus datos, su plan y el pago en un solo paso."
      />
      {opciones.length === 0 ? (
        <Vacio
          accion={
            creaPlanes ? (
              <Link href="/planes" className="boton">
                Crear el primer plan
              </Link>
            ) : undefined
          }
        >
          Para inscribir socios primero hace falta al menos un plan (por ejemplo, Mensual).{" "}
          {creaPlanes ? "Créalo en Planes y regresa aquí." : "Pídele a la administración que lo cree en Planes."}
        </Vacio>
      ) : (
        <FormularioSocio inscripcion={{ planes: opciones, puedeCambiarMonto: cambiaMonto }} />
      )}
    </div>
  );
}
