import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Lock, Play } from 'lucide-react';
import { stations, LINKS, quizzvCores, videos } from '../data/projects.js';
import { ui } from '../store.js';
import { Showcase, splitShots, ColorPhones } from './Devices.jsx';

// fração inicial da seção em que só a marca aparece, grande, antes do anúncio se montar
const INTRO = 0.16;
const narrow = () => matchMedia('(max-width: 860px)').matches;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const L = (f) => `${import.meta.env.BASE_URL}logos/${f}`;

// Progresso da rolagem dentro de uma seção alta (0 ao entrar presa, 1 ao soltar).
// Só calcula enquanto a seção está na tela; escreve --p direto no elemento, sem re-render.
export function useSectionProgress(ref, cb) {
  const cbRef = useRef(cb);
  cbRef.current = cb;
  useEffect(() => {
    const el = ref.current; if (!el) return;
    let raf = 0, on = false;
    const tick = () => {
      const r = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight)));
      el.style.setProperty('--p', p.toFixed(4));
      cbRef.current?.(p);
      if (on) raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([e]) => { on = e.isIntersecting; cancelAnimationFrame(raf); if (on) raf = requestAnimationFrame(tick); });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [ref]);
}

// A marca de cada produto: as logos reais dos repositórios; quem não tem logo ganha um logotipo tipográfico.
function Logo({ id, name }) {
  switch (id) {
    case 'termolog': return <img src={L('termolog-claro.svg')} alt="TermoLOG" style={{ height: 64 }} />;
    case 'vcall': return <img src={L('vcall.svg')} alt="Vcall" style={{ height: 58 }} />;
    case 'duckv': return <img src={L('duckv.svg')} alt="duckV" style={{ height: 52 }} />;
    case 'songv': return <span className="logo-set" role="img" aria-label="SongV"><img src={L('songv-simbolo.png')} alt="" style={{ height: 52 }} /><span className="logo-word">Song<b style={{ color: '#ff7a1a' }}>V</b></span></span>;
    case 'farmacia': return (
      <span className="logo-set" role="img" aria-label="PharmaVision e OrçaLink">
        <img src={L('pharmavision-icone.png')} alt="" style={{ height: 46 }} /><span className="logo-word">PharmaVision</span>
        <span className="logo-plus" aria-hidden>+</span>
        <img src={L('orcalink.svg')} alt="" style={{ height: 48 }} /><span className="logo-word">OrçaLink</span>
      </span>
    );
    case 'voto': return <span className="logo-set" role="img" aria-label="Voto Aberto"><img src={L('voto.svg')} alt="" style={{ height: 52 }} /><span className="logo-word">Voto Aberto</span></span>;
    case 'esmartigado': return <img src={L('esmartigado.png')} alt="Esmartigado" style={{ height: 130, margin: "-18px 0 -14px" }} />;
    case 'quizzv': return <span className="logo-set" role="img" aria-label="QuizzV"><img src={L('quizzv.svg')} alt="" style={{ height: 56 }} /><span className="logo-word">Quizz<b style={{ color: '#F86B23' }}>V</b></span></span>;
    default: return <span className="logo-word big">{name}</span>;
  }
}

