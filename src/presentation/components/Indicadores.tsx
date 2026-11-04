import { type Cifra, Marcador } from "./Marcador";

export type Indicador = Cifra;

/** Tira de cifras clave. Se dibuja con el marcador de estadio. */
export function Indicadores({ datos }: { datos: Indicador[] }) {
  return <Marcador cifras={datos} />;
}
