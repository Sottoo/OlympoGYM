import { tamanoDeCifra } from "@/shared/formato";
import { CifraAnimada } from "./CifraAnimada";
import { Icono, type NombreIcono } from "./Icono";

export interface Cifra {
  etiqueta: string;
  valor: React.ReactNode;
  detalle?: React.ReactNode;
  /** La cifra se pinta en ladrillo cuando pide atención inmediata. */
  alerta?: boolean;
  /** La cifra principal de la pantalla: va en la etiqueta negra. */
  destacada?: boolean;
  /** Dibujo del parchecito junto al nombre: dice de qué es la cifra sin leer. */
  icono?: NombreIcono;
  /** Contra qué se compara, en corto ("+3", "−12 %"): va en un botoncito junto al nombre. */
  comparacion?: {
    texto: string;
    sentido: "sube" | "baja" | "igual";
    /** Cuando subir es malo (p. ej. fallas). */
    subirEsMalo?: boolean;
    /** Contra qué se compara ("vs. el martes pasado"): se lee al pasar el cursor. */
    contra?: string;
  };
  /** Barritas junto a la cifra: cómo se reparte (por hora, por día, por mes). La resaltada es "esta". */
  barras?: { valores: number[]; resaltar?: number; titulo: string };
  /** Hilo de avance bajo la cifra: cuánto es de un total (surtidos de todos, vigentes de todos…). */
  avance?: { valor: number; total: number; tono?: "verde" | "rojo" | "ambar" | "tinta" };
}

/** Comparación de dos cantidades, lista para la etiqueta: "+3", "−2" o "igual". */
export function compararCon(actual: number, antes: number, { porcentaje = false, contra }: { porcentaje?: boolean; contra?: string } = {}): NonNullable<Cifra["comparacion"]> {
  const d = actual - antes;
  if (Math.abs(d) < 0.005) return { texto: "igual", sentido: "igual", contra };
  const valor = porcentaje && antes > 0 ? `${Math.round((Math.abs(d) / antes) * 100)} %` : Math.abs(Math.round(d * 100) / 100).toLocaleString("es-MX");
  return { texto: `${d > 0 ? "+" : "−"}${valor}`, sentido: d > 0 ? "sube" : "baja", contra };
}

/** Tantas columnas como etiquetas (hasta 4): una fila nunca queda con un hueco. */
const COLUMNAS = ["", "grid-cols-1", "grid-cols-2", "grid-cols-3", "grid-cols-2 lg:grid-cols-4"];

/**
 * Cifras clave en etiquetas tejidas, como la que va cosida dentro de una
 * prenda. La destacada va en negro; la que pide atención, con orilla roja.
 */
export function Marcador({ cifras }: { cifras: Cifra[] }) {
  return (
    <dl className={`grid gap-4 ${COLUMNAS[Math.min(cifras.length, 4)]}`}>
      {cifras.map((c) => (
        <EtiquetaCifra key={c.etiqueta} cifra={c} />
      ))}
    </dl>
  );
}

/**
 * Una etiqueta tejida. Siempre en el mismo orden y en la misma altura: arriba
 * el nombre con su parche, luego la cifra, y la explicación abajo del todo;
 * así, en una fila, las cifras y los detalles quedan alineados entre sí.
 * `compacta` es para cifras de texto (un plan, una fecha) en una ficha.
 */
export function EtiquetaCifra({ cifra: c, compacta = false, className = "" }: { cifra: Cifra; compacta?: boolean; className?: string }) {
  const tono = c.destacada ? "negra" : c.alerta ? "alerta" : "";
  return (
    <div className={`etiqueta-tejida ${compacta ? "etiqueta-compacta" : ""} ${tono} ${className}`}>
      <dt className="etiqueta-nombre">
        {c.icono && (
          <span aria-hidden className="etiqueta-parche">
            <Icono nombre={c.icono} className="size-[14px]" />
          </span>
        )}
        <span className="truncate">{c.etiqueta}</span>
        {c.comparacion && <Comparacion {...c.comparacion} />}
      </dt>
      <dd className="etiqueta-fila">
        <span
          className={`cifra etiqueta-valor whitespace-nowrap ${
            compacta ? (typeof c.valor === "string" && c.valor.length > 10 ? "text-[1.3rem]" : "text-[1.55rem]") : tamanoDeCifra(c.valor)
          } ${c.alerta && !c.destacada ? "text-rojo" : ""}`}
        >
          {typeof c.valor === "number" ? <CifraAnimada valor={c.valor} /> : c.valor}
        </span>
        {c.barras && c.barras.valores.length > 1 && <Barritas {...c.barras} />}
      </dd>
      {c.avance && c.avance.total > 0 && <Avance {...c.avance} />}
      {c.detalle && <dd className="etiqueta-detalle">{c.detalle}</dd>}
    </div>
  );
}

/** El botoncito de comparación: verde si va bien, ladrillo si va mal, gris si quedó igual. */
function Comparacion({ texto, sentido, subirEsMalo = false, contra }: NonNullable<Cifra["comparacion"]>) {
  const bien = sentido === "igual" ? null : (sentido === "sube") !== subirEsMalo;
  return (
    <span title={contra} className={`etiqueta-comparacion ${bien === null ? "" : bien ? "va-bien" : "va-mal"}`}>
      <span aria-hidden>{sentido === "sube" ? "▲" : sentido === "baja" ? "▼" : "="}</span>
      {texto}
      {contra && <span className="sr-only"> {contra}</span>}
    </span>
  );
}

/**
 * Barritas bordadas: cada valor es una puntada vertical. Las de cero se ven
 * como un punto, para que se note que ese día u hora sí cuenta, pero vacío.
 */
function Barritas({ valores, resaltar, titulo }: NonNullable<Cifra["barras"]>) {
  const max = Math.max(1, ...valores);
  const ancho = Math.min(7, Math.max(2.4, 96 / valores.length - 1.6));
  const paso = ancho + (valores.length > 20 ? 1.2 : 2.2);
  const total = paso * valores.length - (paso - ancho);
  return (
    <svg role="img" aria-label={titulo} viewBox={`0 0 ${total} 34`} className="etiqueta-barras" style={{ width: Math.min(112, total) }} preserveAspectRatio="none">
      <title>{titulo}</title>
      {valores.map((v, i) => {
        const alto = v === 0 ? ancho : Math.max(ancho, (v / max) * 34);
        return (
          <rect
            key={i}
            x={i * paso}
            y={34 - alto}
            width={ancho}
            height={alto}
            rx={ancho / 2}
            className={i === resaltar ? "barra-resaltada" : v === 0 ? "barra-vacia" : "barra"}
            style={{ animationDelay: `${120 + i * (valores.length > 20 ? 12 : 35)}ms` }}
          />
        );
      })}
    </svg>
  );
}

/** Hilo de avance: una costura que se llena hasta la proporción. */
function Avance({ valor, total, tono = "tinta" }: NonNullable<Cifra["avance"]>) {
  const parte = Math.max(0, Math.min(1, valor / total));
  return (
    <dd aria-hidden className={`etiqueta-avance tono-${tono}`}>
      <span style={{ width: `${Math.round(parte * 100)}%` }} />
    </dd>
  );
}
