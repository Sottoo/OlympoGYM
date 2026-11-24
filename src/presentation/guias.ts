/**
 * Guías de cada pantalla: qué es, quién la usa, cómo se usa paso a paso y qué
 * queda registrado. Están escritas como procedimientos (al estilo de un
 * sistema de gestión de servicios, tipo ISO/IEC 20000): cortas, claras y con
 * la misma forma en todas las pantallas, para que cualquier persona nueva
 * aprenda sola y para que el gimnasio pueda mostrar cómo trabaja.
 *
 * Se muestran con el botón «Cómo funciona» junto al título de cada pantalla.
 */

export interface Guia {
  /** Clave del procedimiento, para citarlo (p. ej. en una capacitación). */
  clave: string;
  titulo: string;
  /** Qué es, en una frase. */
  que: string;
  /** Quién la usa. */
  quien: string;
  /** Cómo se usa, en orden. */
  pasos: string[];
  /** Qué evidencia deja en el sistema. */
  registro: string;
  /** Reglas que conviene no olvidar. */
  reglas?: string[];
}

export const GUIAS = {
  hoy: {
    clave: "P-01",
    titulo: "Mostrador del día",
    que: "La pantalla de inicio: registrar quién entra, ver el corte del día y lo que está pendiente.",
    quien: "Recepción y administración, durante todo el turno.",
    pasos: [
      "Arriba está el corte del día: lo cobrado en el gimnasio y en la tienda, y el efectivo que debe haber en la caja.",
      "Cuando llega un socio, pídele que ponga el dedo en el lector o escribe su nombre, celular o número.",
      "Si su membresía está vigente, la pantalla dice «Puede pasar» y la entrada se anota sola.",
      "Si está vencida o no tiene plan, cóbrale ahí mismo (renovación o visita) antes de dejarlo pasar.",
      "Revisa «Por vencer»: son los socios a los que les toca pagar hoy o en los próximos dos días; recuérdales renovar.",
      "Al cerrar, cuenta el efectivo y compáralo con «Efectivo en caja». «Ver detalle» abre el corte completo.",
    ],
    registro: "Cada entrada queda con fecha, hora y quién la registró. Cada cobro entra al corte del día.",
    reglas: ["Nadie pasa sin membresía vigente o visita pagada.", "La mensualidad se paga el mismo día de cada mes: quien pagó el 7 vence el 7 del mes siguiente y ese día paga para entrar. El aviso sale desde el día 5."],
  },
  entradas: {
    clave: "P-02",
    titulo: "Libro de entradas",
    que: "La lista de quién entró cada día y a qué hora.",
    quien: "Recepción (su día) y administración (cualquier día).",
    pasos: [
      "Elige el día con las flechas o con «Ir a otro día».",
      "Arriba ves cuántas entradas hubo, cuántos socios distintos, la hora pico y la primera entrada.",
      "Abajo está la lista completa; toca un nombre para abrir su ficha.",
    ],
    registro: "Las entradas se registran desde el Mostrador; aquí solo se consultan.",
  },
  socios: {
    clave: "P-03",
    titulo: "Socios",
    que: "La lista de todas las personas inscritas, con el estado de su membresía.",
    quien: "Recepción y administración.",
    pasos: [
      "Busca por nombre, celular o número de socio.",
      "Usa los filtros: al corriente, por vencer (le toca pagar en uno o dos días), vencidos, sin plan, en espera (bajas).",
      "Toca un socio para ver su ficha: pagos, membresías, entradas y huella.",
      "Para alguien nuevo, usa «Inscribir socio».",
    ],
    registro: "Las altas, cambios, bajas y borrados quedan en la bitácora con la persona que los hizo.",
    reglas: [
      "Dar de baja deja al socio «en espera»: no se borra nada y se puede reactivar cuando regrese.",
      "Eliminar es para siempre y lo hace solo la administración: borra sus datos personales, pero sus pagos se quedan en los cortes.",
      "Si alguien quedó registrado dos veces, su ficha lo avisa arriba; la administración los une con «Unir registros».",
    ],
  },
  socio: {
    clave: "P-04",
    titulo: "Ficha del socio",
    que: "Todo sobre una persona: su membresía, sus pagos, sus visitas del mes y su huella.",
    quien: "Recepción y administración.",
    pasos: [
      "Para renovar o asignar plan, elige el plan en «Renovar membresía», el método de pago y cobra.",
      "Si el cobro fue otro día y se olvidó anotarlo, marca «Se cobró otro día» y pon la fecha real.",
      "Para registrar su huella, sigue los pasos del panel «Huella» con el socio presente.",
      "Lo poco frecuente está en «Más», junto a «Editar datos»: corregir la membresía, devolución, dar de baja o eliminar.",
      "Un cobro equivocado se corrige o se cancela solo el mismo día. Desde el día siguiente, si hay que regresar dinero, es una «Devolución»: sale de la caja de ese día, con su motivo, y la membresía termina. Los cortes de días pasados nunca cambian.",
      "No se puede dar de baja a alguien con membresía vigente: sus días siguen corriendo aunque no venga. Se da de baja cuando vence.",
    ],
    registro: "Cada pago queda con fecha, monto, método y quién cobró; cada corrección, en la bitácora.",
    reglas: [
      "Si renueva antes de vencer, la nueva membresía empieza al día siguiente de la actual: no pierde días.",
      "Un cobro con fecha pasada entra en el corte de ese día, no en el de hoy.",
    ],
  },
  inscribir: {
    clave: "P-05",
    titulo: "Inscripción de socio",
    que: "El alta de una persona nueva, con su plan y su primer pago en un solo paso.",
    quien: "Recepción y administración.",
    pasos: [
      "Escribe nombre, apellidos y celular (10 dígitos). La foto y la fecha de nacimiento son opcionales.",
      "Elige el plan: una membresía, o la visita de un día si solo viene hoy.",
      "Elige el método de pago. Si el cobro fue otro día, marca «Se cobró otro día» y pon la fecha.",
      "Guarda: el socio sale con su membresía activa y su pago en el corte.",
    ],
    registro: "El socio recibe un número consecutivo; el alta y el pago quedan en la bitácora.",
    reglas: [
      "Nadie queda inscrito sin plan.",
      "La visita de un día solo se cobra el mismo día.",
      "Si el programa avisa que la persona ya está inscrita, no la registres otra vez: abre su ficha y cóbrale ahí.",
    ],
  },
  tienda: {
    clave: "P-06",
    titulo: "Tienda y corte de caja",
    que: "El punto de venta del mostrador y el corte de caja del día.",
    quien: "Recepción y administración.",
    pasos: [
      "Toca cada producto o escanea su código; se suma a la venta actual.",
      "Elige efectivo o transferencia. Si es efectivo, escribe lo recibido para calcular el cambio.",
      "Pulsa «Cobrar»: la venta se registra y la existencia baja sola.",
      "Al cerrar el turno, revisa el corte: tienda, membresías, salidas por mantenimiento y efectivo neto.",
    ],
    registro: "Cada venta queda con hora, productos, método y quién vendió. El corte se arma solo.",
    reglas: ["No se puede vender más de lo que hay en existencia.", "El efectivo neto ya descuenta lo que salió de la caja para pagar mantenimiento."],
  },
  inventario: {
    clave: "P-07",
    titulo: "Inventario",
    que: "Los productos de la tienda: precio, existencia, mínimo y foto.",
    quien: "Administración (recepción solo consulta).",
    pasos: [
      "«Llegó mercancía»: registra lo que trajo el proveedor.",
      "«Lista de compra»: qué conviene pedir según lo vendido.",
      "«Conteo rápido»: compara lo que hay en el anaquel con lo registrado y ajusta.",
      "Toca un producto para ver sus movimientos, editarlo, desactivarlo o eliminarlo.",
    ],
    registro: "Toda entrada, venta, merma y ajuste es un movimiento con fecha y quién lo hizo.",
    reglas: [
      "Desactivar quita el producto de la Tienda pero lo conserva; se puede reactivar.",
      "Eliminar es para siempre: el producto desaparece, pero sus ventas pasadas se quedan en los cortes.",
    ],
  },
  producto: {
    clave: "P-08",
    titulo: "Ficha del producto",
    que: "Un producto con su existencia, su margen y todos sus movimientos.",
    quien: "Administración.",
    pasos: [
      "Registra entradas, mermas o ajustes por conteo en el panel de la derecha.",
      "Usa «Editar» para cambiar nombre, precio, costo, mínimo o foto.",
      "«Desactivar» lo saca de la venta; «Eliminar» lo borra para siempre.",
    ],
    registro: "La existencia nunca se escribe a mano: cambia solo con movimientos, y cada uno queda anotado.",
  },
  planes: {
    clave: "P-09",
    titulo: "Planes",
    que: "El catálogo de lo que se cobra: membresías y la visita de un día.",
    quien: "Administración.",
    pasos: [
      "En «Nuevo plan», elige el tipo (membresía o visita de un día), ponle nombre y precio y, si es membresía, su duración. Los meses van por día del mes: quien paga el 7 vuelve a pagar el 7 (si un mes no trae su día, ese mes paga el último).",
      "Usa «Editar» para cambiar nombre, precio, duración o descripción.",
      "En «Más», «Desactivar» deja de venderlo sin borrar nada; «Eliminar para siempre» lo quita de la lista.",
    ],
    registro: "Cada alta, cambio y borrado de plan queda en la bitácora.",
    reglas: [
      "Editar o eliminar un plan no cambia lo ya cobrado: cada socio conserva su membresía, su vencimiento y lo que pagó.",
      "Debe existir un plan de visita para cobrar a quien llega sin membresía.",
      "Solo una visita con precio puede estar activa (es la que cobra el mostrador). Un plan de 1 día a $0 es un pase de cortesía para conocer el gimnasio: se da al inscribir y una sola vez por persona.",
    ],
  },
  mantenimiento: {
    clave: "P-10",
    titulo: "Máquinas y mantenimiento",
    que: "Las máquinas del gimnasio: cuáles funcionan, sus fallas, su mantenimiento y lo que han costado.",
    quien: "Administración registra; recepción consulta y reporta fallas.",
    pasos: [
      "Para agregar máquinas, usa «Agregar máquina» (o «Agregar varias a la vez»).",
      "Si una máquina falla, usa «Reportar una falla» y di si quedó fuera de servicio.",
      "Cuando el técnico la atiende, usa «Registrar mantenimiento» con el costo y lo que se le pagó.",
      "Revisa «Preventivos por hacer» para programar los servicios a tiempo.",
      "En «Por pagar» ves lo que se le debe a cada técnico; registra los abonos ahí.",
    ],
    registro: "Cada falla, servicio y pago queda con fecha, monto y quién lo registró.",
    reglas: [
      "Dar de baja quita la máquina de la lista de trabajo pero la conserva; se puede reactivar.",
      "Eliminar es para siempre: la máquina desaparece, pero lo gastado en ella se queda en el historial.",
    ],
  },
  metricas: {
    clave: "P-11",
    titulo: "Métricas",
    que: "Cómo va el gimnasio: asistencia, horas pico, ingresos, socios y tienda.",
    quien: "Administración.",
    pasos: [
      "Revisa las cifras de arriba: comparan con el periodo anterior.",
      "Usa las horas pico para decidir horarios de personal y de limpieza.",
      "Revisa «Ingresos y mantenimiento» para saber cuánto queda cada mes.",
    ],
    registro: "Solo consulta; los datos salen de lo registrado en las demás pantallas.",
  },
  personal: {
    clave: "P-12",
    titulo: "Personal y accesos",
    que: "Las cuentas de quienes usan el programa y lo que puede hacer cada una.",
    quien: "Administración.",
    pasos: [
      "Crea una cuenta por persona en «Nueva cuenta»: nombre, usuario, perfil y contraseña.",
      "Recepción atiende el mostrador; Administración puede todo.",
      "En «Más» de cada cuenta: cambiar su perfil, ponerle contraseña nueva o desactivarla. Cada cambio se confirma en su ventana.",
      "En «Lo que puede hacer Recepción» puedes encenderle permisos extra (por ejemplo, dar de baja socios). «Volver al estándar» los apaga todos.",
    ],
    registro: "Cada acción queda firmada con el nombre de quien la hizo; los cambios de perfil y de permisos también quedan en la bitácora.",
    reglas: [
      "Una cuenta por persona: nunca compartir contraseñas.",
      "El estándar de Recepción no tiene permisos extra. Administrar cuentas, permisos y respaldos es siempre solo de Administración.",
    ],
  },
  bitacora: {
    clave: "P-13",
    titulo: "Bitácora",
    que: "El registro de todo lo que se hizo en el programa: qué, quién y cuándo.",
    quien: "Administración.",
    pasos: ["Filtra por área (socios, pagos, tienda…) y por periodo.", "Cada línea dice qué pasó, quién lo hizo y, en los cambios, qué datos cambiaron."],
    registro: "La bitácora se escribe sola y no se puede editar ni borrar: es la evidencia de cómo se trabajó.",
  },
  respaldos: {
    clave: "P-14",
    titulo: "Respaldos",
    que: "Copias de toda la información para no perderla si la computadora falla.",
    quien: "Administración.",
    pasos: [
      "El programa se respalda solo cada día; también puedes crear uno con «Crear respaldo ahora».",
      "Configura una carpeta fuera de la computadora (Google Drive o una USB) para guardar una copia extra.",
      "Para recuperar información, usa «Restaurar» con el respaldo que corresponda.",
    ],
    registro: "Cada respaldo queda con fecha, tipo y tamaño. Antes de restaurar se guarda una copia de lo actual.",
  },
  nomina: {
    clave: "P-15",
    titulo: "Nómina",
    que: "Lo que se les paga a los empleados del gimnasio cada semana (de lunes a viernes), para llevar el control.",
    quien: "Administración (o quien tenga el permiso de nómina).",
    pasos: [
      "En «Empleados», da de alta a cada uno con su nombre, puesto y sueldo semanal (se propone al pagarle).",
      "Desde el viernes aparece el aviso «Nómina» en Hoy y aquí, con a quién falta pagarle esa semana.",
      "En «Pagar nómina», elige al empleado y la semana, revisa la cantidad y si fue en efectivo o transferencia.",
      "Si alguien ya no trabaja ahí, desactívalo: sus pagos se conservan y deja de aparecer en el aviso.",
    ],
    registro: "Cada pago queda con la semana, la cantidad, cómo se pagó y el día; también en la bitácora.",
    reglas: [
      "Un pago por empleado y semana: no se le puede pagar dos veces la misma semana.",
      "No se pagan semanas que todavía no empiezan.",
      "Lo pagado en efectivo sale del «Efectivo en caja» del día en que se paga y aparece en las salidas del corte.",
      "Un pago equivocado se anula solo el mismo día; los cortes de días pasados no cambian.",
    ],
  },
} satisfies Record<string, Guia>;

export type ClaveGuia = keyof typeof GUIAS;
