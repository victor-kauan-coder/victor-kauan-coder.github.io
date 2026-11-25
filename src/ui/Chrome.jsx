import { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight, FileDown, Sun, Moon } from 'lucide-react';
import { contact } from '../data/projects.js';
import { ui, useStore } from '../store.js';
import { t, lang, trocarIdioma, temaAtual, aplicarTema } from '../i18n.js';

// Botões de idioma e tema. O rótulo do idioma é o destino, escrito no próprio idioma dele.
function Prefs() {
  const [tema, setTema] = useState(temaAtual);
  const claro = tema === 'claro';
  const alternar = () => { const novo = claro ? 'escuro' : 'claro'; aplicarTema(novo); setTema(novo); };
  const rotulo = t(claro ? 'Mudar para o tema escuro' : 'Mudar para o tema claro');
  return (
    <>
      <button type="button" className="pref" onClick={trocarIdioma} lang={lang === 'pt' ? 'en' : 'pt-BR'} aria-label={lang === 'pt' ? 'Switch to English' : 'Mudar para português'} title={lang === 'pt' ? 'Switch to English' : 'Mudar para português'}>
        {lang === 'pt' ? 'EN' : 'PT'}
      </button>
      <button type="button" className="pref" onClick={alternar} aria-label={rotulo} title={rotulo}>
        {claro ? <Moon size={17} aria-hidden /> : <Sun size={17} aria-hidden />}
      </button>
    </>
  );
}

export function Nav() {
  return (
    <header className="nav">
      <a className="wordmark" href="#inicio" aria-label={t('Victor Kauan, início')}>Victor Kauan</a>
      <nav aria-label={t('Seções')}>
        <a href="#projetos">{t('Projetos')}</a>
        <a href="#videos">{t('Vídeos')}</a>
        <a href="#sobre">{t('Sobre')}</a>
        <a href="#contato">{t('Contato')}</a>
      </nav>
      <div className="nav-end">
        <Prefs />
        <a className="nav-cv" href={contact.cv} download aria-label={t('Currículo')}><span>{t('Currículo')}</span> <FileDown size={15} aria-hidden /></a>
      </div>
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
      <button className="close" onClick={close} aria-label={t('Fechar')}><X /></button>
      <figure onClick={(e) => e.stopPropagation()}>
        <img src={cur.src} alt={cur.alt} />
        <figcaption>{cur.alt}{list.length > 1 && <span> · {i + 1} {t('de')} {list.length}</span>}</figcaption>
      </figure>
      {list.length > 1 && <>
        <button className="nav prev" onClick={step(-1)} aria-label={t('Tela anterior')}><ChevronLeft /></button>
        <button className="nav next" onClick={step(1)} aria-label={t('Próxima tela')}><ChevronRight /></button>
      </>}
    </div>
  );
}
