import { Component, lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Snowflake, Sun } from 'lucide-react';
import { useSectionProgress } from './Look.jsx';
import { useStore } from '../store.js';
import { termo, fmtC } from '../termo.js';

const Termo3D = lazy(() => import('../three/Termo3D.jsx'));

class Safe extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

// Como uma leitura vira alerta, contado em quatro passos presos à rolagem.
const STEPS = [
  ['O ESP32 lê a sala.', 'Um DHT22 mede temperatura e umidade e o nó de borda manda a leitura pelo rádio LoRa.'],
  ['A API guarda a leitura.', 'O nó central envia por HTTPS com chave de API; o FastAPI grava no PostgreSQL, sem duplicar lote reenviado.'],
  ['O painel compara com a faixa.', 'Cada sala tem sua faixa ideal. A pior aparece primeiro, com o quanto falta para o limite.'],
  ['Três leituras fora: alerta.', 'O alerta só some quando alguém reconhece e registra o que fez. O aviso também sai por e-mail.'],
];

function Readout() {
  const s = useStore(termo);
  return (
    <div className={`readout ${s.alert ? 'hot' : ''}`}>
      <p className="readout-num" aria-live="polite">{fmtC(s.temp)}<span> °C</span></p>
      <p className="readout-state">Sala 204, {s.alert ? 'em alerta' : s.outCount ? `fora da faixa (${s.outCount} de 3)` : 'na faixa'}</p>
      <label className="readout-range">
        <Snowflake size={15} aria-hidden />
        <input type="range" min="16" max="38" step="0.5" value={s.ambient} onChange={(e) => termo.set({ ambient: +e.target.value })} aria-label="Temperatura do ambiente da sala 204" />
        <Sun size={15} aria-hidden />
      </label>
      <p className="readout-hint">Simulação ao vivo: arraste para esquentar a sala.</p>
    </div>
  );
}

export function Moment() {
  const ref = useRef(), progress = useRef(0);
  const [step, setStep] = useState(0);
  const [near, setNear] = useState(false), [visible, setVisible] = useState(false), [warm, setWarm] = useState(false);
  // depois de montar, desenha alguns segundos fora da tela: compila shaders e envia texturas antes de a pessoa chegar
  useEffect(() => { if (!near) return; setWarm(true); const t = setTimeout(() => setWarm(false), 6000); return () => clearTimeout(t); }, [near]);
  useSectionProgress(ref, (p) => {
    progress.current = p;
    const n = Math.min(STEPS.length - 1, Math.floor(p * STEPS.length * 0.999));
    setStep((x) => (x === n ? x : n));
  });
  useEffect(() => {
    // prepara a cena 3D com o navegador ocioso (logo depois da abertura), não no meio da rolagem
    const idle = window.requestIdleCallback || ((f) => setTimeout(f, 1500));
    const t = setTimeout(() => idle(() => setNear(true), { timeout: 4000 }), 1800);
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setNear(true); }, { rootMargin: '1600px 0px' });
    const io2 = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(ref.current); io2.observe(ref.current);
    return () => { clearTimeout(t); io.disconnect(); io2.disconnect(); };
  }, []);
  return (
    <section className="moment" ref={ref} aria-label="Como o TermoLOG transforma uma leitura em alerta">
      <div className="moment-pin">
        <div className="moment-copy">
          <h2 className="moment-title">Da parede ao alerta</h2>
          <ol className="moment-steps">
            {STEPS.map(([h, p], i) => (
              <li key={h} className={i === step ? 'on' : i < step ? 'done' : ''} aria-current={i === step ? 'step' : undefined}>
                <h3>{h}</h3><p>{p}</p>
              </li>
            ))}
          </ol>
          <Readout />
        </div>
        <div className="moment-stage" aria-hidden>
          {near && <Safe><Suspense fallback={null}><Termo3D progress={progress} active={visible || warm} /></Suspense></Safe>}
        </div>
      </div>
    </section>
  );
}
