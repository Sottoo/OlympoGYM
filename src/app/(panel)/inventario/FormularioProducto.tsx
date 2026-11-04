"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { CATEGORIAS_PRODUCTO, type CategoriaProducto, type DatosProducto, type UnidadProducto } from "@/domain/entities/Producto";
import { estadoInicial } from "@/presentation/acciones/estadoFormulario";
import { BotonEnviar } from "@/presentation/components/BotonEnviar";
import { LIMITES } from "@/domain/shared/reglas";
import { pluralizar } from "@/domain/shared/texto";
import { CampoDinero, CampoNumero } from "@/presentation/components/formulario/campos";
import { CampoFoto } from "@/presentation/components/formulario/CampoFoto";
import { CantidadGranel } from "@/presentation/components/formulario/CantidadGranel";
import { AvisosDelFormulario, Ayuda, Etiqueta, Formulario } from "@/presentation/components/formulario/Formulario";
import { Selector } from "@/presentation/components/formulario/Selector";
import { Emblema } from "@/presentation/components/pictogramas/Emblema";
import { dibujoDeProducto, enlaceDeFoto } from "@/presentation/components/pictogramas/elegir";
import { SelectorSegmentado } from "@/presentation/components/SelectorSegmentado";
import { accionCrearProducto, accionEditarProducto, accionReactivarProducto, accionRevisarProducto } from "./acciones";

const FORMAS = { pieza: "Por pieza", gramo: "A granel (por scoop o gramos)" };

/** Presentaciones comunes de proteína y creatina. */
const TAMANOS = [
  { texto: "300 g", gramos: 300 },
  { texto: "1 kg", gramos: 1000 },
  { texto: "2 lb", gramos: 907 },
  { texto: "5 lb", gramos: 2268 },
  { texto: "10 lb", gramos: 4536 },
];

