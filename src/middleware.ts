import { NextResponse, type NextRequest } from "next/server";

/**
 * El programa solo se usa desde su propia ventana, en esta computadora.
 * Cualquier petición que llegue con otro nombre de servidor (por ejemplo,
 * una página de internet que intente hablar con el programa) se rechaza.
 */
const HOST_LOCAL = /^(localhost|127\.0\.0\.1)(:\d+)?$/;

export function middleware(peticion: NextRequest) {
  const host = peticion.headers.get("host") ?? "";
  if (!HOST_LOCAL.test(host)) return new NextResponse("Acceso no permitido.", { status: 403 });
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.png).*)"],
};
