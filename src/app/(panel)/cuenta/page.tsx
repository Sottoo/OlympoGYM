import type { Metadata } from "next";
import { PERMISOS, ROLES, puede, type Permiso } from "@/domain/shared/permisos";
import { requerirSesion } from "@/infrastructure/auth/autenticacion";
import { entorno } from "@/infrastructure/config/entorno";
import { Encabezado } from "@/presentation/components/Encabezado";
import { Insignia } from "@/presentation/components/Insignia";
import { Panel } from "@/presentation/components/Panel";
import { FormularioContrasena } from "./FormularioContrasena";

export const metadata: Metadata = { title: "Mi cuenta" };
export const dynamic = "force-dynamic";

/** Datos de quien usa el programa, cambio de su propia contraseña y versión instalada. */
export default async function PaginaCuenta() {
  const yo = await requerirSesion();
  const restringido = (Object.keys(PERMISOS) as Permiso[]).filter((p) => !puede(yo.rol, p));

  return (
    <div className="pagina">
      <Encabezado icono="usuario"
        titulo="Mi cuenta"
        descripcion="Tus datos, lo que permite tu perfil y tu contraseña."
        etiquetas={<Insignia tono={yo.rol === "administrador" ? "oscuro" : "neutro"}>{ROLES[yo.rol].nombre}</Insignia>}
      />

      <div className="mitades">
        <Panel titulo={yo.nombre} descripcion={`Entras con el usuario «${yo.usuario}».`} className="flex flex-col">
          <p className="text-[0.9rem] text-tinta-suave">{ROLES[yo.rol].descripcion}</p>
          {restringido.length > 0 ? (
            <>
              <p className="mt-4 text-[0.86rem] font-semibold">Con tu perfil no puedes:</p>
              <ul className="mt-2 grid gap-x-8 gap-y-1.5 text-[0.86rem] sm:grid-cols-2">
                {restringido.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span aria-hidden className="font-bold text-hilo">×</span>
                    <span className="first-letter:uppercase">{PERMISOS[p]}</span>
                  </li>
                ))}
              </ul>
              <p className="ayuda mt-4">Si necesitas algo de esto, pídelo a la administración.</p>
            </>
          ) : (
            <p className="ayuda mt-3">Tienes acceso a todo el programa, incluida la sección Personal para dar cuentas a tu equipo.</p>
          )}
          <p className="ayuda mt-auto border-t-[1.5px] border-dashed border-linea pt-4">
            {entorno.nombreGimnasio} · versión <span className="tabular-nums">{entorno.versionPrograma}</span>
          </p>
        </Panel>

        <Panel titulo="Cambiar contraseña">
          <FormularioContrasena />
        </Panel>
      </div>
    </div>
  );
}
