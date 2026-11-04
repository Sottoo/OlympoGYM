import type { AreaEquipo } from "@/domain/entities/Mantenimiento";
import type { CategoriaProducto } from "@/domain/entities/Producto";
import { claveDeNombre } from "@/domain/shared/texto";
import { HILO_DE_AREA, HILO_DE_CATEGORIA, type Hilo } from "./Emblema";
import type { NombrePictograma } from "./Pictograma";

/**
 * Qué dibujo le toca a cada cosa, por su nombre: "Agua natural 1 L" →
 * botella; "Proteína whey (por scoop)" → bote con scoop. Las palabras se
 * revisan en orden (lo más específico primero). Si nada coincide, el
 * dibujo de su categoría o área.
 */
const PRODUCTOS: [RegExp, NombrePictograma][] = [
  [/lista para tomar|\brtd\b|shake listo/, "agua"],
  // Antes que "proteína": una barra o galleta de proteína se ve como lo que es.
  [/barra|barrita|\bbar\b/, "barra"],
  [/galleta|cookie|brownie|panque|muffin/, "galleta"],
  [/gomita|gummy|gummies|panditas/, "gomitas"],
  [/\bpapas\b|fritura|\bchips\b|totopo|palomita|churrito|botana/, "papas"],
  // El sobre antes que el suero: "electrolitos en sobre" es un sobre.
  [/\bsobre|sachet|\bstick\b|\bgel\b/, "sobre"],
  [/\bscoop|por porcion|servido\b/, "scoop"],
  [/\bpre[\s-]?entreno|pre[\s-]?workout|\bpre\b|cafeina/, "preentreno"],
  [/creatina/, "creatina"],
  [/bcaa|aminoacido|glutamina|capsula|pastilla|tableta|vitamin|omega|quemador/, "capsulas"],
  [/proteina|whey|isolat|caseina|gainer|ganador|masa muscular/, "proteina"],
  // Después de la proteína: "proteína sabor chocolate" sigue siendo proteína.
  [/chocolate|\bchoco/, "chocolate"],
  [/energetic|energy|monster|red ?bull|volt|lata|refresco|soda/, "lata"],
  [/suero|electrolit|isotonic|gatorade|powerade|hidrat|electrolife/, "suero"],
  [/\bcafe\b|capuchino|cappuccino|latte|americano|espresso|\bte\b(?! helado)/, "cafe"],
  [/agua|bebida|jugo|te helado/, "agua"],
  [/cacahuate|nuez|nueces|almendra|semilla|mix|cacahuates|pistache|arandano/, "nueces"],
  [/fruta|platano|manzana|naranja|pera\b|uva/, "fruta"],
  [/termo|vaso termico/, "termo"],
  [/shaker|vaso|botella mezcladora|cilindro/, "shaker"],
  [/toalla/, "toalla"],
  [/guante/, "guantes"],
  [/munequer|vendas?\b|rodiller|codera|straps?|agarradera/, "munequera"],
  [/cinturon|faja/, "cinturon"],
  [/candado|llave|locker|casillero/, "candado"],
  [/gorra|cachucha|visera/, "gorra"],
  [/calceta|calcetin|\btines\b/, "calcetas"],
  [/sudadera|hoodie|chamarra|chaqueta/, "sudadera"],
  [/\bshorts?\b|bermuda/, "short"],
  [/\bpants\b|leggin|malla|jogger/, "pants"],
  [/playera|camiseta|tank|top\b|ropa/, "playera"],
  [/maleta|mochila|backpack|bolsa deportiva|gym bag/, "maleta"],
  [/cuerda|soga|para saltar/, "cuerda"],
  [/\bligas?\b|banda elastica|banda de resistencia|mini ?band/, "ligas"],
  [/tapete|\bmat\b|colchoneta|yoga/, "tapete"],
  [/rodillo|foam|roller/, "rodillo"],
  [/kettlebell|pesa rusa/, "kettlebell"],
  [/mancuerna|pesa/, "mancuerna"],
];

