import { Cocina } from './Cocina.jsx';
import { Admin } from './Admin.jsx';
import { CartaPublica } from './CartaPublica.jsx';

export function App() {
  if (location.pathname === '/cocina' || location.pathname === '/cocina/') return <Cocina />;
  return location.pathname.startsWith('/admin') ? <Admin /> : <CartaPublica />;
}
