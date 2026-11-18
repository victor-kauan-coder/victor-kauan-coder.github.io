import { Component, lazy, Suspense, useEffect, useState } from 'react';
import { stations, archive, contact } from './data/projects.js';
import { scroll, ui, useStore, unlock, achievements, ACH } from './store.js';
import { Hud, QuickList, Toast, GameOverlay, Lightbox, Loading } from './ui/Chrome.jsx';
import { CaseStudy } from './ui/Case.jsx';
import { ProjectSection } from './ui/Project.jsx';
import { ArrowDown, Gamepad2, Github, Linkedin, Mail, MessageCircle, FileDown } from 'lucide-react';

const Scene = lazy(() => import('./three/Scene.jsx'));

// Se a cena 3D falhar (GPU, driver, download), o site continua com o fundo estático.
class SafeScene extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="stage stage-fallback" aria-hidden /> : this.props.children; }
}

function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

// Converte o scroll em "índice de estação" contínuo: 0 = abertura, 1..9 = projetos, 10 = arquivo, 11 = contato.
function useScrollFocus() {
  useEffect(() => {
    let tops = [];
    const measure = () => { tops = [...document.querySelectorAll('[data-stop]')].map((el) => ({ top: el.offsetTop, h: el.offsetHeight })); };
    const onScroll = () => {
      const c = window.scrollY + window.innerHeight / 2;
      let f = 0;
      for (let i = 0; i < tops.length; i++) {
        const { top, h } = tops[i];
        if (c >= top && c < top + h) { f = i + (c - top) / h - 0.5; break; }
        if (c >= top + h) f = i + 0.5;
      }
      f = Math.max(0, f);
      scroll.focus = f;
      const active = Math.round(f);
      if (active !== ui.get().active) {
        ui.set({ active });
        const s = stations[active - 1];
        if (s) unlock(`visit:${s.id}`);
      }
    };
    measure(); onScroll();
    const ro = new ResizeObserver(() => { measure(); onScroll(); });
    ro.observe(document.body);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { ro.disconnect(); window.removeEventListener('scroll', onScroll); };
  }, []);
}

