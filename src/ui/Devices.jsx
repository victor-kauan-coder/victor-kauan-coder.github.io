import { useLayoutEffect, useRef } from 'react';
import 'devices.css/dist/devices.min.css';

// Vitrine de produto: as telas reais dentro de um MacBook Pro e de um iPhone 14 Pro realistas
// (biblioteca devices.css, MIT), sobre um painel na cor da marca, em perspectiva que gira com a rolagem.

const isPhone = (sh) => sh.w <= 1100 && sh.h / sh.w > 1.7 && sh.h / sh.w < 3;
const mid = (sh) => (sh.src.includes('-m.webp') ? sh.src : sh.src.replace('.webp', '-m.webp'));

// Página mais alta que larga: rola dentro da tela (não define a proporção do aparelho).
const isPage = (sh) => !isPhone(sh) && sh.w / sh.h < 1.2;
const same = (a, b) => Math.abs(a - b) / b < 0.025;

// Só entram no aparelho as capturas com a mesma proporção (ou páginas que rolam): nada cortado nem esticado.
export function splitShots(shots) {
  const phoneAll = shots.filter(isPhone), deskAll = shots.filter((x) => !isPhone(x));
  const ref = deskAll.find((x) => !isPage(x));
  const deskRatio = ref ? ref.w / ref.h : 1.6;
  const desk = deskAll.filter((x) => isPage(x) || same(x.w / x.h, deskRatio));
  const phoneRatio = phoneAll[0] ? phoneAll[0].w / phoneAll[0].h : 390 / 844;
  const phone = phoneAll.filter((x) => same(x.w / x.h, phoneRatio));
  return { desk, phone, deskRatio, phoneRatio };
}

// O aparelho tem medidas fixas em px: escala para caber na largura do invólucro.
function useFit(base) {
  const ref = useRef();
  useLayoutEffect(() => {
    const el = ref.current;
    const ro = new ResizeObserver(([e]) => el.style.setProperty('--s', (e.contentRect.width / base).toFixed(4)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [base]);
  return ref;
}

function Screens({ list, k, sizes }) {
  return list.map((sh, j) => {
    const long = sh.h / sh.w > 0.75 && !isPhone(sh); // página mais alta que a tela: rola sozinha dentro dela
    return (
      <img key={sh.src} src={mid(sh)} srcSet={`${mid(sh)} 1024w, ${sh.src} 1600w`} sizes={sizes} alt="" decoding="async" loading="lazy"
        className={`${j === k ? 'on' : ''} ${long ? 'long' : ''}`} style={long ? { '--scroll': `${Math.min(14, 4 + (sh.h / sh.w) * 3)}s` } : undefined} />
    );
  });
}

export function Laptop({ list, k, ratio = 1.6, className = '' }) {
  const ref = useFit(740);
  const dh = 600 / ratio - 375; // a tela do MacBook (600 x 375) passa a ter a proporção das capturas
  return (
    <div className={`dev-laptop ${className}`} ref={ref} style={{ '--dh': `${dh}px`, aspectRatio: `740 / ${434 + dh}` }}>
      <div className="device device-macbook-pro device-spacegray">
        <div className="device-frame"><div className="device-screen dev-stack"><Screens list={list} k={k} sizes="50vw" /></div></div>
        <div className="device-stripe" /><div className="device-header" /><div className="device-sensors" /><div className="device-btns" /><div className="device-power" />
      </div>
    </div>
  );
}

export function PhoneShell({ className = '', ratio = 390 / 844, children }) {
  const ref = useFit(428);
  const sh = 408 / ratio; // tela do iPhone com a proporção exata das capturas
  return (
    <div className={`dev-phone ${className}`} ref={ref} style={{ '--ph': `${sh}px`, aspectRatio: `428 / ${sh + 20}` }}>
      <div className="device device-iphone-14-pro device-spacegray">
        <div className="device-frame"><div className="device-screen dev-stack">{children}</div></div>
        <div className="device-stripe" /><div className="device-header" /><div className="device-sensors" /><div className="device-btns" /><div className="device-power" />
      </div>
    </div>
  );
}

export const Phone = ({ list, k, className, ratio }) => <PhoneShell className={className} ratio={ratio}><Screens list={list} k={k} sizes="18vw" /></PhoneShell>;

// Escolhe a composição pelo que o projeto tem: notebook + celular, notebook + janela flutuante, ou três celulares.
export function Showcase({ shots, k }) {
  const { desk, phone, deskRatio, phoneRatio } = splitShots(shots);
  if (!desk.length) {
    const n = phone.length;
    return (
      <div className="show show-phones">
        <Phone list={phone} k={(k + n - 1) % n} className="side left" ratio={phoneRatio} />
        <Phone list={phone} k={k % n} className="front" ratio={phoneRatio} />
        <Phone list={phone} k={(k + 1) % n} className="side right" ratio={phoneRatio} />
      </div>
    );
  }
  return (
    <div className={`show ${phone.length ? 'show-duo' : 'show-window'}`}>
      {!phone.length && desk.length > 1 && (
        <div className="dev-window"><div className="dev-window-bar"><i /><i /><i /></div><div className="dev-window-screen dev-stack" style={{ aspectRatio: deskRatio }}><Screens list={desk} k={(k + 1) % desk.length} sizes="30vw" /></div></div>
      )}
      <Laptop list={desk} k={k % desk.length} ratio={deskRatio} />
      {phone.length > 0 && <Phone list={phone} k={k % phone.length} className="float" ratio={phoneRatio} />}
    </div>
  );
}

// Seletor de cores (QuizzV e Vcall): três celulares com o app na cor de destaque escolhida.
export function ColorPhones({ cores, c, extra, k }) {
  const ratio = 780 / 1688; // capturas do QuizzV (390 x 844 em 2x)
  const stack = (key) => cores.map((cor, j) => <img key={cor.id} src={cor[key]} alt="" className={j === c ? 'on' : ''} decoding="async" loading="lazy" />);
  return (
    <div className="show show-phones">
      <PhoneShell className="side left" ratio={ratio}>
        {extra.map((sh, j) => <img key={sh.src} src={mid(sh)} alt="" className={j === k % extra.length ? 'on' : ''} decoding="async" loading="lazy" />)}
      </PhoneShell>
      <PhoneShell className="front" ratio={ratio}>{stack('home')}</PhoneShell>
      <PhoneShell className="side right" ratio={ratio}>{stack('quiz')}</PhoneShell>
    </div>
  );
}
