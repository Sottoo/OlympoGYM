/** Se vuelve a montar en cada navegación: da a cada pantalla una entrada suave. */
export default function Plantilla({ children }: { children: React.ReactNode }) {
  return <div className="pantalla">{children}</div>;
}
