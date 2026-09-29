"use client";

import { useFormStatus } from "react-dom";

interface Props {
  children: React.ReactNode;
  textoEnviando: string;
  variante?: "boton" | "boton-oscuro" | "boton-secundario" | "boton-peligro";
  className?: string;
  disabled?: boolean;
}

export function BotonEnviar({ children, textoEnviando, variante = "boton", className = "", disabled = false }: Props) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={`${variante} ${className}`} disabled={pending || disabled} aria-live="polite">
      {pending ? textoEnviando : children}
    </button>
  );
}
