# Design do portfólio

Lookbook escuro: cada projeto é apresentado como uma campanha de produto, com a marca real, as telas reais dentro de aparelhos e animação ligada à rolagem.

## Tema e idioma

- Escuro é o padrão; o botão no topo troca para o claro (papel e tinta, mesmos nomes de token) e a escolha fica salva. Logos com texto claro têm uma versão `-tinta.svg`.
- Português e inglês em `src/i18n.js`: o texto em português é a chave. Sem escolha salva, vale o idioma do navegador. Texto novo precisa de entrada no dicionário. Capturas, vídeos e currículo continuam em português.

## Cores

| Token | Valor | Uso |
|---|---|---|
| `--ink` | `#0b0b0a` | fundo da página |
| `--ink-2` / `--ink-3` | `#131312` / `#1b1b19` | superfícies (legendas, fila de vídeos) |
| `--bone` | `#f2efe8` | texto principal, botão primário |
| `--stone` | `#a8a59d` | texto secundário |
| `--rule` / `--rule-2` | osso a 14% / 26% | filetes de 1px |
| `--ember` | `#f0643c` | único acento do site (seleção, cursor de texto) |
| `--pc` | cor de cada projeto | luz de fundo do anúncio, contorno do nome gigante, marcadores |

A cor de um projeto aparece só dentro do anúncio dele. O QuizzV troca `--pc` pela cor de destaque escolhida no seletor.

## Tipografia

- Display: Archivo Variable condensado (`font-stretch: 62%`), caixa alta, peso 800. Nome na abertura, manchete de cada anúncio, títulos de seção.
- Texto: Geist Variable.
- Dados técnicos (stack, durações): Geist Mono.
- Fontes servidas pelo próprio site (pacotes `@fontsource`).

## Forma

- Cantos retos em tudo que é da página (botões, legendas, painéis). Os aparelhos mantêm os cantos reais.
- Botão primário: osso chapado com texto em tinta, caixa alta espaçada. Secundário: texto com sublinhado que recolhe no hover.

## Componentes

- **Anúncio (`Look`)**: seção alta com conteúdo preso na tela. A logo nasce grande no centro e sobe para o lugar; a manchete sobe palavra por palavra; funcionalidades entram em sequência; as telas trocam conforme a rolagem; legenda com marcadores de progresso.
- **Vitrine (`Devices`)**: MacBook Pro e iPhone 14 Pro da biblioteca devices.css (MIT). A tela de cada aparelho assume a proporção exata das capturas do projeto; capturas de outra proporção ficam só na galeria.
- **Momento 3D**: só no TermoLOG. Peças da biblioteca 3D do KiCad sobre uma placa com trilhas, display com a leitura ao vivo, ondas de rádio e LED que acende no alerta. A cena é preparada com o navegador ocioso, antes de a pessoa chegar.
- **Sala de vídeos**: player e fila; ao terminar, toca o próximo.

## Movimento

- Animações só em `transform` e `opacity`; nada que repinte a tela inteira a cada quadro (sem filtros nem fundos que mudam com a rolagem).
- `prefers-reduced-motion` desliga entradas, giros e trocas automáticas.

## Telas pequenas

- Até 860px de largura ou 540px de altura (celular, tablet em pé, celular deitado): nada fica preso à rolagem, cada projeto tem a altura do próprio conteúdo, as telas trocam sozinhas e os blocos entram ao aparecer (`src/movel.js` e `src/movel.css`, mesma condição nos dois).
- Nunca deixar altura baseada em rolagem presa nesses tamanhos: vira tela preta.
- A cena 3D só carrega no celular quando a pessoa chega perto.
- Computador baixo (até 900px de altura) ou estreito (até 1200px): anúncio compacto (menos itens, fonte menor) para nada sobrepor.
- Com "reduzir movimento" ligado no aparelho, as animações ficam desligadas.
