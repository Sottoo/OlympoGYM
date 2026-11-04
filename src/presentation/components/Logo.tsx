import Image from "next/image";
import aguilaBlanca from "../marca/aguila-blanco.png";
import aguilaNegra from "../marca/aguila-negro.png";
import logoBlanco from "../marca/logo-blanco.png";

/** El logo bordado completo (OLIMPO, el águila y GYM), en hilo blanco para fondos negros. */
export function LogoBordado({ ancho = 128, className = "" }: { ancho?: number; className?: string }) {
  return <Image src={logoBlanco} alt="Olimpo GYM" width={ancho} priority className={className} />;
}

/** Solo el águila, para espacios pequeños. En blanco (fondos negros) o en negro (fondos claros). */
export function MarcaOlimpo({ className = "size-6", plana = false }: { className?: string; plana?: boolean }) {
  return <Image src={plana ? aguilaBlanca : aguilaNegra} alt="" aria-hidden className={`object-contain ${className}`} />;
}

/** Logotipo de texto: el nombre en Marcellus, espaciado como el bordado. */
export function Logo({ nombre, tamano = "normal" }: { nombre: string; tamano?: "normal" | "grande" }) {
  return (
    <span className={`inline-flex items-center gap-2.5 font-titulos tracking-[0.18em] ${tamano === "grande" ? "text-[2.2rem]" : "text-[1.3rem]"}`}>
      <MarcaOlimpo className={tamano === "grande" ? "size-14" : "size-9"} />
      {nombre.toUpperCase()}
    </span>
  );
}
