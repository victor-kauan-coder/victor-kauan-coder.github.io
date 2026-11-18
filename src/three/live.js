import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { termo, startTermo, stopTermo, fmtC } from '../termo.js';
import { led } from '../store.js';

// Texturas desenhadas ao vivo num canvas, aplicadas sobre telas de modelos baixados.

// Painel do TermoLOG com a mesma leitura da simulação do HTML.
export function useTermoDashboard() {
  const t = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 640;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const draw = (s) => {
      const g = c.getContext('2d'); const bad = s.alert;
      g.fillStyle = '#0e1015'; g.fillRect(0, 0, 1024, 640);
      g.fillStyle = bad ? '#4a1810' : '#12161d'; g.fillRect(0, 0, 1024, 76);
      g.fillStyle = bad ? '#ffb39c' : '#8b95a7'; g.font = '700 30px Manrope, sans-serif';
      g.fillText(bad ? 'ALERTA · sala 204 fora da faixa' : 'Todas as salas na faixa', 32, 50);
      g.fillStyle = '#e9ecf2'; g.font = '700 32px Manrope, sans-serif'; g.fillText('Sala 204 · Laboratório', 32, 134);
      g.fillStyle = bad ? '#ff6a3d' : '#e9ecf2'; g.font = '800 160px "JetBrains Mono", monospace';
      const txt = fmtC(s.temp); g.fillText(txt, 28, 300); const tw = g.measureText(txt).width;
      g.font = '600 50px Manrope, sans-serif'; g.fillText('°C', 44 + tw, 230);
      g.fillStyle = '#8b95a7'; g.font = '500 28px Manrope, sans-serif';
      g.fillText(`Umidade ${Math.round(s.hum)}%  ·  faixa ${s.min}–${s.max} °C`, 32, 352);
      const x0 = 32, y0 = 390, w = 960, h = 220, lo = 14, hi = 42, Y = (v) => y0 + h - ((v - lo) / (hi - lo)) * h;
      g.fillStyle = 'rgba(255,106,61,0.1)'; g.fillRect(x0, Y(s.max), w, Y(s.min) - Y(s.max));
      g.strokeStyle = bad ? '#ff6a3d' : '#7fd3ff'; g.lineWidth = 6; g.lineJoin = 'round'; g.beginPath();
      s.history.forEach((v, i) => { const x = x0 + (i / (s.history.length - 1)) * w; i ? g.lineTo(x, Y(v)) : g.moveTo(x, Y(v)); });
      g.stroke(); tex.needsUpdate = true;
    };
    draw(termo.get());
    return { tex, draw };
  }, []);
  useEffect(() => {
    startTermo();
    const off = termo.subscribe(() => t.draw(termo.get()));
    return () => { off(); stopTermo(); };
  }, [t]);
  return t.tex;
}

// Letreiro de LED (o LED Clock): mostra a hora ou rola o recado digitado no site.
export function useLedSign() {
  const t = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    return { c, tex, x: 1024, acc: 0 };
  }, []);
  useFrame((_, dt) => {
    // redesenha a ~15 quadros por segundo: o letreiro não precisa de 60
    t.acc += dt; if (t.acc < 1 / 15) return; dt = t.acc; t.acc = 0;
    const g = t.c.getContext('2d');
    g.fillStyle = '#120404'; g.fillRect(0, 0, 1024, 256);
    // grade de pontos apagados, como a matriz MAX7219
    g.fillStyle = '#2a0b08';
    for (let y = 16; y < 256; y += 32) for (let x = 16; x < 1024; x += 32) { g.beginPath(); g.arc(x, y, 11, 0, 7); g.fill(); }
    const msg = led.get().msg;
    const d = new Date();
    const text = msg || `${String(d.getHours()).padStart(2, '0')}${d.getSeconds() % 2 ? ':' : ' '}${String(d.getMinutes()).padStart(2, '0')}`;
    g.font = '900 190px "JetBrains Mono", monospace'; g.fillStyle = '#ff3b2f'; g.shadowColor = '#ff3b2f'; g.shadowBlur = 30; g.textBaseline = 'middle';
    if (msg) { t.x -= dt * 260; const w = g.measureText(text).width; if (t.x < -w) t.x = 1024; g.fillText(text, t.x, 136); }
    else { const w = g.measureText(text).width; g.fillText(text, (1024 - w) / 2, 136); }
    g.shadowBlur = 0; t.tex.needsUpdate = true;
  });
  return t.tex;
}
