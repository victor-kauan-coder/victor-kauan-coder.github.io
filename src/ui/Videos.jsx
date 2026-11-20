import { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { videos, stations } from '../data/projects.js';
import { ui, useStore } from '../store.js';

// Sala de vídeos no fim da página: o player grande e a fila ao lado; ao terminar, entra o próximo.
// Um botão "Assistir" num projeto abre esta sala já no vídeo dele.
export function VideoRoom() {
  const want = useStore(ui, (s) => s.video);
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const ref = useRef(), sec = useRef();
  const cur = videos[i];

  // pedido vindo de um projeto: rola até a sala e toca o vídeo dele
  useEffect(() => {
    if (!want) return;
    const j = videos.findIndex((v) => v.id === want);
    if (j >= 0) { setI(j); setPlaying(true); sec.current?.scrollIntoView({ behavior: 'smooth' }); }
    ui.set({ video: null });
  }, [want]);
  useEffect(() => {
    const v = ref.current; if (!v) return;
    v.load();
    if (playing) v.play().catch(() => setPlaying(false));
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  const color = stations.find((s) => s.id === cur.id)?.color;
  return (
    <section className="videos" id="videos" ref={sec} aria-labelledby="t-videos" style={{ '--pc': color }}>
      <h2 id="t-videos" className="section-title">Em vídeo</h2>
      <div className="videos-grid">
        <figure className="videos-player">
          <video ref={ref} poster={cur.poster} controls playsInline preload="none" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
            onEnded={() => { setPlaying(true); setI((x) => (x + 1) % videos.length); }}>
            <source src={cur.src} type="video/mp4" />
          </video>
          <figcaption><strong>{cur.title}</strong><span>{cur.kind}</span><a href={`#${cur.id}`}>Ver o projeto</a></figcaption>
        </figure>
        <ol className="videos-queue" aria-label="Fila de vídeos">
          {videos.map((v, j) => (
            <li key={v.id}>
              <button type="button" className={j === i ? 'on' : ''} aria-current={j === i ? 'true' : undefined}
                onClick={() => { setPlaying(true); if (j === i) ref.current?.play(); else setI(j); }} style={{ '--vc': stations.find((s) => s.id === v.id)?.color }}>
                <span className="vq-thumb"><img src={v.poster} alt="" loading="lazy" /><Play size={18} aria-hidden /></span>
                <span className="vq-text"><strong>{v.title}</strong><span>{v.kind}</span></span>
                <span className="vq-dur">{v.dur}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
