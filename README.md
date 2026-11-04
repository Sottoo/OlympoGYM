# Olimpo GYM

Programa de escritorio para Windows que administra el gimnasio: **mostrador de
recepción** (registrar entradas por nombre, celular o número de socio),
**asistencias**, socios (altas, edición y bajas), planes, cobro de membresías,
**ventas de mostrador**, **control de inventario**, **métricas**, **respaldos** y una **bitácora** de cambios que nadie puede editar.

**Todo funciona dentro de la computadora.** La base de datos es un archivo
SQLite que viene con el propio programa: no hay que instalar ningún servidor,
no necesita internet y no tiene costos mensuales.

Diseño "Porcelana": claro y sereno, una sola familia tipográfica (Instrument
Sans) y el vino como acento de marca. Las reglas están comentadas al inicio de
`src/app/globals.css`.

Hecho con **Next.js 15 + TypeScript + Tailwind CSS** dentro de **Electron**.

---

## 1. Probarlo en tu computadora

Necesitas [Node.js](https://nodejs.org) 22.13 o superior (trae SQLite integrado).

```bash
cd "C:\Users\desar\Documents\Visual Studio\ProyectoGimnasio"
npm install
npm run dev
```

Abre <http://localhost:3000>. La primera vez pide **crear la cuenta del
administrador** y entrega un **código de recuperación**. Al desarrollar, la base
y los respaldos quedan en la carpeta `.datos/` del proyecto (está en `.gitignore`).

Para verlo como programa de escritorio (con `npm run dev` corriendo en otra
terminal): `npm run escritorio:dev`.

---

## 2. Cómo está organizado (arquitectura limpia)

El código está separado en capas. La regla de oro: **las capas de adentro no
conocen a las de afuera**. El dominio no sabe que existe SQLite ni Next.js.

```
src/
├── domain/            1. DOMINIO: las reglas del negocio del gimnasio
│   ├── entities/         Socio, Plan, Suscripcion, Pago, Producto, Venta,
│   │                     MovimientoInventario, Asistencia, RegistroBitacora
│   ├── repositories/     Contratos: "necesito guardar socios" (sin decir cómo)
│   ├── services/         Reloj (fecha y hora) y AlmacenFotos
│   └── shared/           Fechas y errores de negocio
│
├── application/       2. APLICACIÓN: lo que el sistema sabe hacer
│   └── use-cases/        Mostrador (registrar entradas), socios, membresías,
│                         ventas, inventario, métricas, bitácora…
│
├── infrastructure/    3. INFRAESTRUCTURA: las herramientas concretas
│   ├── sqlite/           La base local: estructura, conexión y repositorios
│   ├── auth/             Cuentas, contraseñas cifradas y sesión
│   ├── respaldo/         Respaldos .zip (crear, copiar, restaurar)
│   └── contenedor.ts     ⭐ Aquí se "conecta" todo
│
├── presentation/      4. PRESENTACIÓN: componentes y ayudas de la interfaz
├── shared/            Formato de fechas, dinero y teléfonos
└── app/               Pantallas y rutas de Next.js
    ├── login/            Primer arranque, iniciar sesión y recuperar contraseña
    ├── bienvenida/       Muestra una sola vez el código de recuperación
    ├── (panel)/panel/    Hoy: mostrador de recepción, entradas y pendientes
    ├── (panel)/…         Asistencias, socios, ventas, inventario,
    │                     planes, métricas, bitácora y respaldos
    └── api/              Fotos, descargas de respaldos y exportación a Excel
electron/              La ventana del programa (main.cjs) y su puente con Windows (preload.cjs)
```

**¿Por qué así?** Porque cambiar dónde se guardan los datos solo toca
`infrastructure/` y `contenedor.ts`. Así se pasó de Supabase (en la nube) a
SQLite (local) sin tocar las reglas del negocio ni las pantallas.

### Reglas de negocio incluidas

- La membresía es válida **hasta el último día inclusive** (mensual del 1 de sept. vence el 30).
- Los planes mensuales respetan fin de mes (31 de enero + 1 mes = 28 de febrero).
- **Si el socio renueva antes de vencer, no pierde días**: el nuevo periodo empieza al terminar el actual.
- "Por vencer" = le quedan 7 días o menos.
- Se cobra **en efectivo o por transferencia** (no hay pago con tarjeta).
- Solo se registran **entradas**, no salidas: el programa no indica quién sigue
  entrenando en este momento.
- **Mostrador:** se busca al socio por nombre, celular o número. Si puede pasar,
  se registra su entrada. Sin membresía vigente solo pasa **como excepción con
  motivo**. Una entrada se puede deshacer durante 10 minutos, y dos registros
  del mismo socio en menos de 2 horas se bloquean. `F2` lleva al mostrador.
- **Bitácora:** la escriben triggers de la base (quién, qué, cuándo, antes y
  después). La base rechaza cualquier intento de editarla o borrarla. Un cambio
  de producto que solo mueve el stock no se repite (ya queda en su movimiento).
- Todo socio necesita celular. Fecha de nacimiento y foto son opcionales; la
  foto se reduce a ~50 KB y se guarda en la carpeta de datos.
- **Dar de baja no borra nada**: el socio conserva su historial y se puede reactivar.
- **El stock solo cambia con movimientos** y nunca queda negativo. Una venta se
  guarda completa o no se guarda.

---

## 3. Dónde vive la información

| Qué | Dónde (programa instalado) |
| --- | --- |
| Base de datos y fotos | `%APPDATA%\Olimpo GYM\datos` (`olimpo.db` y `fotos\`) |
| Respaldos automáticos | `Documentos\Olimpo GYM\Respaldos` |
| Registro del servidor interno (para diagnosticar fallas) | `%APPDATA%\Olimpo GYM\servidor.log` |

### Cuentas y contraseñas

- La primera vez se crea la cuenta del administrador. Las contraseñas se
  guardan cifradas (scrypt) y la sesión es una cookie firmada.
- El **código de recuperación** se muestra una sola vez. Con él se restablece
  la contraseña en *¿Olvidaste tu contraseña?*; después se entrega uno nuevo.

---

## 4. Respaldos

En la sección **Respaldos** del programa:

- **Cada día**, al abrir el programa, se guarda un respaldo `.zip` (base + fotos).
  Se conservan los últimos 30.
- **Carpeta extra:** se elige una carpeta de **Google Drive para escritorio**,
  OneDrive o una USB, y cada respaldo se copia también ahí. Es lo que protege la
  información si la computadora se descompone. Mientras no se configure, la
  pantalla Hoy lo recuerda en *Pendientes del turno*.
- **Crear respaldo ahora**, **Descargar** y **Enviar por WhatsApp** (abre la
  carpeta con el archivo seleccionado y WhatsApp; se arrastra al chat, porque
  WhatsApp no permite adjuntar archivos de forma automática).
- **Restaurar:** reemplaza toda la información por la de un respaldo (por
  ejemplo, en una computadora nueva). Antes guarda una copia de lo actual.

---

## 5. Crear el instalador para Windows

```bash
npm run instalador
```

El instalador queda en `dist-escritorio\Olimpo GYM Setup 0.1.0.exe`. Como no está
firmado con un certificado, Windows mostrará "Windows protegió su PC"; se
instala con **Más información → Ejecutar de todos modos**.

Para una versión nueva, sube `version` en `package.json`, genera el instalador
y ejecútalo encima del anterior: los datos no se tocan (viven en `%APPDATA%`), y
si la estructura de la base cambió, el programa la actualiza sola al abrir.

---

## 6. Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo en localhost:3000 |
| `npm run typecheck` | Revisa errores de TypeScript |
| `npm run escritorio:dev` | Abre la ventana de escritorio sobre `npm run dev` |
| `npm run build:escritorio` | Compila la versión de escritorio |
| `npm run escritorio` | Abre la ventana con la versión compilada |
| `npm run instalador` | Genera el instalador `.exe` en `dist-escritorio/` |

---

## 7. Siguientes pasos sugeridos

Lo que queda fuera de esta versión y se puede cotizar aparte:

- Lector de código de barras con credenciales impresas, y lector de huella para asistencia.
- Cancelar una venta capturada por error (hoy se corrige con un ajuste de stock).
- Recordatorios de vencimiento por WhatsApp (manuales o automáticos con la API de WhatsApp Business, con costo por mensaje).
- Registro de salida para saber quién está entrenando en este momento.
- Cobro con tarjeta.
- Varias cuentas de personal con permisos distintos.
- Pruebas automáticas de los casos de uso (el `Reloj` inyectable facilita probar cualquier fecha).
