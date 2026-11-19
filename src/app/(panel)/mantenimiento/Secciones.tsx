import { Pestanas } from "@/presentation/components/Pestanas";

/** Las tres vistas de la administración: máquinas, mantenimientos hechos con su gasto y lo que se debe. */
export function SeccionesDeMantenimiento({ activa, porPagar }: { activa: "equipos" | "historial" | "por-pagar"; porPagar: number }) {
  return (
    <Pestanas
      etiqueta="Secciones de máquinas"
      opciones={[
        { href: "/mantenimiento", texto: "Máquinas", activa: activa === "equipos" },
        { href: "/mantenimiento/historial", texto: "Mantenimientos y gastos", activa: activa === "historial" },
        { href: "/mantenimiento/por-pagar", texto: "Por pagar", cuenta: porPagar, activa: activa === "por-pagar" },
      ]}
    />
  );
}
