
import { useStore } from '../store.js';
import { Thermometer, Snowflake, Sun } from 'lucide-react';
import { termo, fmtC } from '../termo.js';

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
        <span className="sub">umidade {Math.round(s.hum)}% · faixa {s.min} a {s.max} °C</span>
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

export const WIDGET = { termolog: TermoPanel };