const DE_CATEGORIA: Record<CategoriaProducto, NombrePictograma> = {
  bebidas: "agua",
  suplementos: "proteina",
  snacks: "barra",
  accesorios: "mancuerna",
  ropa: "playera",
  otros: "etiqueta",
};

const EQUIPOS: [RegExp, NombrePictograma][] = [
  [/caminadora|banda (de )?correr|treadmill/, "caminadora"],
  [/eliptica/, "eliptica"],
  [/spinning|indoor/, "spinning"],
  [/bici|bicicleta|cicl/, "bicicleta"],
  [/escaladora|escalera|stair|stepper/, "escaladora"],
  [/remo\b(?! sentado)|remadora|rower/, "remadora"],
  [/kettlebell|pesa rusa/, "kettlebell"],
  [/\bdiscos?\b|platos? de peso/, "disco"],
  [/\bsaco\b|costal|boxeo|\bbox\b/, "saco"],
  [/\bsteps?\b|cajon|plio/, "step"],
  [/bascula|balanza|peso corporal/, "bascula"],
  [/balon|pelota|fitball|bosu/, "pelota"],
  [/mancuernero|mancuernas/, "mancuernero"],
  [/rack|jaula|power|sentadilla libre/, "rack"],
  [/banco|banca/, "banco"],
  [/barra olimpica|barra z|barra recta|\bbarras\b/, "barra_olimpica"],
  [/ventilador/, "ventilador"],
  [/aire|clima|minisplit|extractor/, "aire"],
  [/bebedero|garrafon|dispensador|despachador de agua/, "bebedero"],
  [/locker|casillero/, "casilleros"],
  [/\bluz\b|luces|lampara|foco|iluminacion|luminaria/, "foco"],
  [/regadera|calentador|boiler|bano|sanitario|vestidor|lavabo/, "regadera"],
  [/sonido|bocina|audio|musica|pantalla|tele/, "sonido"],
  [/prensa|smith|polea|jalon|extension|femoral|hack|multi|estacion|maquina|press|remo sentado|peck|aductor|abductor|gluteo|pantorrilla/, "estacion"],
];

const DE_AREA: Record<AreaEquipo, NombrePictograma> = {
  cardio: "caminadora",
  fuerza: "estacion",
  peso_libre: "mancuerna",
  instalaciones: "herramienta",
  otro: "herramienta",
};

/** Enlace para mostrar una foto guardada (las sirve /api/fotos, con sesión iniciada). */
export const enlaceDeFoto = (ruta: string | null | undefined) => (ruta ? `/api/fotos/${ruta}` : null);

/**
 * Cómo se ve un producto: su foto si tiene; si no, su parche bordado. Se
 * esparce tal cual en <Emblema {...dibujoDeProducto(p)} />.
 */
export function dibujoDeProducto(p: { nombre: string; categoria: CategoriaProducto; foto?: string | null }): {
  pictograma: NombrePictograma;
  hilo: Hilo;
  foto: string | null;
} {
  const nombre = claveDeNombre(p.nombre);
  const encontrado = PRODUCTOS.find(([patron]) => patron.test(nombre))?.[1];
  return { pictograma: encontrado ?? DE_CATEGORIA[p.categoria] ?? "etiqueta", hilo: HILO_DE_CATEGORIA[p.categoria] ?? "gris", foto: enlaceDeFoto(p.foto) };
}

export function dibujoDeEquipo(e: { nombre: string; area: AreaEquipo }): { pictograma: NombrePictograma; hilo: Hilo } {
  const nombre = claveDeNombre(e.nombre);
  const encontrado = EQUIPOS.find(([patron]) => patron.test(nombre))?.[1];
  return { pictograma: encontrado ?? DE_AREA[e.area] ?? "herramienta", hilo: HILO_DE_AREA[e.area] ?? "gris" };
}

export const DIBUJO_DE_CATEGORIA = DE_CATEGORIA;
