"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import logoBlanco from "../marca/logo-blanco.png";
import type { TarjetaMensaje } from "../whatsapp";

/**
 * La imagen que acompaña al mensaje de WhatsApp: el aviso en grande sobre la
 * tela negra del parche, con el logo bordado y la costura punteada. Se
 * dibuja aquí mismo (canvas, 1080 × 1080) con las fuentes de la app, y se
 * copia al portapapeles para pegarla en el chat.
 */

export interface DatosTarjeta extends TarjetaMensaje {
  socio: string;
  plan: string | null;
  cumpleHoy: boolean;
}

export interface ManejoTarjeta {
  /** La imagen como PNG (null si todavía no se dibuja). */
  png: () => Promise<Blob | null>;
}

const LADO = 1080;
const TELA = "#141312";
const ALGODON = "#eeebe4";
const HILO = "#d8402f"; // el rojo de la marca, más vivo para leerse sobre negro
const LISTON = "#a8231b";

export const TarjetaWhatsApp = forwardRef<ManejoTarjeta, { datos: DatosTarjeta; className?: string }>(function TarjetaWhatsApp({ datos, className = "" }, ref) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const listo = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    const canvas = lienzo.current;
    if (!canvas) return;
    let vigente = true;
    listo.current = dibujar(canvas, datos, () => vigente);
    return () => {
      vigente = false;
    };
  }, [datos]);

  useImperativeHandle(ref, () => ({
    async png() {
      await listo.current;
      const canvas = lienzo.current;
      if (!canvas) return null;
      return new Promise((resolver) => canvas.toBlob(resolver, "image/png"));
    },
  }));

  return <canvas ref={lienzo} width={LADO} height={LADO} role="img" aria-label={`${datos.titulo}. ${datos.detalle}`} className={className} />;
});

async function dibujar(canvas: HTMLCanvasElement, d: DatosTarjeta, sigueVigente: () => boolean) {
  // Solo la cara real de cada fuente: la de respaldo que agrega Next ("… Fallback")
  // cubre todas las letras y taparía a Marcellus.
  const raiz = getComputedStyle(document.documentElement);
  const cara = (variable: string) => raiz.getPropertyValue(variable).split(",")[0].trim();
  // Como en la app: el cero sale de Archivo, porque el de Marcellus se lee como "O".
  const titulos = [cara("--fuente-cero"), cara("--fuente-titulos"), "Georgia, serif"].filter(Boolean).join(", ");
  const texto = [cara("--fuente-texto"), "system-ui, sans-serif"].filter(Boolean).join(", ");
  const [logo] = await Promise.all([
    cargarImagen(logoBlanco.src),
    document.fonts.load(`400 100px ${titulos}`),
    document.fonts.load(`700 30px ${texto}`),
    document.fonts.load(`400 30px ${texto}`),
  ]);
  if (!sigueVigente()) return;

  const g = canvas.getContext("2d")!;
  g.reset();
  g.textAlign = "center";
  g.textBaseline = "alphabetic";

  // Tela y costura.
  g.fillStyle = TELA;
  g.fillRect(0, 0, LADO, LADO);
  g.save();
  g.strokeStyle = "rgb(238 235 228 / 0.3)";
  g.lineWidth = 3;
  g.setLineDash([16, 12]);
  g.beginPath();
  g.roundRect(34, 34, LADO - 68, LADO - 68, 30);
  g.stroke();
  g.restore();

  // Logo bordado.
  const altoLogo = 230;
  const anchoLogo = (logo.width / logo.height) * altoLogo;
  g.drawImage(logo, (LADO - anchoLogo) / 2, 92, anchoLogo, altoLogo);

  // Rótulo, título y fecha.
  conLetra(g, `700 30px ${texto}`, 7, () => {
    g.fillStyle = HILO;
    g.fillText(d.rotulo.toUpperCase(), LADO / 2, 400);
  });
  g.fillStyle = d.urgente ? "#f0a093" : ALGODON;
  g.font = `400 ${ajustar(g, d.titulo, `px ${titulos}`, 118, LADO - 200)}px ${titulos}`;
  g.fillText(d.titulo, LADO / 2, 528);
  g.fillStyle = HILO;
  g.fillRect(LADO / 2 - 60, 566, 120, 5);
  g.fillStyle = "rgb(238 235 228 / 0.88)";
  g.font = `400 ${ajustar(g, d.detalle, `px ${texto}`, 46, LADO - 200)}px ${texto}`;
  g.fillText(d.detalle, LADO / 2, 650);

  // Socio y plan.
  g.fillStyle = "rgb(238 235 228 / 0.16)";
  g.fillRect(140, 730, LADO - 280, 2);
  const columnas = d.plan ? [LADO / 2 - 210, LADO / 2 + 210] : [LADO / 2];
  const datosSocio = [{ etiqueta: "Socio", valor: d.socio }, ...(d.plan ? [{ etiqueta: "Plan", valor: d.plan }] : [])];
  datosSocio.forEach(({ etiqueta, valor }, i) => {
    conLetra(g, `700 22px ${texto}`, 5, () => {
      g.fillStyle = "rgb(238 235 228 / 0.55)";
      g.fillText(etiqueta.toUpperCase(), columnas[i], 800);
    });
    // Un nombre largo baja a dos renglones en lugar de encogerse.
    const { tamano, renglones } = envolver(g, valor, titulos, 50, d.plan ? 380 : 700);
    g.fillStyle = ALGODON;
    g.font = `400 ${tamano}px ${titulos}`;
    const interlinea = tamano * 1.08;
    renglones.forEach((renglon, j) => g.fillText(renglon, columnas[i], 862 - (renglones.length - 1) * interlinea * 0.5 + j * interlinea));
  });

  // Qué hacer.
  g.fillStyle = "rgb(238 235 228 / 0.62)";
  g.font = `400 ${ajustar(g, d.nota, `px ${texto}`, 30, LADO - 220)}px ${texto}`;
  g.fillText(d.nota, LADO / 2, 968);

  if (d.cumpleHoy) listonDeEsquina(g, texto);
}

