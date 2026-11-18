import { useState } from 'react';
import { ExternalLink, Lock, Play, Pause, Send, Thermometer, Snowflake, Sun, Car } from 'lucide-react';
import { stations } from '../data/projects.js';
import { Signature } from './Signature.jsx';
import { ui, useStore, led, sling, unlock } from '../store.js';
import { termo, fmtC } from '../termo.js';
import { audio, toggleAudio } from '../audio.js';

function TermoPanel() {
  const s = useStore(termo);
  const status = s.alert ? 'Alerta: sala fora da faixa' : s.outCount > 0 ? `Fora da faixa (${s.outCount}/3 leituras)` : 'Na faixa';
  return (
    <div className={`sim ${s.alert ? 'hot' : ''}`}>
      <div className="sim-head">
        <Thermometer size={18} />
        <strong>Simulação ao vivo</strong>
        <span className="sim-status" role="status">{status}</span>
      </div>
      <div className="sim-read">
        <span className="num">{fmtC(s.temp)}<small> °C</small></span>
        <span className="sub">umidade {Math.round(s.hum)}% · faixa {s.min}–{s.max} °C</span>
      </div>
      <label className="sim-range">
        <span><Snowflake size={16} /> Ar-condicionado</span>
        <input type="range" min="16" max="38" step="0.5" value={s.ambient} onChange={(e) => termo.set({ ambient: +e.target.value })} aria-label="Temperatura do ambiente" />
        <span>Sol na janela <Sun size={16} /></span>
      </label>
      <p className="sim-hint">Arraste para esquentar a sala 204. Cada leitura sai do ESP32, passa pela API e chega ao painel. Três leituras fora da faixa disparam o alerta no celular.</p>
      <ol className="sim-log" aria-label="Registro das leituras">
        {s.log.slice(0, 5).map((l, i) => <li key={s.seq + '-' + i} className={l.includes('ALERTA') ? 'bad' : ''}>{l}</li>)}
      </ol>
    </div>
  );
}

function SongWidget() {
  const playing = useStore(audio, (s) => s.playing);
  return (
    <button className="btn primary" onClick={toggleAudio}>
      {playing ? <Pause size={18} /> : <Play size={18} />} {playing ? 'Pausar a batida' : 'Tocar uma batida'}
    </button>
  );
}

function ClockWidget() {
  const [v, setV] = useState('');
  return (
    <form className="led-form" onSubmit={(e) => { e.preventDefault(); led.set({ msg: v.trim() }); if (v.trim()) unlock('recado'); }}>
      <input value={v} maxLength={40} onChange={(e) => setV(e.target.value)} placeholder="Escreva um recado para a matriz" aria-label="Recado para a matriz de LED" />
      <button className="btn primary" type="submit"><Send size={18} /> Enviar</button>
      {led.get().msg && <button className="btn ghost" type="button" onClick={() => { setV(''); led.set({ msg: '' }); }}>Voltar à hora</button>}
    </form>
  );
}

function TowerWidget() {
  const s = useStore(sling);
  const i = stations.findIndex((x) => x.id === 'angry');
  return (
    <div className="sling-ui">
      <p className="sim-hint">No fliperama tem uma torre de caixas. Dirija até lá e derrube com o carro.</p>
      <div className="actions">
        <button className="btn primary" onClick={() => ui.set({ mode: 'game', target: i, dossier: null, near: null })}><Car size={18} /> Ir dirigindo até lá</button>
        <span className="score" role="status">{s.knocked}/{s.total || 10} caixas derrubadas</span>
      </div>
    </div>
  );
}

export const WIDGET = { termolog: TermoPanel, songv: SongWidget, clock: ClockWidget, angry: TowerWidget };

export function Arch({ nodes, color }) {
  return (
    <ol className="arch" style={{ '--c': color }} aria-label="Arquitetura">
      {nodes.map(([a, b]) => <li key={a}><strong>{a}</strong><span>{b}</span></li>)}
    </ol>
  );
}

export function ProjectSection({ s }) {
  const W = WIDGET[s.id];
  const open = (i) => ui.set({ lightbox: { list: s.shots, i } });
  return (
    <section className={`project p-${s.id}`} id={s.id} data-stop style={{ '--c': s.color }}>
      <div className="panel">
        <div className="panel-sig"><Signature id={s.id} /></div>
        <p className="team">{s.team}</p>
        <h2>{s.name}</h2>
        <p className="tagline">{s.tagline}</p>
        <dl className="metrics small">{s.metrics.slice(0, 3).map(([v, l]) => <div key={l}><dt>{v}</dt><dd>{l}</dd></div>)}</dl>
        <p className="body">{s.problem} {s.solution}</p>
        {W && <W />}
        <ul className="features">{s.features.slice(0, 4).map((f) => <li key={f}>{f}</li>)}</ul>
        {s.shots.length > 0 && (
          <div className="shots">
            {s.shots.slice(0, 4).map((sh, i) => (
              <button key={sh.src} className={sh.tall ? 'tall' : ''} onClick={() => open(i)} aria-label={`Ampliar: ${sh.alt}`}>
                <img src={sh.thumb} alt={sh.alt} loading="lazy" decoding="async" />
              </button>
            ))}
          </div>
        )}
        <div className="actions dossier-actions">
          <button className="btn primary" onClick={() => ui.set({ dossier: s.id })}>Abrir estudo de caso</button>
          {s.shots.length > 4 && <button className="btn ghost" onClick={() => open(0)}>{s.shots.length} telas</button>}
        </div>
        <div className="links">
          {s.links.map((l) => <a key={l.href} href={l.href} target="_blank" rel="noreferrer">{l.label} <ExternalLink size={15} /></a>)}
          {s.private && <span className="private"><Lock size={15} /> {s.private}</span>}
        </div>
      </div>
    </section>
  );
}
