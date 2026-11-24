"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icono } from "@/presentation/components/Icono";
import { MenuMas, type OpcionMenu } from "@/presentation/components/MenuMas";
import { FormularioBaja } from "./FormularioBaja";
import { FormularioCorregirMembresia } from "./FormularioCorregirMembresia";
import { FormularioDevolucion } from "./FormularioDevolucion";
import { FormularioEliminarSocio } from "./FormularioEliminarSocio";
import { FormularioUnir } from "./FormularioUnir";

type Vista = "corregir" | "devolver" | "unir" | "baja" | "eliminar";

interface Props {
  socioId: string;
  nombre: string;
  /** Su membresía más reciente, si se puede corregir y quien usa el programa tiene permiso. */
  corregir?: Omit<React.ComponentProps<typeof FormularioCorregirMembresia>, "socioId" | "alCancelar"> | null;
  /** Devolver dinero de su membresía (cobrada otro día, aún vigente). */
  devolver?: Omit<React.ComponentProps<typeof FormularioDevolucion>, "socioId" | "alCancelar"> | null;
  /** Dar de baja (dejar en espera). */
  baja?: { tieneMembresiaVigente: boolean } | null;
  /** Registros con su mismo nombre. No va en el menú: se abre solo desde el aviso de repetidos. */
  unir?: { sugeridos: { id: string; texto: string }[] } | null;
  eliminar?: { tienePagos: boolean } | null;
  /** Llegó desde la lista de socios con «Unir» (?unir=1): la ventana se abre sola. */
  abrirUnir?: boolean;
}

/**
 * Las acciones poco frecuentes de la ficha (corregir, dar de baja, eliminar)
 * van juntas en «Más», para que la ficha muestre solo lo del día a día. Cada
 * una se abre en su ventana y se confirma ahí. Unir registros no va en el
 * menú: aparece solo como aviso cuando hay un repetido.
 */
export function AccionesDelSocio({ socioId, nombre, corregir, devolver, baja, unir, eliminar, abrirUnir = false }: Props) {
  const [vista, setVista] = useState<Vista | null>(null);
  // Cada vez que se abre una ventana, su formulario empieza limpio.
  const [vez, setVez] = useState(0);
  const dialogo = useRef<HTMLDialogElement>(null);

  const abrir = useCallback((v: Vista) => {
    setVista(v);
    setVez((n) => n + 1);
    dialogo.current?.showModal();
  }, []);
  const cerrar = () => dialogo.current?.close();

  // Si lo que se iba a hacer ya no aplica (por ejemplo, ya quedó de baja), la ventana se cierra.
  useEffect(() => {
    const datos = { corregir, devolver, unir, baja, eliminar };
    if (vista && !datos[vista]) dialogo.current?.close();
  }, [vista, corregir, devolver, unir, baja, eliminar]);

  // Desde la lista de socios (?unir=1): se abre sola una vez y se limpia la dirección.
  const abrioSola = useRef(false);
  useEffect(() => {
    if (!unir || !abrirUnir || abrioSola.current) return;
    abrioSola.current = true;
    const url = new URL(window.location.href);
    url.searchParams.delete("unir");
    history.replaceState(null, "", url.pathname + url.search);
    abrir("unir");
  }, [unir, abrirUnir, abrir]);

  // Desde el aviso de repetidos de esta misma ficha (#unir).
  useEffect(() => {
    if (!unir) return;
    const revisar = () => {
      if (window.location.hash !== "#unir") return;
      history.replaceState(null, "", window.location.pathname + window.location.search);
      abrir("unir");
    };
    window.addEventListener("hashchange", revisar);
    return () => window.removeEventListener("hashchange", revisar);
  }, [unir, abrir]);

  const opciones: OpcionMenu[] = [
    ...(corregir ? [{ texto: "Corregir membresía", icono: "editar" as const, alElegir: () => abrir("corregir") }] : []),
    ...(devolver ? [{ texto: "Devolución", icono: "billete" as const, alElegir: () => abrir("devolver") }] : []),
    ...(baja ? [{ texto: "Dar de baja", icono: "pausa" as const, alElegir: () => abrir("baja") }] : []),
    ...(eliminar ? [{ texto: "Eliminar para siempre", icono: "basura" as const, peligro: true, alElegir: () => abrir("eliminar") }] : []),
  ];
  if (opciones.length === 0 && !unir) return null;

  const titulos: Record<Vista, string> = {
    corregir: "Corregir membresía",
    devolver: "Devolución",
    unir: "Unir registros repetidos",
    baja: `¿Dar de baja a ${nombre}?`,
    eliminar: `¿Eliminar a ${nombre} para siempre?`,
  };

  return (
    <>
      <MenuMas opciones={opciones} />

      <dialog
        ref={dialogo}
        aria-labelledby="titulo-accion-socio"
        className="dialogo-whatsapp max-w-[34rem]"
        onClose={() => setVista(null)}
        onClick={(e) => {
          if (e.target === dialogo.current) cerrar();
        }}
      >
        {vista && (
          <div className="grid gap-4 p-6">
            <header className="flex items-start justify-between gap-4">
              <h2 id="titulo-accion-socio" className={`font-titulos text-[1.25rem] leading-tight ${vista === "eliminar" ? "text-rojo" : ""}`}>
                {titulos[vista]}
              </h2>
              <button type="button" onClick={cerrar} className="rounded-full p-1.5 text-gris hover:bg-hundido hover:text-tinta" aria-label="Cerrar">
                <Icono nombre="cerrar" className="size-5" />
              </button>
            </header>
            {vista === "corregir" && corregir && <FormularioCorregirMembresia key={vez} socioId={socioId} alCancelar={cerrar} {...corregir} />}
            {vista === "devolver" && devolver && <FormularioDevolucion key={vez} socioId={socioId} alCancelar={cerrar} {...devolver} />}
            {vista === "unir" && unir && <FormularioUnir key={vez} socioId={socioId} nombre={nombre} sugeridos={unir.sugeridos} alCancelar={cerrar} />}
            {vista === "baja" && baja && <FormularioBaja key={vez} socioId={socioId} tieneMembresiaVigente={baja.tieneMembresiaVigente} alCancelar={cerrar} />}
            {vista === "eliminar" && eliminar && <FormularioEliminarSocio key={vez} socioId={socioId} tienePagos={eliminar.tienePagos} alCancelar={cerrar} />}
          </div>
        )}
      </dialog>
    </>
  );
}
