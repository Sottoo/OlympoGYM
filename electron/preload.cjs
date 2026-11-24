/**
 * Puente seguro entre la interfaz y Windows. La página solo puede pedir estas
 * cosas; no tiene acceso directo a Node ni al sistema de archivos.
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("olimpo", {
  elegirCarpeta: () => ipcRenderer.invoke("olimpo:elegir-carpeta"),
  mostrarArchivo: (ruta) => ipcRenderer.invoke("olimpo:mostrar-archivo", ruta),
  abrirCarpeta: (ruta) => ipcRenderer.invoke("olimpo:abrir-carpeta", ruta),
  abrirWhatsApp: () => ipcRenderer.invoke("olimpo:abrir-whatsapp"),
  instalarLector: () => ipcRenderer.invoke("olimpo:instalar-lector"),
  reiniciarAgenteLector: (opciones) => ipcRenderer.invoke("olimpo:reiniciar-agente-lector", opciones),
  actualizacionLista: () => ipcRenderer.invoke("olimpo:actualizacion-lista"),
  alHaberActualizacion: (manejador) => {
    const escucha = (_evento, info) => manejador(info);
    ipcRenderer.on("olimpo:actualizacion", escucha);
    return () => ipcRenderer.removeListener("olimpo:actualizacion", escucha);
  },
  actualizarAhora: () => ipcRenderer.invoke("olimpo:actualizar-ahora"),
  buscarActualizacion: () => ipcRenderer.invoke("olimpo:buscar-actualizacion"),
  alReiniciarseAgenteLector: (manejador) => {
    const escucha = (_evento, fase) => manejador(fase === "inicio" ? "inicio" : "listo");
    ipcRenderer.on("olimpo:agente-lector", escucha);
    return () => ipcRenderer.removeListener("olimpo:agente-lector", escucha);
  },
  alPedirActualizar: (manejador) => {
    const escucha = () => manejador();
    ipcRenderer.on("olimpo:mostrar-actualizacion", escucha);
    return () => ipcRenderer.removeListener("olimpo:mostrar-actualizacion", escucha);
  },
});
