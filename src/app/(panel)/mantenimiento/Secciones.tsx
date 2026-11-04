import { Pestanas } from "@/presentation/components/Pestanas";

/** Las tres vistas de la administración: equipos, historial de trabajos y lo que se debe. */
export function SeccionesDeMantenimiento({ activa, porPagar }: { activa: "equipos" | "historial" | "por-pagar"; porPagar: number }) {
  return (
    <Pestanas
      etiqueta="Secciones de mantenimiento"
      opciones={[
        { href: "/mantenimiento", texto: "Equipos", activa: activa === "equipos" },
        { href: "/mantenimiento/historial", texto: "Historial y gastos", activa: activa === "historial" },
        { href: "/mantenimiento/por-pagar", texto: "Por pagar", cuenta: porPagar, activa: activa === "por-pagar" },
      ]}
    />
  );
}
