export async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: options.body instanceof FormData
      ? options.headers
      : { 'Content-Type': 'application/json', ...options.headers }
  });
  if (response.status === 204) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'No fue posible completar la solicitud');
  return body;
}
