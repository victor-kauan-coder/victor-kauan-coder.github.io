import { useEffect, useRef, useState } from 'react';
import { useProgress } from '@react-three/drei';
import { X, List, Trophy, Gamepad2, Film, ArrowRight, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { stations, archive } from '../data/projects.js';
import { roadPoints, stops } from '../three/world.js';
import { ExternalLink, Lock } from 'lucide-react';
import { ui, useStore, achievements, ACH, unlock } from '../store.js';

const total = Object.keys(ACH).length;

export function Hud() {
  const mode = useStore(ui, (s) => s.mode);
  const active = useStore(ui, (s) => s.active);
  const got = useStore(achievements, (s) => s.got.length);
  const current = stations[active - 1];
  return (
    <header className="hud">
      <a className="brand" href="#inicio" onClick={() => ui.set({ mode: 'film' })}>Victor Kauan</a>
      <nav className="hud-where" aria-live="polite">
        {mode === 'game' ? 'Dirigindo: WASD ou setas, ou clique num marcador para ir até ele' : current ? <span style={{ '--c': current.color }} className="where-dot">{current.name}</span> : null}
      </nav>
      <div className="hud-actions">
        <span className="ach" title="Conquistas desbloqueadas"><Trophy size={16} /> {got}/{total}</span>
        <button className="chip-btn" onClick={() => { const game = ui.get().mode !== 'game'; ui.set({ mode: game ? 'game' : 'film', near: null, target: null }); if (game) unlock('piloto'); }}>
          {mode === 'game' ? <><Film size={16} /> Voltar ao filme</> : <><Gamepad2 size={16} /> Modo jogo</>}
        </button>
        <button className="chip-btn strong" onClick={() => ui.set({ quick: true })}><List size={16} /> Lista rápida</button>
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

export function QuickList() {
  const open = useStore(ui, (s) => s.quick);
  const close = () => ui.set({ quick: false });
  const ref = useRef();
  useEsc(open, close);
  useEffect(() => { if (open) ref.current?.focus(); }, [open]);
  if (!open) return null;
  const go = (id) => { ui.set({ quick: false, mode: 'film' }); setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 30); };
  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="Lista de projetos" onClick={close}>
      <div className="sheet-body" onClick={(e) => e.stopPropagation()} tabIndex={-1} ref={ref}>
        <button className="close" onClick={close} aria-label="Fechar"><X /></button>
        <h2>Todos os projetos</h2>
        <ul className="quick">
          {stations.map((s) => (
            <li key={s.id}>
              <button onClick={() => go(s.id)} style={{ '--c': s.color }}>
                {s.shots[0] ? <img src={s.shots[0].src} alt="" loading="lazy" /> : <span className="noimg" />}
                <span><strong>{s.name}</strong><em>{s.tagline}</em><small>{s.stack.slice(0, 4).join(' · ')}</small></span>
                <ArrowRight size={18} />
              </button>
            </li>
          ))}
          {archive.map((a) => (
            <li key={a.name}>
              <button onClick={() => go('arquivo')}>
                {a.shot ? <img src={a.shot} alt="" loading="lazy" /> : <span className="noimg" />}
                <span><strong>{a.name}</strong><em>{a.text}</em></span>
                <ArrowRight size={18} />
              </button>
            </li>
          ))}
        </ul>
        <a className="btn primary" href="#contato" onClick={close}>Falar comigo</a>
      </div>
    </div>
  );
}

export function Toast() {
  const toast = useStore(achievements, (s) => s.toast);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => achievements.set({ toast: null }), 3600);
    return () => clearTimeout(t);
  }, [toast]);
  if (!toast) return null;
  return (
    <div className="toast" role="status" key={toast.t}>
      <Trophy size={20} />
      <span><strong>Conquista</strong>{toast.text}</span>
    </div>
  );
}

