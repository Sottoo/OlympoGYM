/**
 * Puente seguro entre la interfaz y Windows. La página solo puede pedir estas
 * cuatro cosas; no tiene acceso directo a Node ni al sistema de archivos.
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("olimpo", {
  elegirCarpeta: () => ipcRenderer.invoke("olimpo:elegir-carpeta"),
  mostrarArchivo: (ruta) => ipcRenderer.invoke("olimpo:mostrar-archivo", ruta),
  abrirCarpeta: (ruta) => ipcRenderer.invoke("olimpo:abrir-carpeta", ruta),
  abrirWhatsApp: () => ipcRenderer.invoke("olimpo:abrir-whatsapp"),
});
