import type { CategoriaProducto, UnidadProducto } from "./Producto";

/**
 * Lo que suele venderse en la tienda de un gimnasio, para darlo de alta sin
 * escribir: se marca lo que se vende, se pone el precio y la existencia.
 * Los precios no vienen sugeridos: cada gimnasio pone los suyos.
 */
export interface ProductoDeCatalogo {
  clave: string;
  nombre: string;
  categoria: CategoriaProducto;
  unidad: UnidadProducto;
  porcionGramos?: number;
  porcionNombre?: string;
  envaseGramos?: number;
  /** Para orientar al capturar: qué es o cómo se vende. */
  nota?: string;
}

export const CATALOGO_INICIAL: ProductoDeCatalogo[] = [
  // Bebidas
  { clave: "agua-600", nombre: "Agua natural 600 ml", categoria: "bebidas", unidad: "pieza" },
  { clave: "agua-1l", nombre: "Agua natural 1 L", categoria: "bebidas", unidad: "pieza" },
  { clave: "agua-mineral", nombre: "Agua mineral 600 ml", categoria: "bebidas", unidad: "pieza" },
  { clave: "suero", nombre: "Suero oral 625 ml", categoria: "bebidas", unidad: "pieza", nota: "Electrolitos" },
  { clave: "isotonica", nombre: "Bebida isotónica 600 ml", categoria: "bebidas", unidad: "pieza" },
  { clave: "energetica", nombre: "Bebida energética 473 ml", categoria: "bebidas", unidad: "pieza" },
  { clave: "rtd", nombre: "Bebida de proteína lista para tomar", categoria: "bebidas", unidad: "pieza" },
  { clave: "cafe", nombre: "Café americano", categoria: "bebidas", unidad: "pieza", nota: "Vaso servido" },
  { clave: "electrolitos-sobre", nombre: "Electrolitos en sobre", categoria: "bebidas", unidad: "pieza", nota: "Para preparar en agua" },
  // Suplementos a granel
  { clave: "whey-scoop", nombre: "Proteína whey (por scoop)", categoria: "suplementos", unidad: "gramo", porcionGramos: 30, porcionNombre: "scoop", envaseGramos: 907, nota: "Se sirve del bote" },
  { clave: "creatina-servicio", nombre: "Creatina (por servicio)", categoria: "suplementos", unidad: "gramo", porcionGramos: 5, porcionNombre: "servicio", envaseGramos: 300, nota: "Se sirve del bote" },
  { clave: "pre-servicio", nombre: "Pre-entreno (por servicio)", categoria: "suplementos", unidad: "gramo", porcionGramos: 10, porcionNombre: "servicio", envaseGramos: 300, nota: "Se sirve del bote" },
  { clave: "bcaa-servicio", nombre: "Aminoácidos BCAA (por servicio)", categoria: "suplementos", unidad: "gramo", porcionGramos: 10, porcionNombre: "servicio", envaseGramos: 300, nota: "Se sirve del bote" },
  // Suplementos cerrados
  { clave: "whey-2lb", nombre: "Proteína whey 2 lb (bote)", categoria: "suplementos", unidad: "pieza", nota: "Bote cerrado" },
  { clave: "whey-5lb", nombre: "Proteína whey 5 lb (bote)", categoria: "suplementos", unidad: "pieza", nota: "Bote cerrado" },
  { clave: "creatina-300", nombre: "Creatina 300 g (bote)", categoria: "suplementos", unidad: "pieza", nota: "Bote cerrado" },
  { clave: "pre-bote", nombre: "Pre-entreno (bote)", categoria: "suplementos", unidad: "pieza", nota: "Bote cerrado" },
  { clave: "multivitaminico", nombre: "Multivitamínico (frasco)", categoria: "suplementos", unidad: "pieza", nota: "Cápsulas o tabletas" },
  { clave: "gel", nombre: "Gel energético", categoria: "suplementos", unidad: "pieza", nota: "Sobre individual" },
  // Snacks
  { clave: "barra", nombre: "Barra de proteína", categoria: "snacks", unidad: "pieza" },
  { clave: "galleta", nombre: "Galleta de proteína", categoria: "snacks", unidad: "pieza" },
  { clave: "cacahuates", nombre: "Cacahuates o semillas", categoria: "snacks", unidad: "pieza" },
  { clave: "fruta", nombre: "Fruta (pieza)", categoria: "snacks", unidad: "pieza" },
  { clave: "chocolate", nombre: "Chocolate amargo", categoria: "snacks", unidad: "pieza" },
  { clave: "gomitas", nombre: "Gomitas de proteína", categoria: "snacks", unidad: "pieza" },
  { clave: "papas", nombre: "Papas horneadas", categoria: "snacks", unidad: "pieza" },
  // Accesorios
  { clave: "shaker", nombre: "Shaker", categoria: "accesorios", unidad: "pieza" },
  { clave: "toalla", nombre: "Toalla", categoria: "accesorios", unidad: "pieza" },
  { clave: "guantes", nombre: "Guantes de entrenamiento", categoria: "accesorios", unidad: "pieza" },
  { clave: "munequeras", nombre: "Muñequeras", categoria: "accesorios", unidad: "pieza" },
  { clave: "cinturon", nombre: "Cinturón de levantamiento", categoria: "accesorios", unidad: "pieza" },
  { clave: "candado", nombre: "Candado para casillero", categoria: "accesorios", unidad: "pieza" },
  { clave: "termo", nombre: "Termo", categoria: "accesorios", unidad: "pieza" },
  { clave: "cuerda", nombre: "Cuerda para saltar", categoria: "accesorios", unidad: "pieza" },
  { clave: "ligas", nombre: "Ligas de resistencia", categoria: "accesorios", unidad: "pieza" },
  { clave: "tapete", nombre: "Tapete de yoga", categoria: "accesorios", unidad: "pieza" },
  { clave: "rodillo", nombre: "Rodillo de espuma", categoria: "accesorios", unidad: "pieza", nota: "Para estirar y masajear" },
  { clave: "maleta", nombre: "Maleta deportiva", categoria: "accesorios", unidad: "pieza" },
  // Ropa
  { clave: "playera", nombre: "Playera del gimnasio", categoria: "ropa", unidad: "pieza" },
  { clave: "sudadera", nombre: "Sudadera del gimnasio", categoria: "ropa", unidad: "pieza" },
  { clave: "gorra", nombre: "Gorra del gimnasio", categoria: "ropa", unidad: "pieza" },
  { clave: "short", nombre: "Short deportivo", categoria: "ropa", unidad: "pieza" },
  { clave: "pants", nombre: "Pants deportivo", categoria: "ropa", unidad: "pieza" },
  { clave: "calcetas", nombre: "Calcetas deportivas", categoria: "ropa", unidad: "pieza" },
];