export function GameOverlay() {
  const mode = useStore(ui, (s) => s.mode);
  const near = useStore(ui, (s) => s.near);
  if (mode !== 'game') return null;
  const s = near != null ? stations[near] : null;
  const stick = (dx, dy) => ui.set({ stick: { x: dx, y: dy } });
  return (
    <>
      {s && (
        <aside className="game-card" style={{ '--c': s.color }}>
          {s.shots[0] && <img src={s.shots[0].thumb} alt="" />}
          <div>
            <p className="team">{s.place}</p>
            <h2>{s.name}</h2>
            <p>{s.tagline}</p>
            <dl className="metrics small">{s.metrics.slice(0, 2).map(([v, l]) => <div key={l}><dt>{v}</dt><dd>{l}</dd></div>)}</dl>
            <button className="btn primary" onClick={() => ui.set({ dossier: s.id })}>Abrir estudo de caso</button>
          </div>
        </aside>
      )}
      <Speedo />
      <MiniMap />
      <p className="keys"><kbd>W A S D</kbd> dirigir · <kbd>Shift</kbd> turbo · <kbd>Espaço</kbd> freio · <kbd>R</kbd> volta à estrada</p>
      <div className="pad">
        <button onPointerDown={() => stick(0, -1)} onPointerUp={() => stick(0, 0)} onPointerLeave={() => stick(0, 0)} aria-label="Acelerar"><ChevronUp /></button>
        <div>
          <button onPointerDown={() => stick(-1, -0.6)} onPointerUp={() => stick(0, 0)} onPointerLeave={() => stick(0, 0)} aria-label="Virar à esquerda"><ChevronLeft /></button>
          <button onPointerDown={() => stick(1, -0.6)} onPointerUp={() => stick(0, 0)} onPointerLeave={() => stick(0, 0)} aria-label="Virar à direita"><ChevronRight /></button>
        </div>
      </div>
    </>
  );
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

// Tela de carregamento do mundo 3D: some sozinha quando o essencial chegou (ou depois de 12 s, para nunca prender ninguém).
export function Loading() {
  const { progress } = useProgress();
  const [gone, setGone] = useState(false);
  useEffect(() => { const t = setTimeout(() => setGone(true), 30000); return () => clearTimeout(t); }, []);
  useEffect(() => { if (progress >= 100) { const t = setTimeout(() => setGone(true), 700); return () => clearTimeout(t); } }, [progress]);
  return (
    <div className={`loading ${gone ? 'done' : ''}`} aria-hidden={gone}>
      <div>
        <strong>Montando o mundo</strong>
        <span className="bar"><i style={{ width: `${Math.max(6, progress)}%` }} /></span>
        <small>{Math.round(progress)}% · modelos 3D, texturas e luz</small>
      </div>
    </div>
  );
}

// Velocímetro: atualiza o DOM direto a cada quadro (sem re-render do React).
function Speedo() {
  const num = useRef(), arc = useRef();
  useEffect(() => {
    let raf;
    const tick = () => {
      const c = ui.get().car;
      if (c && num.current) {
        const kmh = Math.round(Math.abs(c.speed) * 3.6);
        num.current.textContent = kmh;
        arc.current.style.strokeDashoffset = 220 - Math.min(1, kmh / 150) * 220;
        arc.current.style.stroke = c.boost ? '#ffd23f' : 'var(--hot)';
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="speedo" aria-hidden>
      <svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="35" className="bg" /><circle ref={arc} cx="50" cy="50" r="35" className="fg" /></svg>
      <strong ref={num}>0</strong><span>km/h</span>
    </div>
  );
}

// Minimapa: estrada, lugares e o carro, desenhados num canvas a ~20 quadros por segundo.
function MiniMap() {
  const ref = useRef();
  useEffect(() => {
    const cv = ref.current, g = cv.getContext('2d');
    const W = cv.width, k = W / 900, P = (x, z) => [W / 2 + x * k, W / 2 + z * k];
    let raf, last = 0;
    const draw = (t) => {
      raf = requestAnimationFrame(draw);
      if (t - last < 50) return; last = t;
      g.clearRect(0, 0, W, W);
      g.fillStyle = 'rgba(126,217,87,0.25)'; g.beginPath(); g.arc(W / 2, W / 2, W / 2 - 2, 0, 7); g.fill();
      g.strokeStyle = '#e8ecf6'; g.lineWidth = 3; g.beginPath();
      roadPoints.forEach((p, i) => { const [x, y] = P(p.x, p.z); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
      stops.forEach((s, i) => { const [x, y] = P(s.c.x, s.c.z); g.fillStyle = stations[i].color; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); });
      const c = ui.get().car;
      if (c) { const [x, y] = P(c.x, c.z); g.save(); g.translate(x, y); g.rotate(-c.heading + Math.PI); g.fillStyle = '#ffd23f'; g.beginPath(); g.moveTo(0, -8); g.lineTo(6, 6); g.lineTo(-6, 6); g.closePath(); g.fill(); g.restore(); }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="minimap" width="180" height="180" aria-label="Minimapa" />;
}
