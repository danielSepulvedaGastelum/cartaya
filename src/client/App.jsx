import { Admin } from './Admin.jsx';
import { CartaPublica } from './CartaPublica.jsx';

export function App() {
  return location.pathname.startsWith('/admin') ? <Admin /> : <CartaPublica />;
}
