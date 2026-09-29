import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { modoDemo } from "@/infrastructure/config/entorno";
import { actualizarSesion } from "@/infrastructure/supabase/actualizarSesion";

/** Protege el panel: sin sesión, todo redirige a /login. */
export async function middleware(request: NextRequest) {
  if (modoDemo) return NextResponse.next();

  const { respuesta, usuario } = await actualizarSesion(request);
  const enLogin = request.nextUrl.pathname.startsWith("/login");

  if (!usuario && !enLogin) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (usuario && enLogin) {
    return NextResponse.redirect(new URL("/panel", request.url));
  }
  return respuesta;
}

export const config = {
  // Todo excepto archivos estáticos.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
