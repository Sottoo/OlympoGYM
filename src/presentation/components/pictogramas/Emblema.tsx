import type { AreaEquipo } from "@/domain/entities/Mantenimiento";
import type { CategoriaProducto } from "@/domain/entities/Producto";
import { Icono, type NombreIcono } from "../Icono";
import { type NombrePictograma, Pictograma } from "./Pictograma";

/**
 * Hilos de Olimpo: cada familia de cosas tiene su color de hilo y su tela,
 * para reconocerla de lejos (las bebidas en azul mezclilla, los
 * suplementos en rojo hilo…). Nunca es solo color: siempre va con dibujo.
 */
export const HILOS = {
  rojo: { hilo: "#a8231b", tela: "#f6e4df" },
  azul: { hilo: "#2b5784", tela: "#e3eaf2" },
  mostaza: { hilo: "#94660f", tela: "#f4ead2" },
  verde: { hilo: "#2f6b45", tela: "#e1ece3" },
  carbon: { hilo: "#2a2825", tela: "#e8e3d9" },
  gris: { hilo: "#5f5a52", tela: "#ece8df" },
  /** Parche de sección: hilo rojo vivo sobre tela negra, como el logo. */
  negro: { hilo: "#e2513f", tela: "#1b1a18" },
} as const;

export type Hilo = keyof typeof HILOS;

export const HILO_DE_CATEGORIA: Record<CategoriaProducto, Hilo> = {
  bebidas: "azul",
  suplementos: "rojo",
  snacks: "mostaza",
  accesorios: "verde",
  ropa: "carbon",
  otros: "gris",
};

export const HILO_DE_AREA: Record<AreaEquipo, Hilo> = {
  cardio: "rojo",
  fuerza: "carbon",
  peso_libre: "mostaza",
  instalaciones: "azul",
  otro: "gris",
};

const TAMANOS = { xxs: 20, xs: 24, sm: 32, md: 44, lg: 56, xl: 76 } as const;
export type TamanoEmblema = keyof typeof TAMANOS;

/**
 * El parche. Según lo que lleve:
 *  · foto: la foto del producto, impresa en una etiqueta con orilla de tela;
 *  · pictograma: el dibujo bordado y recortado por su silueta (productos y
 *    máquinas sin foto);
 *  · ícono: un parche redondo tejido con su orilla de overlock (secciones y
 *    avisos).
 */
export function Emblema({
  pictograma,
  icono,
  foto,
  hilo = "carbon",
  tamano = "md",
  apagado = false,
  className = "",
  titulo,
}: {
  pictograma?: NombrePictograma;
  icono?: NombreIcono;
  /** Enlace de la foto (si el producto tiene); manda sobre el dibujo. */
  foto?: string | null;
  hilo?: Hilo;
  tamano?: TamanoEmblema;
  /** Agotado, desactivado o dado de baja: se ve deslavado. */
  apagado?: boolean;
  className?: string;
  /** Texto para lectores de pantalla (si no, es decorativo). */
  titulo?: string;
}) {
  const t = TAMANOS[tamano];
  const { hilo: colorHilo, tela } = HILOS[hilo];
  const forma = foto ? "emblema-foto" : pictograma ? "emblema-recortado" : "emblema-redondo";
  return (
    <span
      role={titulo ? "img" : undefined}
      aria-label={titulo}
      aria-hidden={titulo ? undefined : true}
      className={`emblema ${forma} ${apagado ? "emblema-apagado" : ""} ${hilo === "negro" && !foto && !pictograma ? "emblema-negro" : ""} ${className}`}
      // En el parche recortado la tela de los recortes es la misma cruda de la orilla.
      style={{ "--t": `${t}px`, "--hilo": colorHilo, ...(pictograma && !foto ? {} : { "--tela": tela }) } as React.CSSProperties}
    >
      {foto ? (
        // eslint-disable-next-line @next/next/no-img-element -- fotos locales servidas por /api/fotos
        <img src={foto} alt="" loading="lazy" decoding="async" />
      ) : pictograma ? (
        <Pictograma nombre={pictograma} satinado={t >= 32} />
      ) : icono ? (
        <Icono nombre={icono} className="emblema-icono" />
      ) : null}
    </span>
  );
}
