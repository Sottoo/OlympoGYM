/**
 * Hook `afterPack` de electron-builder: copia el servidor compilado dentro del
 * programa. No se usa `extraResources` porque electron-builder descarta las
 * carpetas node_modules que hay ahí, y el servidor las necesita para arrancar.
 */
const { cpSync } = require("node:fs");
const path = require("node:path");

exports.default = async function despuesDeEmpaquetar({ appOutDir }) {
  const origen = path.join(__dirname, "..", ".next", "standalone");
  cpSync(origen, path.join(appOutDir, "resources", "servidor"), { recursive: true });
};
