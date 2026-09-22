import { useEffect, useRef, useState } from 'react';

export function LazyImage({ src, alt, priority = false }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(priority);

  useEffect(() => {
    if (visible || !src) return undefined;
    if (!globalThis.IntersectionObserver) {
      setVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '180px' });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [src, visible]);

  return (
    <div ref={ref} className="foto-plato">
      {visible && src ? <img src={src} alt={alt} width="640" height="420" decoding="async" /> : null}
    </div>
  );
}
