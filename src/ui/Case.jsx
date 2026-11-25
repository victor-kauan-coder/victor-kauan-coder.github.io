import { useEffect, useRef, useState } from 'react';
import { X, ExternalLink, Lock, Play, Pause, ChevronLeft, ChevronRight } from 'lucide-react';
import { stations } from '../data/projects.js';
import { ui, useStore } from '../store.js';
import { t } from '../i18n.js';
import { WIDGET } from './Widgets.jsx';

// Demonstração: as telas reais do projeto passando como um vídeo, com legenda e barra de progresso.
export function Tour({ shots, color }) {
  const [i, setI] = useState(0);
  const [play, setPlay] = useState(true);
  const DUR = 4200;
  useEffect(() => {
    if (!play || shots.length < 2) return;
    const t = setTimeout(() => setI((x) => (x + 1) % shots.length), DUR);
    return () => clearTimeout(t);
  }, [i, play, shots.length]);
  if (!shots.length) return null;
  const cur = shots[i];
  return (
    <div className="tour" style={{ '--c': color, '--dur': `${DUR}ms` }}>
      <div className={`tour-stage ${cur.tall ? 'tall' : ''}`}>
        {shots.map((s, k) => (
          <img key={s.src} src={k === i || k === (i + 1) % shots.length ? s.src : undefined} alt={k === i ? s.alt : ''} className={k === i ? 'on' : ''} loading="lazy" decoding="async" />
        ))}
      </div>
      <div className="tour-bar">
        <button onClick={() => setPlay((p) => !p)} aria-label={t(play ? 'Pausar' : 'Reproduzir')}>{play ? <Pause size={16} /> : <Play size={16} />}</button>
        <button onClick={() => setI((i - 1 + shots.length) % shots.length)} aria-label={t('Tela anterior')}><ChevronLeft size={16} /></button>
        <button onClick={() => setI((i + 1) % shots.length)} aria-label={t('Próxima tela')}><ChevronRight size={16} /></button>
        <p className="tour-cap"><strong>{i + 1}/{shots.length}</strong> {cur.alt}</p>
      </div>
      <div className="tour-steps">{shots.map((s, k) => <span key={s.src} className={k < i ? 'done' : k === i ? (play ? 'run' : 'done') : ''} />)}</div>
    </div>
  );
}

// Arquitetura: cada peça acende na ordem em que o dado passa por ela.
export function FlowArch({ nodes, color }) {
  return (
    <ol className="flow" style={{ '--c': color, '--n': nodes.length }}>
      {nodes.map(([a, b], k) => <li key={a} style={{ '--k': k }}><strong>{a}</strong><span>{b}</span></li>)}
    </ol>
  );
}

const TABS = [['geral', t('Visão geral')], ['demo', t('Demonstração')], ['arq', t('Arquitetura')], ['telas', t('Telas')], ['papel', t('Meu papel')]];

export function CaseStudy() {
  const id = useStore(ui, (s) => s.dossier);
  const [tab, setTab] = useState('geral');
  const ref = useRef();
  const close = () => ui.set({ dossier: null });
  useEffect(() => { if (id) { setTab('geral'); ref.current?.focus(); } }, [id]);
  useEffect(() => {
    if (!id) return;
    const f = (e) => e.key === 'Escape' && close();
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [id]);
  const s = stations.find((x) => x.id === id);
  if (!s) return null;
  const Live = WIDGET[s.id];
  return (
    <div className="sheet case-sheet" role="dialog" aria-modal="true" aria-label={`${t('Estudo de caso')}: ${s.name}`} onClick={close}>
      <article className="case" style={{ '--c': s.color }} onClick={(e) => e.stopPropagation()} tabIndex={-1} ref={ref}>
        <button className="close" onClick={close} aria-label={t('Fechar')}><X /></button>
        <header className="case-head">
          <div>
            <p className="team">{s.team}</p>
            <h2>{s.name}</h2>
            <p className="tagline">{s.tagline}</p>
          </div>
          <dl className="metrics">
            {s.metrics.map(([v, l]) => <div key={l}><dt>{v}</dt><dd>{l}</dd></div>)}
          </dl>
        </header>
        <nav className="tabs" role="tablist">
          {TABS.map(([k, label]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{label}</button>)}
        </nav>

        {tab === 'geral' && (
          <section className="case-grid">
            <div>
              <h3>{t('O problema')}</h3><p>{s.problem}</p>
              <h3>{t('A solução')}</h3><p>{s.solution}</p>
              <h3>{t('O que faz')}</h3>
              <ul className="features">{s.features.map((f) => <li key={f}>{f}</li>)}</ul>
            </div>
            <Tour shots={s.shots} color={s.color} />
          </section>
        )}
        {tab === 'demo' && (
          <section className="case-demo">
            {Live && <div className="live"><h3>{t('Ao vivo')}</h3><Live /></div>}
            <Tour shots={s.shots} color={s.color} />
          </section>
        )}
        {tab === 'arq' && (
          <section>
            <p className="body">{s.text}</p>
            <FlowArch nodes={s.arch} color={s.color} />
            <div className="chips">{s.stack.map((t) => <span key={t}>{t}</span>)}</div>
          </section>
        )}
        {tab === 'telas' && (
          <section>
            {s.note && <p className="body">{s.note}</p>}
            <div className="gallery">
              {s.shots.map((sh, k) => (
                <figure key={sh.src} className={sh.tall ? 'tall' : ''}>
                  <button onClick={() => ui.set({ lightbox: { list: s.shots, i: k } })} aria-label={`${t('Ampliar')}: ${sh.alt}`}><img src={sh.thumb} alt={sh.alt} loading="lazy" /></button>
                  <figcaption>{sh.alt}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}
        {tab === 'papel' && (
          <section className="case-grid">
            <div><h3>{t('O que eu fiz')}</h3><p>{s.role}</p></div>
            <div><h3>{t('Desafios resolvidos')}</h3><ul className="features">{s.challenges.map((f) => <li key={f}>{f}</li>)}</ul></div>
          </section>
        )}
        <footer className="links">
          {s.links.map((l) => <a key={l.href} href={l.href} target="_blank" rel="noreferrer">{l.label} <ExternalLink size={15} /></a>)}
          {s.private && <span className="private"><Lock size={15} /> {s.private}</span>}
        </footer>
      </article>
    </div>
  );
}
