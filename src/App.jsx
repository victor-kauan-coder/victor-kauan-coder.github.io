import { Fragment, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, ArrowDown, FileDown } from 'lucide-react';
import { stations, archive, contact } from './data/projects.js';
import { ui } from './store.js';
import { Nav, Lightbox } from './ui/Chrome.jsx';
import { CaseStudy } from './ui/Case.jsx';
import { Look } from './ui/Look.jsx';
import { Moment } from './ui/Moment.jsx';
import { Laptop } from './ui/Devices.jsx';
import { VideoRoom } from './ui/Videos.jsx';
import { startTermo } from './termo.js';
import { siWhatsapp, siLinkedin, siGithub } from 'simple-icons';

// Marcas oficiais das redes (pacote simple-icons), desenhadas na cor do texto.
const Brand = ({ icon }) => <svg className="brand-icon" viewBox="0 0 24 24" aria-hidden><path d={icon.path} fill="currentColor" /></svg>;

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Telas reais trocando devagar no quadro da abertura, como fotos de uma campanha.
const REEL = ['via', 'termolog', 'vcall', 'voto', 'farmacia', 'duckv', 'esmartigado'].map((id) => {
  const s = stations.find((x) => x.id === id);
  return { id, name: s.name, tag: s.tagline, shot: s.shots[0] };
});

function HeroReel() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduced()) return;
    const t = setInterval(() => setI((x) => (x + 1) % REEL.length), 5200);
    return () => clearInterval(t);
  }, []);
  const cur = REEL[i];
  return (
    <figure className="hero-frame">
      <a className="hero-stage" href={`#${cur.id}`} aria-label={`Ir para ${cur.name}: ${cur.shot.alt}`}>
        <div className="show"><Laptop list={REEL.map((r) => r.shot)} k={i} /></div>
      </a>
      <figcaption>
        <span className="hero-cap-name">{cur.name}</span>
        <span className="hero-cap-tag">{cur.tag}</span>
      </figcaption>
    </figure>
  );
}

const FEATURED = ['via', 'termolog', 'quizzv', 'vcall'].map((id) => stations.find((x) => x.id === id));

// Texto do "sobre" palavra por palavra: cada palavra acende quando passa pela tela.
const STATEMENT = 'Sou estudante de Ciência da Computação na UFPI e construo o sistema inteiro: a placa que mede, a API que guarda e o app que avisa quem precisa agir.';

function Archive() {
  const prev = useRef();
  const [img, setImg] = useState(null);
  const move = (e) => { if (prev.current) prev.current.style.transform = `translate3d(${e.clientX + 24}px, ${e.clientY - 90}px, 0)`; };
  return (
    <section className="archive" id="arquivo" aria-labelledby="t-arquivo" onPointerMove={move} onPointerLeave={() => setImg(null)}>
      <h2 id="t-arquivo" className="section-title">Antes desses</h2>
      <ul className="archive-list">
        {archive.map((a) => (
          <li key={a.name} onPointerEnter={() => setImg(a.shot || null)}>
            <a href={a.href} target="_blank" rel="noreferrer">
              <span className="archive-name">{a.name}</span>
              <span className="archive-text">{a.text}</span>
              <span className="archive-stack">{a.stack.join('  /  ')}</span>
              <ArrowUpRight size={22} aria-hidden />
            </a>
            {a.shot && <img className="archive-inline" src={a.shot} alt={`Tela do ${a.name}`} loading="lazy" />}
          </li>
        ))}
      </ul>
      <div className={`archive-preview ${img ? 'on' : ''}`} ref={prev} aria-hidden>{img && <img src={img} alt="" />}</div>
    </section>
  );
}