/** Listón rojo cosido en la esquina: "Feliz cumpleaños". */
function listonDeEsquina(g: CanvasRenderingContext2D, texto: string) {
  g.save();
  g.translate(LADO - 150, 150);
  g.rotate(Math.PI / 4);
  g.shadowColor = "rgb(0 0 0 / 0.45)";
  g.shadowBlur = 14;
  g.shadowOffsetY = 6;
  g.fillStyle = LISTON;
  g.fillRect(-330, -38, 660, 76);
  g.shadowColor = "transparent";
  g.strokeStyle = "rgb(242 239 232 / 0.7)";
  g.lineWidth = 2;
  g.setLineDash([7, 6]);
  g.strokeRect(-330, -29, 660, 58);
  g.setLineDash([]);
  conLetra(g, `800 26px ${texto}`, 5, () => {
    g.fillStyle = "#f7f3ec";
    g.textBaseline = "middle";
    g.fillText("FELIZ CUMPLEAÑOS", 0, 2);
  });
  g.restore();
}

/** Tamaño de letra que cabe en `ancho` (empieza en `maximo` y baja de 2 en 2). */
function ajustar(g: CanvasRenderingContext2D, texto: string, resto: string, maximo: number, ancho: number): number {
  let tamano = maximo;
  for (; tamano > 18; tamano -= 2) {
    g.font = `400 ${tamano}${resto}`;
    if (g.measureText(texto).width <= ancho) break;
  }
  return tamano;
}

/** Parte el texto en uno o dos renglones que quepan en `ancho`, con la letra más grande posible. */
function envolver(g: CanvasRenderingContext2D, texto: string, familia: string, maximo: number, ancho: number) {
  const palabras = texto.split(" ");
  for (let tamano = maximo; tamano > 26; tamano -= 2) {
    g.font = `400 ${tamano}px ${familia}`;
    if (g.measureText(texto).width <= ancho) return { tamano, renglones: [texto] };
    // El corte que deja los dos renglones más parejos.
    let mejor: string[] | null = null;
    for (let k = 1; k < palabras.length; k++) {
      const par = [palabras.slice(0, k).join(" "), palabras.slice(k).join(" ")];
      const anchos = par.map((r) => g.measureText(r).width);
      if (Math.max(...anchos) > ancho) continue;
      if (!mejor || Math.max(...anchos) < Math.max(...mejor.map((r) => g.measureText(r).width))) mejor = par;
    }
    if (mejor && tamano <= 44) return { tamano, renglones: mejor };
  }
  return { tamano: ajustar(g, texto, `px ${familia}`, 26, ancho), renglones: [texto] };
}

function conLetra(g: CanvasRenderingContext2D, fuente: string, espaciado: number, dibujo: () => void) {
  g.save();
  g.font = fuente;
  g.letterSpacing = `${espaciado}px`;
  dibujo();
  g.restore();
}

function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((resolver, fallar) => {
    const img = new Image();
    img.onload = () => resolver(img);
    img.onerror = fallar;
    img.src = src;
  });
}
