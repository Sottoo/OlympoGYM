-- Planes iniciales de ejemplo. Ajusta nombres y precios a los del gimnasio.
insert into public.planes (nombre, descripcion, precio, duracion, unidad) values
  ('Visita semanal', 'Acceso libre durante 7 días',          180,  1, 'semanas'),
  ('Mensual',        'Acceso ilimitado a pesas y cardio',     550,  1, 'meses'),
  ('Trimestral',     'Tres meses con precio preferente',     1450,  3, 'meses'),
  ('Anual',          'Doce meses, el mejor precio por mes',  5200, 12, 'meses');

-- Para dar acceso al panel a una persona:
-- 1. Créala en Authentication > Users > Add user (con correo y contraseña).
-- 2. Copia su "User UID" y ejecuta:
-- insert into public.personal (usuario_id, nombre, rol)
-- values ('PEGA-AQUI-EL-UID', 'Nombre del dueño', 'administrador');
