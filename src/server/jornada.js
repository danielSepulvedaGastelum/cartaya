// El proceso debe usar la zona horaria local del establecimiento (TZ).
export function jornadaLocal(ahora = new Date()) {
  const inicio = new Date(ahora);
  inicio.setHours(0, 0, 0, 0);
  const fin = new Date(inicio);
  fin.setDate(fin.getDate() + 1);
  return { inicio, fin };
}

export function fechaSql(fecha) {
  return fecha.toISOString().slice(0, 19).replace('T', ' ');
}