export default function App() {
  const [gl] = useState(hasWebGL);
  const mode = useStore(ui, (s) => s.mode);
  const got = useStore(achievements, (s) => s.got.length);
  useScrollFocus();
  useEffect(() => { document.documentElement.classList.toggle('game', mode === 'game'); }, [mode]);

  return (
    <>
      {gl && <SafeScene><Suspense fallback={null}><Scene /></Suspense></SafeScene>}
      {!gl && <div className="stage stage-fallback" aria-hidden />}
      <Hud />
      {gl && <Loading />}
      <main className="content" aria-hidden={mode === 'game'}>
        <section className="hero" id="inicio" data-stop>
          <div className="hero-copy">
            <h1>Victor Kauan</h1>
            <p className="lede">Faço o sistema inteiro: do sensor preso na parede ao app no seu bolso. Pegue o carro e siga a estrada: cada parada é um projeto real, com as telas de verdade, o sistema funcionando e coisas para derrubar no caminho.</p>
            <div className="actions">
              {gl && <button className="btn primary" onClick={() => { ui.set({ mode: 'game', near: null }); unlock('piloto'); }}><Gamepad2 size={18} /> Dirigir pelo mundo</button>}
              <a className="btn" href="#termolog"><ArrowDown size={18} /> Ver rolando a página</a>
              <button className="btn ghost" onClick={() => ui.set({ quick: true })}>Ver lista de projetos</button>
            </div>
            <p className="hero-meta">Ciência da Computação na UFPI · laboratório CESLA · Teresina, PI</p>
          </div>
        </section>


        <section className="about" id="sobre">
          <div className="panel wide about-panel">
            <div className="about-head">
              <img src="https://github.com/victor-kauan-coder.png" alt="Foto de Victor Kauan" width="132" height="132" />
              <div>
                <h2>Sobre mim</h2>
                <p className="lede">Sou estudante de Ciência da Computação na UFPI, em Teresina, e gosto de construir o sistema inteiro: a placa que mede, a API que guarda, o app que avisa.</p>
              </div>
            </div>
            <div className="about-grid">
              <div>
                <p>No laboratório <strong>CESLA</strong> trabalho com visão computacional: processamento de imagem e correção automática de gabaritos com OpenCV. No <strong>PET Saúde Digital</strong>, uma parceria da UFPI com a Fundação Municipal de Saúde, desenvolvi sistemas usados por equipes de saúde: acompanhamento de participantes e prontuários do CAPS.</p>
                <p>Fora da faculdade faço sistemas para clientes, como os painéis e a integração com WhatsApp de uma rede de farmácias, e projetos próprios que uso todo dia: chamada de vídeo ponto a ponto, player de música com letra traduzida e um app para comandar agentes de código pelo celular.</p>
                <ul className="timeline">
                  <li><strong>UFPI</strong><span>Bacharelado em Ciência da Computação</span></li>
                  <li><strong>CESLA</strong><span>Pesquisa em visão computacional</span></li>
                  <li><strong>PET Saúde Digital</strong><span>Sistemas para a saúde pública de Teresina</span></li>
                  <li><strong>Projetos para clientes</strong><span>Farmácias: painel de vendas e orçamento pelo WhatsApp</span></li>
                </ul>
              </div>
              <div className="skills">
                {[
                  ['Linguagens', ['Python', 'TypeScript', 'JavaScript', 'Kotlin', 'Swift', 'C++', 'C', 'Verilog']],
                  ['Back-end', ['FastAPI', 'Flask', 'Node.js', 'PostgreSQL', 'Firebird', 'Firebase']],
                  ['Front e mobile', ['React', 'React Native', 'Jetpack Compose', 'SwiftUI', 'Electron', 'Three.js']],
                  ['Hardware e IoT', ['ESP32', 'ESP8266', 'LoRa', 'sensores', 'Node-RED']],
                  ['Ferramentas', ['Docker', 'Git e GitHub', 'Playwright', 'Linux', 'WebRTC', 'OpenCV']],
                ].map(([t, list]) => (
                  <div key={t}><h3>{t}</h3><div className="chips">{list.map((x) => <span key={x}>{x}</span>)}</div></div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {stations.map((s) => <ProjectSection key={s.id} s={s} />)}

        <section className="archive" id="arquivo" data-stop>
          <div className="panel wide">
            <h2>Mais projetos</h2>
            <p className="lede">Projetos de pesquisa, saúde pública e faculdade que continuam de pé.</p>
            <ul className="archive-list">
              {archive.map((a) => (
                <li key={a.name}>
                  {a.shot && <img src={a.shot} alt={`Tela do ${a.name}`} loading="lazy" onClick={() => ui.set({ lightbox: { list: [{ src: a.shot, alt: a.name }], i: 0 } })} />}
                  <div>
                    <h3>{a.name}</h3>
                    <p>{a.text}</p>
                    <div className="chips">{a.stack.map((t) => <span key={t}>{t}</span>)}</div>
                    <a href={a.href} target="_blank" rel="noreferrer">Ver no GitHub</a>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="contact" id="contato" data-stop>
          <div className="panel contact-panel">
            <h2>Bora construir o próximo?</h2>
            <p className="lede">Estágio, vaga ou um sistema para o seu negócio: me chama.</p>
            <div className="contact-grid">
              <a className="btn primary" href={`mailto:${contact.email}`}><Mail size={18} /> {contact.email}</a>
              <a className="btn" href={contact.whatsapp} target="_blank" rel="noreferrer"><MessageCircle size={18} /> WhatsApp</a>
              <a className="btn" href={contact.linkedin} target="_blank" rel="noreferrer"><Linkedin size={18} /> LinkedIn</a>
              <a className="btn" href={contact.github} target="_blank" rel="noreferrer"><Github size={18} /> GitHub</a>
              <a className="btn" href={contact.cv} download><FileDown size={18} /> Currículo (PDF)</a>
            </div>
            <p className="foot">{got} de {Object.keys(ACH).length} conquistas desbloqueadas neste navegador · © 2026 Victor Kauan</p>
          </div>
        </section>
      </main>
      <GameOverlay />
      <QuickList />
      <CaseStudy />
      <Lightbox />
      <Toast />
    </>
  );
}
