import { useEffect, useState } from 'react';
import { api } from './api.js';
import { LazyImage } from './LazyImage.jsx';

const precio = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

export function CartaPublica() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const mesa = new URLSearchParams(location.search).get('mesa') || '';

  useEffect(() => {
    api(`/api/carta?mesa=${encodeURIComponent(mesa)}`).then(setData).catch((err) => setError(err.message));
  }, [mesa]);

  if (error) return <main><p role="alert">{error}</p></main>;
  if (!data) return <main><p aria-live="polite">Cargando la carta…</p></main>;

  let imageIndex = 0;
  return (
    <>
      <header className="portada">
        <p className="ceja">Cafetería de barrio</p>
        <h1>La Estación</h1>
        <p>Café honesto, cocina sencilla y un lugar para hacer una pausa.</p>
        {data.mesa ? <span className="mesa">Mesa identificada</span> : null}
      </header>
      <main id="contenido" className="carta">
        {data.categorias.length === 0 ? <p>Aún no hay platos publicados.</p> : null}
        {data.categorias.map((categoria) => (
          <section key={categoria.id} aria-labelledby={`categoria-${categoria.id}`}>
            <h2 id={`categoria-${categoria.id}`}>{categoria.nombre}</h2>
            <div className="platos">
              {categoria.platos.map((plato) => {
                const priority = imageIndex++ < 1;
                return (
                  <article className="plato" key={plato.id}>
                    {plato.fotoUrl ? <LazyImage src={plato.fotoUrl} alt={`Fotografía de ${plato.nombre}`} priority={priority} /> : null}
                    <div className="plato-contenido">
                      <div className="plato-titulo">
                        <h3>{plato.nombre}</h3>
                        <strong>{precio.format(plato.precioCentavos / 100)}</strong>
                      </div>
                      <p>{plato.descripcion}</p>
                      {plato.alergenos.length > 0 ? (
                        <p className="alergenos"><strong>Alérgenos:</strong> {plato.alergenos.join(', ')}</p>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </main>
    </>
  );
}
