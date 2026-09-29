# Olimpo GYM

Programa de escritorio para Windows que administra el gimnasio: socios (altas,
edición y bajas), planes, cobro de membresías, **ventas de mostrador**,
**control de inventario** y **avisos por WhatsApp** cuando una membresía está
por vencer.

Hecho con **Next.js 15 + TypeScript + Tailwind CSS** dentro de **Electron**
(se instala como cualquier programa). Los datos se guardan en línea en
**Supabase** (plan gratuito), así que la computadora necesita internet, y cada
día se deja un respaldo en la propia computadora.

---

## 1. Probarlo en tu computadora (5 minutos)

Necesitas tener instalado [Node.js](https://nodejs.org) versión 20 o superior.

```bash
cd "C:\Users\desar\Documents\Visual Studio\ProyectoGimnasio"
npm install
npm run dev
```

Abre <http://localhost:3000>. La app arranca en **modo demo**: no pide contraseña
y trae socios de ejemplo guardados en memoria (se borran al detener el servidor).
Así puedes enseñarle el prototipo al cliente sin configurar nada: trae socios,
algunos dados de baja, productos con stock bajo y ventas de los últimos días.

Para verlo ya como programa de escritorio (con `npm run dev` corriendo en otra
terminal):

```bash
npm run escritorio:dev
```

---

## 2. Cómo está organizado (arquitectura limpia)

El código está separado en capas. La regla de oro: **las capas de adentro no
conocen a las de afuera**. El dominio no sabe que existe Supabase ni Next.js.

```
src/
├── domain/            1. DOMINIO: las reglas del negocio del gimnasio
│   ├── entities/         Socio, Plan, Suscripcion, Pago, Producto,
│   │                     MovimientoInventario, Venta (+ sus validaciones)
│   ├── repositories/     Contratos: "necesito guardar socios" (sin decir cómo)
│   ├── services/         Contrato del Reloj (fecha de hoy)
│   └── shared/           Fechas y errores de negocio
│
├── application/       2. APLICACIÓN: lo que el sistema sabe hacer
│   └── use-cases/        RegistrarSocio, DarDeBajaSocio, AsignarPlan,
│                         RegistrarVenta, RegistrarMovimiento, ObtenerResumen,
│                         ObtenerAvisosPendientes, etc.
│
├── infrastructure/    3. INFRAESTRUCTURA: las herramientas concretas
│   ├── repositories/
│   │   ├── supabase/     Guardan en Supabase (producción)
│   │   └── memoria/      Guardan en memoria (modo demo)
│   ├── respaldo/         Copia diaria de toda la base en un archivo JSON
│   ├── supabase/         Clientes y sesión de Supabase
│   ├── auth/             Inicio de sesión y permisos del personal
│   └── contenedor.ts     ⭐ Aquí se "conecta" todo: decide qué implementación usar
│
├── presentation/      4. PRESENTACIÓN: componentes y ayudas de la interfaz
├── shared/            Formato de fechas, dinero y teléfonos
└── app/               Pantallas y rutas de Next.js
    ├── login/
    ├── (panel)/panel/    Resumen con el tablero de vencimientos
    ├── (panel)/avisos/   Recordatorios por WhatsApp pendientes de mandar
    ├── (panel)/socios/   Lista con filtros, alta, edición, baja y detalle (renovar y cobrar)
    ├── (panel)/ventas/   Punto de venta de mostrador y corte del día
    ├── (panel)/inventario/ Productos, entradas, mermas y ajustes por conteo
    ├── (panel)/planes/   Crear y desactivar planes
    ├── api/exportar/     Descarga de socios e inventario para Excel (CSV)
    └── api/respaldo/     Descarga del respaldo completo
electron/main.cjs      La ventana del programa: arranca el servidor adentro
```

**¿Por qué así?** Porque si mañana quieres cambiar Supabase por otra base de
datos (por ejemplo, una local), solo escribes una nueva clase en
`infrastructure/` y la conectas en `contenedor.ts`. Las reglas del negocio no se
tocan. El modo demo es la prueba: usa otra "base de datos" y los casos de uso ni
se enteran.

### Reglas de negocio incluidas

- La membresía es válida **hasta el último día inclusive** (mensual del 1 de sept. vence el 30).
- Los planes mensuales respetan fin de mes (31 de enero + 1 mes = 28 de febrero).
- **Si el socio renueva antes de vencer, no pierde días**: el nuevo periodo empieza al terminar el actual.
- "Por vencer" = le quedan 7 días o menos.
- Recordatorios por WhatsApp **7, 3 y 1 día antes**. Aparecen en la pantalla
  **Avisos** (con un contador en el menú) y se mandan a mano: el botón abre
  WhatsApp con el mensaje escrito. Nunca salen duplicados, no aparecen si el
  socio ya renovó, y si un día no se abrió el sistema el aviso sigue pendiente.
- Todo socio necesita celular (es el único canal de avisos). No se pide correo.
- Fecha de nacimiento y foto son opcionales. La edad se calcula sola y la ficha
  avisa cuando el socio cumple años. La foto se toma con la cámara o se sube un
  archivo, y la app la recorta y reduce (~50 KB) antes de guardarla en una
  carpeta privada de Supabase Storage.
- **Dar de baja no borra nada**: el socio conserva su historial, deja de contar
  como activo y ya no recibe avisos. Se guarda el motivo y se puede reactivar.
  A un socio dado de baja no se le puede cobrar un plan hasta reactivarlo.
- **El stock solo cambia con movimientos** (entrada, venta, merma o ajuste por
  conteo), así cada pieza tiene su historial. Nunca puede quedar negativo.
- Una venta con varios productos se guarda completa o no se guarda: si uno no
  alcanza, no se descuenta nada. El precio lo pone el sistema, no el navegador.

---

## 3. Conectarlo a Supabase (datos reales)

1. Crea una cuenta y un proyecto en <https://supabase.com> (plan gratuito).
2. Ve a **SQL Editor**, pega todo el contenido de
   `supabase/migrations/0001_esquema_inicial.sql` y ejecútalo.
   Luego ejecuta `supabase/migrations/0002_bajas_e_inventario.sql` (bajas,
   inventario y ventas), `supabase/migrations/0003_avisos_whatsapp.sql`
   (avisos por WhatsApp), `supabase/migrations/0004_nacimiento_y_foto.sql`
   (fecha de nacimiento y fotos) y por último `supabase/seed.sql` para crear los
   planes iniciales.
3. En **Authentication > Sign In / Providers**, desactiva *Allow new users to sign up*.
   Así nadie puede crearse una cuenta por su cuenta.
4. En **Authentication > Users > Add user**, crea la cuenta del dueño (correo y contraseña).
   Copia su *User UID* y ejecuta en el SQL Editor:
   ```sql
   insert into public.personal (usuario_id, nombre, rol)
   values ('PEGA-AQUI-EL-UID', 'Nombre del dueño', 'administrador');
   ```
5. Copia `.env.example` como `.env.local` y llena los datos de
   **Project Settings > API** (`URL` y `anon key`). La `service_role key` **no
   se usa**: no la pongas, porque quedaría dentro del instalador.
6. Reinicia `npm run dev`. Ya te pedirá iniciar sesión.

> **Plan gratuito de Supabase:** el proyecto se pausa si pasa una semana sin
> usarse (por ejemplo, en vacaciones). Se reactiva con un clic en el panel de
> Supabase y no se pierde nada. Tampoco incluye respaldos; por eso la app
> guarda los suyos (ver sección 4).

### Seguridad (léelo)

- Todas las tablas tienen **RLS activado**: solo el personal registrado en la
  tabla `personal` puede ver o modificar datos. Si creas tablas nuevas, **activa RLS**.
- La `anon key` sí viaja dentro del programa y eso es normal: por sí sola no
  da acceso a nada, porque RLS exige iniciar sesión con una cuenta de `personal`.
- El archivo `.env.local` ya está en `.gitignore`.

---

## 4. Respaldos

Cada día, la primera vez que se abre el programa, se guarda una copia completa
de la base en `Documentos\Olimpo GYM\Respaldos\respaldo-AAAA-MM-DD.json`. Se
conservan los últimos 60 días. Las fotos de los socios se copian a la
subcarpeta `fotos` (solo las nuevas cada día). En el Resumen también hay un botón **Descargar
respaldo** para sacar una copia al momento (por ejemplo, a una USB).

Si el programa no abre o algo falla, la bitácora del servidor interno está en
`%APPDATA%\Olimpo GYM\servidor.log`.

---

## 5. Crear el instalador para Windows

Con `.env.local` ya configurado (los datos de Supabase quedan dentro del programa):

```bash
npm run instalador
```

El instalador queda en `dist-escritorio\Olimpo GYM Setup 0.1.0.exe`. Cópialo a
la computadora del gimnasio y ejecútalo: crea el acceso directo en el
escritorio.

Como el instalador no está firmado con un certificado, Windows mostrará
"Windows protegió su PC". Se instala igual con **Más información → Ejecutar de
todos modos**. Para quitar ese aviso hay que comprar un certificado de firma
de código.

Para una versión nueva, sube `version` en `package.json`, vuelve a generar el
instalador y ejecútalo encima del anterior: los datos no se tocan porque están
en Supabase.

---

## 6. Comandos

| Comando             | Qué hace                                   |
| ------------------- | ------------------------------------------ |
| `npm run dev`       | Servidor de desarrollo en localhost:3000   |
| `npm run build`     | Compila para producción                    |
| `npm run start`     | Corre la versión compilada                 |
| `npm run typecheck` | Revisa errores de TypeScript               |
| `npm run escritorio:dev` | Abre la ventana de escritorio sobre `npm run dev` |
| `npm run escritorio` | Abre la ventana con la versión compilada (`npm run build:escritorio`) |
| `npm run instalador` | Genera el instalador `.exe` en `dist-escritorio/` |

---

## 7. Siguientes pasos sugeridos

Lo que queda fuera de esta versión y se puede cotizar aparte:

- Importar los socios desde el Excel que usa el gimnasio hoy.
- Cancelar una venta capturada por error (hoy se corrige con un ajuste de stock).
- Avisos 100% automáticos por WhatsApp (API de WhatsApp Business, con costo por mensaje).
- Restaurar un respaldo desde el propio programa (hoy se hace a mano).
- Funcionar sin internet (base local que se sincroniza con Supabase).
- Control de entrada con código QR.
- Portal para que los socios consulten su membresía.
- Reportes de ingresos por mes.
- Pruebas automáticas de los casos de uso (el `Reloj` inyectable facilita probar
  cualquier fecha).
