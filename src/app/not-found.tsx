import Link from "next/link";
import { MarcaOlimpo } from "@/presentation/components/Logo";

export default function NoEncontrado() {
  return (
    <main className="mx-auto max-w-lg px-6 py-24">
      <MarcaOlimpo className="mb-6 size-12" />
      <h1 className="titulo mb-3">Esta página no está en la rutina</h1>
      <p className="mb-6 text-gris">No existe: puede que el enlace esté mal escrito o que el registro se haya eliminado.</p>
      <Link href="/panel" className="boton-oscuro">Volver a Hoy</Link>
    </main>
  );
}
