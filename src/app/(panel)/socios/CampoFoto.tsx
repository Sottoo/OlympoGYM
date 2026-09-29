"use client";

import { useEffect, useRef, useState } from "react";
import { Icono } from "@/presentation/components/Icono";

/** La foto se recorta cuadrada y se reduce a este tamaño: ~50 KB en lugar de 3 MB. */
const LADO_PX = 480;
const CALIDAD = 0.82;

/**
 * Foto opcional del socio: se toma con la cámara de la computadora o se sube
 * un archivo. Se reduce aquí mismo y viaja al servidor en el campo "foto".
 */
export function CampoFoto({ fotoActual }: { fotoActual?: string | null }) {
  const campoFoto = useRef<HTMLInputElement>(null);
  const selector = useRef<HTMLInputElement>(null);
  const [vista, setVista] = useState<string | null>(fotoActual ?? null);
  const [quitar, setQuitar] = useState(false);
  const [camaraAbierta, setCamaraAbierta] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const archivoElegido = useRef<File | null>(null);

  useEffect(() => () => liberar(vista), [vista]);

  // React limpia el formulario al enviarlo; si vuelve con un error, la foto
  // elegida se repone para no tener que tomarla otra vez.
  useEffect(() => {
    const formulario = campoFoto.current?.form;
    const reponer = () =>
      setTimeout(() => {
        if (!archivoElegido.current || !campoFoto.current) return;
        const lista = new DataTransfer();
        lista.items.add(archivoElegido.current);
        campoFoto.current.files = lista.files;
      });
    formulario?.addEventListener("reset", reponer);
    return () => formulario?.removeEventListener("reset", reponer);
  }, []);

  async function usarImagen(fuente: CanvasImageSource, ancho: number, alto: number) {
    const lienzo = document.createElement("canvas");
    lienzo.width = lienzo.height = LADO_PX;
    const lado = Math.min(ancho, alto);
    lienzo.getContext("2d")?.drawImage(fuente, (ancho - lado) / 2, (alto - lado) / 2, lado, lado, 0, 0, LADO_PX, LADO_PX);
    const imagen = await new Promise<Blob | null>((r) => lienzo.toBlob(r, "image/webp", CALIDAD));
    if (!imagen || !campoFoto.current) return setError("No se pudo preparar la foto. Intenta de nuevo.");

    const archivo = new File([imagen], "foto.webp", { type: imagen.type });
    const lista = new DataTransfer();
    lista.items.add(archivo);
    campoFoto.current.files = lista.files;
    archivoElegido.current = archivo;
    setVista(URL.createObjectURL(archivo));
    setQuitar(false);
    setError(null);
  }

  async function alElegirArchivo(evento: React.ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0];
    evento.target.value = "";
    if (!archivo) return;
    try {
      const mapa = await createImageBitmap(archivo);
      await usarImagen(mapa, mapa.width, mapa.height);
      mapa.close();
    } catch {
      setError("Esa imagen no se pudo abrir. Prueba con una foto JPG o PNG.");
    }
  }

  function quitarFoto() {
    if (campoFoto.current) campoFoto.current.files = new DataTransfer().files;
    archivoElegido.current = null;
    setVista(null);
    setQuitar(Boolean(fotoActual));
  }

  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-md border border-linea bg-hundido">
        {vista ? (
          // eslint-disable-next-line @next/next/no-img-element -- enlaces temporales y blobs locales, sin optimizar
          <img src={vista} alt="Foto del socio" className="size-full object-cover" />
        ) : (
          <Icono nombre="socios" className="size-8 text-gris" />
        )}
      </div>
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="boton-secundario boton-chico" onClick={() => setCamaraAbierta(true)}>
            Tomar foto
          </button>
          <button type="button" className="boton-secundario boton-chico" onClick={() => selector.current?.click()}>
            Subir imagen
          </button>
          {vista && (
            <button type="button" className="boton-secundario boton-chico" onClick={quitarFoto}>
              Quitar
            </button>
          )}
        </div>
        {error ? <p className="text-sm text-rojo">{error}</p> : <p className="ayuda">Opcional. Ayuda a reconocer al socio en recepción.</p>}
      </div>

      <input ref={selector} type="file" accept="image/*" className="hidden" onChange={alElegirArchivo} />
      <input ref={campoFoto} type="file" name="foto" className="hidden" tabIndex={-1} aria-hidden />
      {quitar && <input type="hidden" name="quitarFoto" value="1" />}

      {camaraAbierta && (
        <Camara
          alCerrar={() => setCamaraAbierta(false)}
          alCapturar={async (video) => {
            await usarImagen(video, video.videoWidth, video.videoHeight);
            setCamaraAbierta(false);
          }}
        />
      )}
    </div>
  );
}

function Camara({ alCapturar, alCerrar }: { alCapturar: (video: HTMLVideoElement) => void; alCerrar: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  // Con una referencia, la cámara no se reinicia cada vez que cambia la función.
  const cerrar = useRef(alCerrar);
  cerrar.current = alCerrar;

  useEffect(() => {
    let flujo: MediaStream | null = null;
    let cancelado = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      .then((f) => {
        if (cancelado) return f.getTracks().forEach((t) => t.stop());
        flujo = f;
        if (video.current) video.current.srcObject = f;
      })
      .catch(() => setError("No se encontró una cámara, o no se dio permiso para usarla."));
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && cerrar.current();
    window.addEventListener("keydown", alTeclear);
    return () => {
      cancelado = true;
      flujo?.getTracks().forEach((t) => t.stop());
      window.removeEventListener("keydown", alTeclear);
    };
  }, []);

  return (
    <div role="dialog" aria-modal="true" aria-label="Tomar foto" className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
      <div className="superficie w-full max-w-md space-y-4 p-4">
        {error ? (
          <p className="px-1 py-6 text-center text-tinta">{error}</p>
        ) : (
          // Se ve como espejo (más natural al acomodarse); la foto se guarda sin voltear.
          <video ref={video} autoPlay playsInline muted className="aspect-square w-full -scale-x-100 rounded-md bg-carbon object-cover" />
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="boton-secundario" onClick={alCerrar}>Cancelar</button>
          {!error && (
            <button
              type="button"
              className="boton"
              onClick={() => video.current?.videoWidth && alCapturar(video.current)}
            >
              Capturar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function liberar(url: string | null) {
  if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
}
