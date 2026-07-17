import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

type Listener = (msg: string) => void;
const listeners = new Set<Listener>();

export function toast(message: string): void {
  for (const l of listeners) l(message);
}

interface ActiveToast {
  id: number;
  message: string;
}

export function Toaster() {
  const [items, setItems] = useState<ActiveToast[]>([]);
  const counter = useRef(0);
  const { pathname } = useLocation();

  useEffect(() => {
    const listener: Listener = (message) => {
      const id = ++counter.current;
      setItems([{ id, message }]);
      window.setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== id));
      }, 2600);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    setItems([]);
  }, [pathname]);

  if (!items.length) return null;
  return (
    <div className="toast-wrap">
      {items.map((t) => (
        <div key={t.id} className="toast">
          {t.message}
        </div>
      ))}
    </div>
  );
}
