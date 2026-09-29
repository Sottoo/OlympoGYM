import "server-only";
import { entorno, modoDemo } from "../config/entorno";
import { crearClienteServidor } from "../supabase/clienteServidor";

export interface PersonalActual {
  nombre: string;
  email: string;
  rol: "administrador" | "recepcion";
}

export type EstadoAcceso =
  | { tipo: "autorizado"; personal: PersonalActual }
  | { tipo: "sin_sesion" }
  | { tipo: "sin_permiso"; email: string };

/** Quién está usando el panel y si tiene permiso. */
export async function obtenerAcceso(): Promise<EstadoAcceso> {
  if (modoDemo) {
    return { tipo: "autorizado", personal: { nombre: "Modo demo", email: "demo@local", rol: "administrador" } };
  }

  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { tipo: "sin_sesion" };

  const { data } = await supabase.from("personal").select("nombre, rol").eq("usuario_id", user.id).maybeSingle();
  if (!data) return { tipo: "sin_permiso", email: user.email ?? "" };

  return { tipo: "autorizado", personal: { nombre: data.nombre, rol: data.rol, email: user.email ?? "" } };
}

export async function iniciarSesion(email: string, contrasena: string): Promise<string | null> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({ email, password: contrasena });
  if (!error) return null;
  return error.message.includes("Invalid login credentials")
    ? "El correo o la contraseña no coinciden."
    : "No se pudo iniciar sesión. Intenta de nuevo en unos minutos.";
}

export async function cerrarSesion(): Promise<void> {
  if (modoDemo) return;
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
}

export { entorno, modoDemo };
