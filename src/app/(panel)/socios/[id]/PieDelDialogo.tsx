/** Pie de las ventanas de acción del socio: Cancelar a la izquierda de la acción, separados del contenido. */
export function PieDelDialogo({ alCancelar, children }: { alCancelar: () => void; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-end gap-2 border-t border-linea pt-4">
      <button type="button" className="boton-secundario" onClick={alCancelar}>
        Cancelar
      </button>
      {children}
    </div>
  );
}
