export async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: options.body instanceof FormData
      ? options.headers
      : { 'Content-Type': 'application/json', ...options.headers }
  });
  if (response.status === 204) return null;
  let body;
  try { body = await response.json(); } catch {
    const error = new Error('No se pudo leer la respuesta del servidor');
    error.status = response.status;
    error.respuestaIncierta = response.ok || response.status >= 500;
    throw error;
  }
  if (!response.ok) {
    const error = new Error(body.error || 'No fue posible completar la solicitud');
    error.body = body;
    error.status = response.status;
    throw error;
  }
  return body;
}