// Cada projeto como um anúncio do produto: a marca entra, a frase vira manchete,
// as telas reais trocam com a rolagem e cada tela traz sua chamada.
export function Look({ s, i }) {
  const ref = useRef();
  // passos da rolagem: até quatro trocas de tela, pelo que o projeto tiver (computador ou celular)
  const { desk, phone } = splitShots(s.shots);
  const main = desk.length ? desk : phone;
  const qz = s.id === 'quizzv';
  const steps = qz ? quizzvCores.length : Math.min(4, Math.max(desk.length, phone.length));
  const shots = Array.from({ length: steps }, (_, j) => main[j % main.length]);
  const [k, setK] = useState(0);
  const [seen, setSeen] = useState(false);
  const [pick, setPick] = useState(null); // cor escolhida à mão no QuizzV (a rolagem volta a mandar no próximo passo)
  useEffect(() => setPick(null), [k]);
  const ci = pick ?? k % quizzvCores.length, cor = quizzvCores[ci];
  const kRef = useRef(0);
  const variant = i % 2 ? 'left' : 'right';

  // No celular (sem seção presa) a chegada é por visibilidade; no desktop, pela rolagem (depois da abertura da marca).
  useEffect(() => {
    if (!narrow()) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold: 0.12 });
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  useSectionProgress(ref, (p) => {
    if (narrow()) return;
    if (p > INTRO * 0.75) setSeen(true);
    const q = Math.max(0, (p - INTRO) / (1 - INTRO));
    const n = Math.min(shots.length - 1, Math.floor(q * shots.length * 0.999));
    if (n !== kRef.current) { kRef.current = n; setK(n); }
  });
  // No celular a seção não fica presa: as telas trocam sozinhas, devagar.
  useEffect(() => {
    if (!narrow() || reduced() || shots.length < 2) return;
    const t = setInterval(() => setK((x) => (x + 1) % shots.length), 3800);
    return () => clearInterval(t);
  }, [shots.length]);

  const links = LINKS.filter(([a, b]) => a === s.id || b === s.id).map(([a, b, why]) => ({ o: stations.find((x) => x.id === (a === s.id ? b : a)), why }));
  const code = s.links[0];

  return (
    <section id={s.id} ref={ref} className={`look look-${variant} ${seen ? 'is-in' : ''}`} style={{ '--n': Math.max(2, steps), '--pc': qz ? cor.hex : s.color }} aria-labelledby={`t-${s.id}`}>
      <div className="look-pin">
        <p className="look-ghost" aria-hidden>{s.name}</p>
        <div className="look-mark" aria-hidden><Logo id={s.id} name={s.name} /></div>

        <div className="look-text">
          <div className="look-logo"><Logo id={s.id} name={s.name} /></div>
          <h2 id={`t-${s.id}`} className={`look-head ${s.tagline.length > 44 ? 'long' : ''}`}>
            <span className="sr-only">{s.name}: </span>
            {s.tagline.split(' ').map((w, wi) => (
              <span className="word" key={wi} aria-hidden><span className="ch" style={{ '--i': wi }}>{w}</span></span>
            ))}
          </h2>
          <p className="look-body">{s.solution}</p>
          <ul className="look-feats">
            {s.features.slice(0, 3).map((f, j) => <li key={f} style={{ '--j': j }}>{f}</li>)}
          </ul>
          <p className="look-meta">{s.team}<span>{s.stack.slice(0, 5).join('  /  ')}</span></p>
          {links.length > 0 && (
            <p className="look-links">
              Divide tecnologia com{' '}
              {links.map(({ o, why }, j) => (
                <span key={o.id}><a href={`#${o.id}`} title={why} style={{ '--lc': o.color }}>{o.name}</a>{j < links.length - 2 ? ', ' : j === links.length - 2 ? ' e ' : '.'}</span>
              ))}
            </p>
          )}
          <div className="look-actions">
            <button className="cta" onClick={() => ui.set({ dossier: s.id })}>Estudo de caso</button>
            {videos.some((v) => v.id === s.id) && <button className="txt-link" onClick={() => ui.set({ video: s.id })}><Play size={15} aria-hidden /> Assistir ao vídeo</button>}
            {code && <a className="txt-link" href={code.href} target="_blank" rel="noreferrer">{code.label}<ArrowUpRight size={16} aria-hidden /></a>}
            {s.private && <span className="look-private"><Lock size={14} aria-hidden /> {s.private}</span>}
          </div>
        </div>

        {qz ? (
          <figure className="look-frame">
            <button className="look-stage" onClick={() => ui.set({ lightbox: { list: s.shots, i: 0 } })} aria-label="Ampliar as telas do QuizzV">
              <ColorPhones cores={quizzvCores} c={ci} extra={s.shots.filter((x) => /opcoes|resultado|gerador|vcall/.test(x.src))} k={k} />
            </button>
            <figcaption className="look-callout qz-callout">
              <span className="look-cap">Cor de destaque: <b>{cor.name}</b>. O app deixa escolher entre seis.</span>
              <span className="qz-swatches" role="radiogroup" aria-label="Cor de destaque do QuizzV">
                {quizzvCores.map((c2, j) => (
                  <button key={c2.id} type="button" role="radio" aria-checked={j === ci} aria-label={c2.name} title={c2.name} style={{ '--sw': c2.hex }} onClick={() => setPick(j)} />
                ))}
              </span>
            </figcaption>
          </figure>
        ) : (
        <figure className="look-frame">
            <button className="look-stage" onClick={() => ui.set({ lightbox: { list: s.shots, i: Math.max(0, s.shots.indexOf(shots[k])) } })} aria-label={`Ampliar: ${shots[k]?.alt}`}>
              <Showcase shots={s.shots} k={k} render={false} />
            </button>
            {shots[k] && (
              <figcaption className="look-callout" key={k}>
                <span className="look-ticks" aria-hidden>{shots.map((sh, j) => <i key={sh.src} className={j === k ? 'on' : j < k ? 'done' : ''} />)}</span>
                <span className="look-cap">{shots[k].alt}</span>
              </figcaption>
            )}
          </figure>
        )}
      </div>
    </section>
  );
}
