import { Lock, Mic, MessageCircle, Check } from 'lucide-react';
import { useStore, sling } from '../store.js';
import { termo, fmtC } from '../termo.js';

// Assinatura visual de cada projeto: um pedaço animado do próprio produto, não um ícone genérico.
// Tudo em HTML/CSS (sem imagem pesada), com dados ao vivo quando o projeto tem simulação no site.

function Termolog() {
  const s = useStore(termo);
  const lo = 14, hi = 42, W = 220, H = 54;
  const pts = s.history.map((v, i) => `${(i / (s.history.length - 1)) * W},${H - ((v - lo) / (hi - lo)) * H}`).join(' ');
  const limY = H - ((s.max - lo) / (hi - lo)) * H;
  return (
    <div className={`sig sig-termo ${s.alert ? 'hot' : ''}`}>
      <div className="sig-termo-read">
        <span className="sig-termo-num">{fmtC(s.temp)}</span><span className="sig-termo-unit">°C</span>
        <span className="sig-termo-room">Sala 204 · {s.alert ? 'fora da faixa' : 'na faixa'}</span>
      </div>
      <svg className="sig-termo-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
        <line x1="0" x2={W} y1={limY} y2={limY} className="lim" />
        <polyline points={pts} className="line" />
      </svg>
    </div>
  );
}

function Vcall() {
  return (
    <div className="sig sig-vcall" aria-hidden>
      {['VK', 'AL'].map((who, i) => (
        <div key={who} className={`tile t${i}`}>
          <span className="avatar">{who}</span>
          <span className="mic"><Mic size={12} /></span>
        </div>
      ))}
      <div className="link"><Lock size={12} /> direto, criptografado</div>
    </div>
  );
}

function Songv() {
  return (
    <div className="sig sig-songv" aria-hidden>
      <div className="vinyl"><span /></div>
      <div className="lyrics">
        <p className="l l0">A letra aparece como legenda</p>
        <p className="l l1">sincronizada linha a linha</p>
        <p className="t">tradução em 16 idiomas logo abaixo</p>
      </div>
    </div>
  );
}

function Duckv() {
  return (
    <div className="sig sig-duckv" aria-hidden>
      <div className="notif">
        <strong>Claude Code · conta 2</strong>
        <span>Quer rodar <code>npm test</code> em portfolio/</span>
        <div className="btns"><b>Permitir</b><i>Recusar</i></div>
      </div>
      <div className="notif n2"><strong>Codex</strong><span>Terminou a tarefa em 4 min</span></div>
    </div>
  );
}

function Farmacia() {
  return (
    <div className="sig sig-farma" aria-hidden>
      <div className="bars">{[62, 88, 45, 74, 96].map((h, i) => <span key={i} style={{ '--h': `${h}%`, '--i': i }} />)}</div>
      <div className="bubble"><MessageCircle size={13} /> Orçamento enviado <Check size={13} /></div>
      <small>vendas por filial, dados de demonstração</small>
    </div>
  );
}

function Voto() {
  return (
    <div className="sig sig-voto" aria-hidden>
      <div className="screen"><span className="d d1">1</span><span className="d d2">3</span><small>SEU VOTO PARA</small></div>
      <div className="keys">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <span key={n} className={n === 1 || n === 3 ? `k press p${n}` : 'k'}>{n}</span>)}
        <span className="k branco">BRANCO</span><span className="k corrige">CORRIGE</span><span className="k confirma">CONFIRMA</span>
      </div>
    </div>
  );
}

function Esmartigado() {
  return (
    <div className="sig sig-esm" aria-hidden>
      <div className="trough"><span className="feed" /></div>
      <div className="level"><span className="normal">NORMAL</span><span className="baixo">BAIXO</span></div>
      <small>nível do cocho, medido pelo sensor</small>
    </div>
  );
}

function Clock() {
  return (
    <div className="sig sig-clock" aria-hidden>
      <div className="matrix"><span>RECADO PELO TELEGRAM · 16:28 · </span><span>RECADO PELO TELEGRAM · 16:28 · </span></div>
    </div>
  );
}

function Angry() {
  const s = useStore(sling);
  const total = s.total || 10;
  return (
    <div className="sig sig-angry">
      <svg viewBox="0 0 220 70" className="arc" aria-hidden><path d="M10 60 Q 90 -20 200 44" /><circle r="5" className="ball" /></svg>
      <div className="crates">{Array.from({ length: total }, (_, i) => <span key={i} className={i < s.knocked ? 'down' : ''} />)}</div>
      <small>{s.knocked}/{total} caixas derrubadas com o carro</small>
    </div>
  );
}

const MAP = { termolog: Termolog, vcall: Vcall, songv: Songv, duckv: Duckv, farmacia: Farmacia, voto: Voto, esmartigado: Esmartigado, clock: Clock, angry: Angry };
export function Signature({ id }) {
  const C = MAP[id];
  return C ? <C /> : null;
}
