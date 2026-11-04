"use client";

/** Último recurso si falla la estructura completa del programa. */
export default function ErrorGeneral({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#eeebe4", color: "#161514", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ maxWidth: 460, padding: 32, textAlign: "center" }}>
          <h1 style={{ fontSize: 28, fontWeight: 600, margin: "0 0 12px" }}>El programa se detuvo a media rutina</h1>
          <p style={{ color: "#4a4741", lineHeight: 1.5 }}>
            Lo que ya estaba guardado sigue a salvo. Inténtalo de nuevo; si vuelve a pasar, cierra y abre el programa.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: 20, padding: "10px 18px", borderRadius: 10, border: 0, background: "#161514", color: "#fff", fontWeight: 700, cursor: "pointer" }}
          >
            Intentar de nuevo
          </button>
        </main>
      </body>
    </html>
  );
}
