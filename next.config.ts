import path from "node:path";
import type { NextConfig } from "next";
import paquete from "./package.json";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Oculta el botón "N" de Next.js que aparece abajo al desarrollar.
  devIndicators: false,
  // Genera un servidor autónomo que la app de escritorio (electron/) lleva dentro.
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname),
  // La base de desarrollo nunca va dentro del instalador.
  outputFileTracingExcludes: { "*": [".datos/**"] },
  // La versión de package.json queda grabada en el programa (se ve en «Mi cuenta»).
  env: { VERSION_PROGRAMA: paquete.version },
  experimental: {
    // Volver a una sección vista hace menos de 30 s es instantáneo. Cada vez que
    // se guarda algo (entrada, venta, socio…) esta memoria se borra sola.
    staleTimes: { dynamic: 30 },
    // Restaurar sube el respaldo completo (base y fotos) en una sola acción.
    serverActions: { bodySizeLimit: "500mb" },
  },
};

export default nextConfig;