/** Alta o edición de un producto. El stock no se edita aquí: cambia con movimientos. */
export function FormularioProducto({
  producto,
  codigoInicial,
}: {
  producto?: DatosProducto & { id: string; foto?: string | null };
  codigoInicial?: string;
}) {
  const [estado, accion] = useActionState(producto ? accionEditarProducto : accionCrearProducto, estadoInicial);
  const v = estado.valores ?? (producto ? aTexto(producto) : { stockMinimo: "3", stockInicial: "", codigo: codigoInicial ?? "" });
  // Al salir del nombre o del código se avisa si ya los usa otro producto. Si es uno
  // desactivado, se ofrece reactivarlo ahí mismo en vez de darlo de alta dos veces.
  const [porCampo, setPorCampo] = useState<Record<string, { id: string; nombre: string } | null>>({});
  const desactivado = porCampo.nombre ?? porCampo.codigo ?? null;
  const [reactivando, iniciar] = useTransition();
  const router = useRouter();
  const [remotas] = useState(() => {
    const revisar = (campo: "nombre" | "codigo") => async (valor: string) => {
      const r = await accionRevisarProducto(campo, valor, producto?.id);
      setPorCampo((m) => ({ ...m, [campo]: r?.desactivado ?? null }));
      return r?.mensaje ?? null;
    };
    return { nombre: revisar("nombre"), codigo: revisar("codigo") };
  });
  function reactivar(d: { id: string }) {
    iniciar(async () => {
      const r = await accionReactivarProducto(d.id);
      if (r.ok) router.push(`/inventario/${d.id}?aviso=reactivado`);
    });
  }
  const [unidad, setUnidad] = useState<UnidadProducto>((v.unidad as UnidadProducto) || "pieza");
  const [nombrePorcion, setNombrePorcion] = useState(v.porcionNombre || "scoop");
  const [porcion, setPorcion] = useState(v.porcionGramos || "30");
  const [envase, setEnvase] = useState(v.envaseGramos || "");
  const [inicial, setInicial] = useState(v.stockInicial ?? "");
  const [minimo, setMinimo] = useState(v.stockMinimo ?? "3");
  // Para la vista previa: sin foto, el producto se ve con el parche que le toca por su nombre.
  const [nombreVista, setNombreVista] = useState(v.nombre ?? "");
  const [categoriaVista, setCategoriaVista] = useState<CategoriaProducto>((v.categoria as CategoriaProducto) || "suplementos");
  const dibujo = dibujoDeProducto({ nombre: nombreVista, categoria: categoriaVista });
  const granel = unidad === "gramo";
  const porcionGramos = Number(porcion) || 0;
  const envaseGramos = Number(envase) || 0;
  const plural = (palabra: string) => pluralizar(palabra);
  const datosGranel = { porcionGramos: porcionGramos || 1, porcionNombre: nombrePorcion || "porción", envaseGramos: envaseGramos || null };
  // El mínimo de fábrica (3) tiene sentido en piezas; a granel se propone el equivalente a 10 porciones.
  function cambiarForma(nueva: UnidadProducto) {
    setUnidad(nueva);
    if (!producto && nueva === "gramo" && minimo === "3") setMinimo(String((Number(porcion) || 30) * 10));
    if (!producto && nueva === "pieza" && minimo === String((Number(porcion) || 30) * 10)) setMinimo("3");
  }

  return (
    <Formulario action={accion} estado={estado} remotas={remotas} avisosManuales className="superficie">
      {producto && <input type="hidden" name="productoId" value={producto.id} />}
      <div className="space-y-6 p-5 sm:p-7">
        <AvisosDelFormulario />
        {desactivado && !producto && (
          <div role="status" className="aparece flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[10px] bg-ambar-tenue px-4 py-3 text-[0.9rem]">
            <span className="min-w-0 flex-1">
              <strong className="font-semibold">«{desactivado.nombre}» ya lo tienes, desactivado.</strong> Reactívalo y conserva su historial y existencia.
            </span>
            <button type="button" onClick={() => reactivar(desactivado)} disabled={reactivando} className="boton boton-chico">
              {reactivando ? "Reactivando…" : "Reactivarlo"}
            </button>
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div>
            <Etiqueta para="nombre">Nombre del producto</Etiqueta>
            <input
              id="nombre"
              name="nombre"
              required
              maxLength={LIMITES.nombreProducto}
              className="campo"
              defaultValue={v.nombre}
              placeholder="Ej. Proteína whey 2 lb, vainilla"
              data-regla="texto:2"
              data-falta="Escribe el nombre del producto."
              onChange={(e) => setNombreVista(e.target.value)}
            />
            <Ayuda para="nombre">Marca, presentación y sabor: así lo encuentra recepción.</Ayuda>
          </div>
          <div>
            <label htmlFor="categoria" className="etiqueta">Categoría</label>
            <Selector
              id="categoria"
              nombre="categoria"
              valorInicial={v.categoria ?? "suplementos"}
              opciones={Object.entries(CATEGORIAS_PRODUCTO).map(([valor, texto]) => ({ valor, texto }))}
              alCambiar={(c) => setCategoriaVista(c as CategoriaProducto)}
            />
          </div>
          <div className="sm:col-span-2">
            <Etiqueta para="codigo" opcional>
              Código de barras o clave
            </Etiqueta>
            <input
              id="codigo"
              name="codigo"
              maxLength={LIMITES.codigo}
              autoComplete="off"
              className="campo max-w-xs uppercase tabular-nums"
              placeholder="Ej. 7501234567890"
              defaultValue={v.codigo}
              data-filtro="codigo"
            />
            <Ayuda para="codigo">Escanéalo aquí con el lector o escríbelo. En Tienda se agrega al instante al escanearlo.</Ayuda>
          </div>
        </div>

        <div className="border-t border-linea pt-6">
          <fieldset>
            <legend className="rotulo mb-4">
              Foto <span className="font-sans normal-case tracking-normal text-gris">(opcional)</span>
            </legend>
            <CampoFoto
              forma="etiqueta"
              espejo={false}
              fotoActual={enlaceDeFoto(producto?.foto)}
              alt="Foto del producto"
              vacio={<Emblema pictograma={dibujo.pictograma} hilo={dibujo.hilo} tamano="xl" key={`${dibujo.pictograma}-${dibujo.hilo}`} />}
              ayuda="Así la reconoce recepción en la Tienda. Sin foto se ve con su parche bordado, como el de aquí."
            />
          </fieldset>
        </div>

        <div className="border-t border-linea pt-6">
          <fieldset>
            <legend className="rotulo mb-4">Cómo se vende</legend>
            <SelectorSegmentado nombre="unidad" opciones={FORMAS} valor={unidad} alCambiar={(u) => cambiarForma(u as UnidadProducto)} />
            <p className="mensaje-campo">
              {granel
                ? "Se vende por porción (scoop, servicio) o por gramos exactos. Tú cuentas en botes y el sistema lleva los gramos."
                : "Botellas, barras, shakers… La existencia se cuenta en piezas."}
            </p>
            {producto && unidad !== producto.unidad && <Ayuda para="unidad">Solo se puede cambiar si su existencia está en 0.</Ayuda>}
          </fieldset>

          {granel && (
            <div className="mt-5 grid gap-5 sm:grid-cols-3">
              <div>
                <Etiqueta para="porcionNombre">Se le dice</Etiqueta>
                <input
                  id="porcionNombre"
                  name="porcionNombre"
                  maxLength={20}
                  className="campo"
                  defaultValue={v.porcionNombre || "scoop"}
                  placeholder="scoop"
                  data-filtro="nombre"
                  onChange={(e) => setNombrePorcion(e.target.value || "porción")}
                />
                <Ayuda para="porcionNombre">Scoop, servicio, medida…</Ayuda>
              </div>
              <div>
                <Etiqueta para="porcionGramos">Gramos por {nombrePorcion}</Etiqueta>
                <CampoNumero
                  id="porcionGramos"
                  nombre="porcionGramos"
                  min={1}
                  max={1000}
                  requerido
                  unidad="g"
                  valor={porcion}
                  alCambiar={setPorcion}
                  atributos={{ "data-que": "La porción", "data-falta": "¿Cuántos gramos lleva?" }}
                />
                <Ayuda para="porcionGramos">Un scoop de proteína ≈ 30 g; de creatina ≈ 5 g.</Ayuda>
              </div>
              <div>
                <Etiqueta para="envaseGramos">Gramos por bote</Etiqueta>
                <CampoNumero
                  id="envaseGramos"
                  nombre="envaseGramos"
                  min={1}
                  max={50000}
                  requerido
                  unidad="g"
                  valor={envase}
                  alCambiar={setEnvase}
                  atributos={{ "data-que": "El contenido del bote", "data-falta": "¿Cuántos gramos trae el bote? Viene en la etiqueta." }}
                />
                <div className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Tamaños comunes">
                  {TAMANOS.map((t) => (
                    <button
                      key={t.texto}
                      type="button"
                      onClick={() => setEnvase(String(t.gramos))}
                      aria-pressed={envaseGramos === t.gramos}
                      className={`rounded-full border px-2.5 py-0.5 text-[0.76rem] font-semibold ${envaseGramos === t.gramos ? "border-tinta bg-tinta text-[#f2efe8]" : "border-linea-fuerte text-gris hover:text-tinta"}`}
                    >
                      {t.texto}
                    </button>
                  ))}
                </div>
                <Ayuda para="envaseGramos">
                  {envaseGramos ? `Rinde ≈ ${Math.floor(envaseGramos / (porcionGramos || 1))} ${plural(nombrePorcion)}.` : "Viene en la etiqueta; o toca un tamaño común."}
                </Ayuda>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-linea pt-6">
          <p className="rotulo mb-4">Precio</p>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Etiqueta para="precioVenta">{granel ? `Precio por ${nombrePorcion}` : "Precio de venta"}</Etiqueta>
              <CampoDinero
                id="precioVenta"
                nombre="precioVenta"
                requerido
                valorInicial={v.precioVenta}
                atributos={{ "data-regla": "precio", "data-que": "El precio de venta", "data-falta": "Escribe el precio de venta." }}
              />
              <Ayuda para="precioVenta">
                {granel ? "También se puede vender por gramos exactos; se cobra en proporción." : "Lo que paga el cliente por pieza."}
              </Ayuda>
            </div>
            <div>
              <Etiqueta para="costo" opcional>
                {granel ? "Costo por bote" : "Costo por pieza"}
              </Etiqueta>
              <CampoDinero id="costo" nombre="costo" valorInicial={v.costo} atributos={{ "data-que": "El costo" }} />
              <Ayuda para="costo">Lo que le pagas al proveedor. Sirve para ver el margen.</Ayuda>
            </div>
          </div>
        </div>

        <div className="border-t border-linea pt-6">
          <p className="rotulo mb-4">Existencias</p>
          {granel ? (
            <div className="grid gap-5 sm:grid-cols-2">
              {!producto && (
                <div>
                  <Etiqueta para="stockInicial">¿Cuánto tienes hoy?</Etiqueta>
                  <CantidadGranel
                    id="stockInicial"
                    nombre="stockInicial"
                    granel={datosGranel}
                    gramos={Number(inicial) || 0}
                    alCambiar={(g, escrito) => setInicial(escrito ? String(g) : "")}
                    requerido
                    pista="Por ejemplo, 2 botes. Si todavía no tienes, escribe 0."
                  />
                  <Ayuda para="stockInicial">Se registra como la primera entrada del producto.</Ayuda>
                </div>
              )}
              <div>
                <Etiqueta para="stockMinimo">Avisarme cuando queden</Etiqueta>
                <CantidadGranel
                  id="stockMinimo"
                  nombre="stockMinimo"
                  granel={datosGranel}
                  gramos={Number(minimo) || 0}
                  alCambiar={(g, escrito) => setMinimo(escrito ? String(g) : "")}
                />
                <Ayuda para="stockMinimo">Al llegar ahí, aparece en «Por resurtir» y en la lista de compra.</Ayuda>
              </div>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              {!producto && (
                <div>
                  <Etiqueta para="stockInicial">Piezas en existencia hoy</Etiqueta>
                  <CampoNumero
                    id="stockInicial"
                    nombre="stockInicial"
                    min={0}
                    max={LIMITES.piezasMaximas}
                    requerido
                    unidad="piezas"
                    valor={inicial}
                    alCambiar={setInicial}
                    className="max-w-60"
                    atributos={{ "data-que": "La existencia", "data-falta": "Escribe cuántas hay (0 si ninguna)." }}
                  />
                  <Ayuda para="stockInicial">Se registra como la primera entrada del producto.</Ayuda>
                </div>
              )}
              <div>
                <Etiqueta para="stockMinimo">Stock mínimo</Etiqueta>
                <CampoNumero
                  id="stockMinimo"
                  nombre="stockMinimo"
                  min={0}
                  max={LIMITES.piezasMaximas}
                  requerido
                  unidad="piezas"
                  valor={minimo}
                  alCambiar={setMinimo}
                  className="max-w-60"
                  atributos={{ "data-que": "El stock mínimo", "data-falta": "Escribe el mínimo (0 si no aplica)." }}
                />
                <Ayuda para="stockMinimo">Al llegar a esta cantidad, el producto aparece en «Por resurtir».</Ayuda>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-linea bg-hundido/60 px-5 py-4 sm:px-7">
        <BotonEnviar textoEnviando="Guardando…">{producto ? "Guardar cambios" : "Dar de alta producto"}</BotonEnviar>
        <Link href={producto ? `/inventario/${producto.id}` : "/inventario"} className="boton-secundario">Cancelar</Link>
      </div>
    </Formulario>
  );
}

function aTexto(p: DatosProducto): Record<string, string> {
  return {
    nombre: p.nombre,
    categoria: p.categoria,
    codigo: p.codigo ?? "",
    precioVenta: String(p.precioVenta),
    costo: p.costo === null ? "" : String(p.costo),
    stockMinimo: String(p.stockMinimo),
    unidad: p.unidad,
    porcionGramos: p.porcionGramos === null ? "" : String(p.porcionGramos),
    porcionNombre: p.porcionNombre ?? "",
    envaseGramos: p.envaseGramos === null ? "" : String(p.envaseGramos),
  };
}
