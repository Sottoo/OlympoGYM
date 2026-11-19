# Lector de huellas (HID DigitalPersona)

Scripts del navegador para hablar con el lector U.are.U 4500 a través del
servicio de HID ("HID Authentication Device Client", antes DigitalPersona Lite
Client), que debe estar instalado en la computadora. Licencia MIT (ver LICENSE).

| Archivo                   | Origen (npm)                                           |
|---------------------------|--------------------------------------------------------|
| `websdk.client.ui.min.js` | `@digitalpersona/websdk@1.1.0` · dist/                 |
| `core.umd.min.js`         | `@digitalpersona/core@0.2.6` · dist/es5.bundles/index.umd.min.js |
| `devices.umd.min.js`      | `@digitalpersona/devices@0.2.6` · dist/es5.bundles/index.umd.min.js |

Se cargan en ese orden (ver `src/presentation/components/huellas/lectorDeHuellas.ts`).
La comparación de huellas no ocurre aquí: la hace el servidor con el motor
FingerJet (`dpfj.dll`) que instala el mismo cliente de HID.
