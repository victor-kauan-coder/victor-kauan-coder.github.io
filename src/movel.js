// Celular e tablet (ou tela baixa, como celular deitado): nada fica preso à rolagem
// e cada bloco entra quando aparece na tela. A mesma condição está no CSS (movel.css).
export const COMPACTA = '(max-width: 860px), (max-height: 540px)';
export const compacta = () => matchMedia(COMPACTA).matches;
const reduzido = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const BLOCOS = [
  '.statement', '.about-photo', '.about-facts > div', '.about-more',
  '.look-frame', '.look-logo', '.look-body', '.look-feats li', '.look-meta', '.look-links', '.look-actions',
  '.moment-title', '.section-title', '.videos-player', '.videos-queue li', '.archive-list li',
  '.contact-title', '.contact-line', '.contact-mail', '.contact-links li', '.credits',
].join(',');

export function revelarNoCelular() {
  if (!compacta() || reduzido()) return undefined;
  const io = new IntersectionObserver((entradas) => {
    entradas.filter((e) => e.isIntersecting).forEach((e, i) => {
      e.target.style.setProperty('--atraso', `${Math.min(i, 5) * 70}ms`); // o que chega junto entra em sequência
      e.target.classList.add('rv-in');
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -5% 0px' });
  document.querySelectorAll(BLOCOS).forEach((el) => { el.classList.add('rv'); io.observe(el); });
  // a manchete não some inteira: são as palavras que sobem (só observa)
  document.querySelectorAll('.look-head').forEach((el) => io.observe(el));
  return () => io.disconnect();
}
