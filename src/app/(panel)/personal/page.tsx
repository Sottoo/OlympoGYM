import type { Metadata } from "next";
import { ROLES } from "@/domain/shared/permisos";
import { exigirPermiso, listarPersonal, permisosExtraDeRecepcion } from "@/infrastructure/auth/autenticacion";
import { entorno } from "@/infrastructure/config/entorno";
import { Encabezado } from "@/presentation/components/Encabezado";
import { Insignia } from "@/presentation/components/Insignia";
import { MensajeExito } from "@/presentation/components/Mensajes";
import { Panel } from "@/presentation/components/Panel";
import { fechaLocal, formatearFecha } from "@/shared/formato";
import { AccionesDeCuenta, FormularioNuevaCuenta, PermisosDeRecepcion } from "./FormulariosPersonal";

export const metadata: Metadata = { title: "Personal" };
export const dynamic = "force-dynamic";

function aviso(clave?: string, n = ""): string | undefined {
  const [nombre, usuario] = n.split("|");
  switch (clave) {
    case "creada":
      return `Cuenta creada. ${nombre} ya puede entrar con el usuario «${usuario}».`;
    case "perfil-administracion":
      return `${nombre} ahora es Administración: puede hacer todo.`;
    case "perfil-recepcion":
      return `${nombre} ahora es Recepción.`;
    case "contrasena":
      return `Contraseña nueva guardada para ${nombre}. Dísela en persona, no por mensaje.`;
    case "editada":
      return `Datos de ${nombre} guardados. Entra con el usuario «${usuario}».`;
    case "eliminada":
      return `Cuenta de ${nombre} eliminada. Lo que hizo sigue en la bitácora.`;
    case "desactivada":
      return `Cuenta de ${nombre} desactivada: ya no puede entrar.`;
    case "activada":
      return `Cuenta de ${nombre} activada: ya puede entrar.`;
    case "permisos":
      return `Permisos de Recepción guardados: ${nombre === "1" ? "1 permiso extra" : `${nombre} permisos extra`}.`;
    case "permisos-estandar":
      return "Recepción quedó con los permisos estándar.";
    default:
      return undefined;
  }
}

/** Cuentas de quienes usan el programa y lo que puede hacer Recepción. Solo la administración entra aquí. */
export default async function PaginaPersonal({ searchParams }: { searchParams: Promise<{ aviso?: string; n?: string }> }) {
  const yo = await exigirPermiso("personal.gestionar");
  const [{ aviso: clave, n }, cuentas] = await Promise.all([searchParams, listarPersonal()]);
  const extras = [...permisosExtraDeRecepcion()];

  return (
    <div className="pagina">
      <Encabezado guia="personal" icono="usuario" titulo="Personal" descripcion="Quién entra al programa y qué puede hacer." />

      <MensajeExito mensaje={aviso(clave, n)} />

      <div className="con-lateral">
        <div className="bloques">
          {/* Sin recorte horizontal: el menú «Más» de cada cuenta se despliega encima. */}
          <section className="superficie">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Perfil</th>
                  <th>Desde</th>
                  <th>
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {cuentas.map((c) => (
                  <tr key={c.id} className={c.activo ? "" : "text-gris"}>
                    <td>
                      <b className="block font-semibold whitespace-nowrap">
                        {c.nombre}
                        {c.id === yo.id && <span className="ml-2 text-[0.75rem] font-normal text-gris">(tú)</span>}
                      </b>
                      <span className="text-[0.8rem] text-gris">usuario: {c.usuario}</span>
                    </td>
                    <td>
                      <span className="flex flex-wrap gap-1.5">
                        <Insignia tono={c.rol === "administrador" ? "oscuro" : "neutro"}>{ROLES[c.rol].nombre}</Insignia>
                        {!c.activo && <Insignia tono="rojo">Desactivada</Insignia>}
                      </span>
                    </td>
                    <td className="text-[0.85rem] whitespace-nowrap text-gris">{formatearFecha(fechaLocal(c.creadoEn, entorno.zonaHoraria))}</td>
                    <td>
                      <div className="flex justify-end">
                        <AccionesDeCuenta id={c.id} nombre={c.nombre} usuario={c.usuario} rol={c.rol} activo={c.activo} esYo={c.id === yo.id} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <Panel titulo="Lo que puede hacer Recepción">
            <PermisosDeRecepcion key={extras.join()} activos={extras} />
          </Panel>
        </div>

        <Panel titulo="Nueva cuenta">
          <FormularioNuevaCuenta />
        </Panel>
      </div>
    </div>
  );
}