export default function App() {
  useEffect(() => { startTermo(); }, []);
  return (
    <>
      <a className="skip" href="#projetos">Pular para os projetos</a>
      <Nav />
      <main>
        <section className="hero" id="inicio">
          <h1 className="hero-name">
            <span className="mask"><span>Victor</span></span>
            <span className="mask"><span>Kauan</span></span>
          </h1>
          <div className="hero-side">
            <p className="hero-line">Do sensor na parede ao app no seu bolso. Desenvolvedor full-stack, de Teresina.</p>
            <div className="hero-actions">
              <a className="cta" href="#projetos">Ver projetos <ArrowDown size={16} aria-hidden /></a>
              <a className="txt-link" href="#contato">Falar comigo</a>
            </div>
          </div>
          <HeroReel />
          <ul className="hero-row" aria-label="Projetos em destaque">
            {FEATURED.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>
                  <img src={s.shots[0].thumb} alt="" loading="lazy" />
                  <span className="row-name">{s.name}</span>
                  <span className="row-tag">{s.tagline}</span>
                  <span className="row-go">Ver</span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="about" id="sobre" aria-labelledby="t-sobre">
          <h2 id="t-sobre" className="sr-only">Sobre mim</h2>
          <p className="statement">{STATEMENT.split(' ').map((w, i) => <span key={i}>{w} </span>)}</p>
          <div className="about-grid">
            <img className="about-photo" src="https://github.com/victor-kauan-coder.png" alt="Foto de Victor Kauan" width="460" height="460" loading="lazy" />
            <dl className="about-facts">
              <div><dt>UFPI</dt><dd>Ciência da Computação, 2024 a 2028. Monitor de Arquitetura de Computadores, Estrutura de Dados, Projeto e Análise de Algoritmos e Teoria da Computação.</dd></div>
              <div><dt>CESLA</dt><dd>Pesquisa em visão computacional desde 2025: API que lê formulários marcados (Python e OpenCV) e algoritmos de biometria digital em C++.</dd></div>
              <div><dt>PET Saúde Digital</dt><dd>Bolsista de 2025 a 2026: PWA para acompanhar usuários, turmas e avaliações e um painel que automatizou as métricas da equipe.</dd></div>
              <div><dt>Estágio</dt><dd>Desde 2026 numa farmácia de manipulação: painel de vendas que reúne as filiais e orçamento direto pelo WhatsApp.</dd></div>
            </dl>
            <div className="about-more">
              <p><strong>Finalista da OBI</strong> e participante do <strong>HackaTruck IBM & Apple</strong>. Organizador da Maratona de Programação da SBC no Piauí e da Olimpíada Brasileira de Robótica.</p>
              <p className="about-skills">
                Python, TypeScript, Go, Kotlin, C e C++, Java, Swift, SQL. React, FastAPI, Django, Flask, GraphQL, Spring Boot, Electron, WebRTC, Jetpack Compose.
                PostgreSQL, Firebase, Docker, GitHub Actions, Linux. OpenCV, Gemini API e IA local, Node-RED e IoT com ESP. Inglês B2.
              </p>
            </div>
          </div>
        </section>

        <div className="band" aria-hidden>
          <p className="band-track">
            {['ESP32', 'FastAPI', 'React', 'Kotlin', 'PostgreSQL', 'WebRTC', 'SwiftUI', 'Electron', 'OpenGL', 'Node.js', 'LoRa', 'Three.js'].map((t, i) => i % 3 === 0 ? <b key={t}>{t}</b> : <span key={t}>{t}</span>)}
          </p>
        </div>

        <div id="projetos" className="looks">
          {stations.map((s, i) => (
            <Fragment key={s.id}>
              <Look s={s} i={i} />
              {s.id === 'termolog' && <Moment />}
            </Fragment>
          ))}
        </div>

        <VideoRoom />

        <Archive />

        <section className="contact" id="contato" aria-labelledby="t-contato">
          <h2 id="t-contato" className="contact-title">Vamos conversar</h2>
          <p className="contact-line">Estágio, vaga ou um sistema para o seu negócio.</p>
          <a className="contact-mail" href={`mailto:${contact.email}`}>{contact.email}</a>
          <ul className="contact-links">
            <li><a href={contact.whatsapp} target="_blank" rel="noreferrer"><span><Brand icon={siWhatsapp} />WhatsApp</span><ArrowUpRight size={18} aria-hidden /></a></li>
            <li><a href={contact.linkedin} target="_blank" rel="noreferrer"><span><Brand icon={siLinkedin} />LinkedIn</span><ArrowUpRight size={18} aria-hidden /></a></li>
            <li><a href={contact.github} target="_blank" rel="noreferrer"><span><Brand icon={siGithub} />GitHub</span><ArrowUpRight size={18} aria-hidden /></a></li>
            <li><a href={contact.cv} download><span><FileDown size={22} aria-hidden />Currículo em PDF</span><ArrowUpRight size={18} aria-hidden /></a></li>
          </ul>
          <p className="credits">Modelos 3D do nó do TermoLOG: biblioteca 3D do KiCad (CC BY-SA 4.0). Telas de Pharmavision, OrçaLink e VIA com dados fictícios. Telas do QuizzV com uma biblioteca de demonstração. Pessoas nas telas do Vcall: fotos de banco de imagens usadas como câmera numa chamada real.</p>
        </section>
      </main>
      <CaseStudy />
      <Lightbox />
    </>
  );
}
