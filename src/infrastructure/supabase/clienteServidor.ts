import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { entorno } from "../config/entorno";

/**
 * Cliente de Supabase para Server Components y Server Actions.
 * Actúa con la sesión del usuario que inició sesión, así que las
 * políticas RLS de la base de datos se aplican.
 */
export async function crearClienteServidor() {
  const almacenCookies = await cookies();

  return createServerClient(entorno.supabaseUrl, entorno.supabaseAnonKey, {
    cookies: {
      getAll: () => almacenCookies.getAll(),
      setAll: (lista) => {
        try {
          lista.forEach(({ name, value, options }) => almacenCookies.set(name, value, options));
        } catch {
          // Llamado desde un Server Component: el middleware ya refresca la sesión.
        }
      },
    },
  });
}
