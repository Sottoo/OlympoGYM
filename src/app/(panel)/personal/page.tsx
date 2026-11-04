import type { Metadata } from "next";
import { PERMISOS } from "@/domain/shared/permisos";
import { exigirPermiso, listarPersonal } from "@/infrastructure/auth/autenticacion";
import { Encabezado } from "@/presentation/components/Encabezado";
import { Panel } from "@/presentation/components/Panel";
import { fechaLocal, formatearFecha } from "@/shared/formato";
import { entorno } from "@/infrastructure/config/entorno";
import { AccionesDeCuenta, FormularioNuevaCuenta, PerfilDeCuenta } from "./FormulariosPersonal";

export const metadata: Metadata = { title: "Personal" };
export const dynamic = "force-dynamic";

/** Cuentas de quienes usan el programa y lo que puede hacer cada perfil. Solo la administración entra aquí. */
export default async function PaginaPersonal() {
  const yo = await exigirPermiso("personal.gestionar");
  const cuentas = await listarPersonal();

  return (
    <div className="pagina">
      <Encabezado icono="usuario" titulo="Personal" descripcion="Quién puede entrar al programa y con qué perfil." />

      <div className="con-lateral">
        <div className="bloques">
          <section className="superficie overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Perfil</th>
                  <th>Desde</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cuentas.map((c) => (
                  <tr key={c.id} className={c.activo ? "" : "opacity-55"}>
                    <td>
                      <b className="block whitespace-nowrap font-semibold">
                        {c.nombre}
                        {c.id === yo.id && <span className="ml-2 text-[0.75rem] font-normal text-gris">(tú)</span>}
                      </b>
                      <span className="text-[0.8rem] text-gris">usuario: {c.usuario}</span>
                    </td>
                    <td>
                      <PerfilDeCuenta id={c.id} rol={c.rol} activo={c.activo} esYo={c.id === yo.id} />
                    </td>
                    <td className="whitespace-nowrap text-[0.85rem] text-gris">{formatearFecha(fechaLocal(c.creadoEn, entorno.zonaHoraria))}</td>
                    <td>
                      <AccionesDeCuenta id={c.id} activo={c.activo} esYo={c.id === yo.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <Panel titulo="Lo que no puede hacer Recepción">
            <p className="text-[0.88rem] text-tinta-suave">
              Recepción registra entradas, da de alta y edita socios, cobra membresías al precio del plan, cobra visitas, vende en la tienda.
              Consulta el inventario y el corte de su día. No puede:
            </p>
            <ul className="mt-3 grid gap-x-8 gap-y-1.5 text-[0.86rem] sm:grid-cols-2">
              {Object.values(PERMISOS).map((texto) => (
                <li key={texto} className="flex gap-2">
                  <span aria-hidden className="font-bold text-hilo">×</span>
                  <span className="first-letter:uppercase">{texto}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <Panel titulo="Nueva cuenta" descripcion="Para cada persona que atienda el mostrador: así la bitácora dice quién hizo qué.">
          <FormularioNuevaCuenta />
        </Panel>
      </div>
    </div>
  );
}
