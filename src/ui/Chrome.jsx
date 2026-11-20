import { useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, FileDown } from 'lucide-react';
import { contact } from '../data/projects.js';
import { ui, useStore } from '../store.js';

export function Nav() {
  return (
    <header className="nav">
      <a className="wordmark" href="#inicio" aria-label="Victor Kauan, início">Victor Kauan</a>
      <nav aria-label="Seções">
        <a href="#projetos">Projetos</a>
        <a href="#videos">Vídeos</a>
        <a href="#sobre">Sobre</a>
        <a href="#contato">Contato</a>
      </nav>
      <a className="nav-cv" href={contact.cv} download>Currículo <FileDown size={15} aria-hidden /></a>
    </header>
  );
}

function useEsc(on, close) {
  useEffect(() => {
    if (!on) return;
    const f = (e) => e.key === 'Escape' && close();
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [on, close]);
}

export function Lightbox() {
  const lb = useStore(ui, (s) => s.lightbox);
  const close = () => ui.set({ lightbox: null });
  useEsc(!!lb, close);
  useEffect(() => {
    if (!lb?.list) return;
    const f = (e) => {
      if (e.key === 'ArrowRight') ui.set({ lightbox: { ...lb, i: (lb.i + 1) % lb.list.length } });
      if (e.key === 'ArrowLeft') ui.set({ lightbox: { ...lb, i: (lb.i - 1 + lb.list.length) % lb.list.length } });
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [lb]);
  if (!lb) return null;
  const list = lb.list || [lb];
  const i = lb.i || 0, cur = list[i];
  const step = (d) => (e) => { e.stopPropagation(); ui.set({ lightbox: { list, i: (i + d + list.length) % list.length } }); };
  return (
    <div className="sheet lightbox" role="dialog" aria-modal="true" aria-label={cur.alt} onClick={close}>
      <button className="close" onClick={close} aria-label="Fechar"><X /></button>
      <figure onClick={(e) => e.stopPropagation()}>
        <img src={cur.src} alt={cur.alt} />
        <figcaption>{cur.alt}{list.length > 1 && <span> · {i + 1} de {list.length}</span>}</figcaption>
      </figure>
      {list.length > 1 && <>
        <button className="nav prev" onClick={step(-1)} aria-label="Tela anterior"><ChevronLeft /></button>
        <button className="nav next" onClick={step(1)} aria-label="Próxima tela"><ChevronRight /></button>
      </>}
    </div>
  );
}
