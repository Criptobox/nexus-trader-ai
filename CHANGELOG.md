# Changelog

## 2.0.1 — NEXUS 3D + Intelligence Patch
- Replaced the chrome-orb 3D avatar with a procedural humanoid cyber-agent built with Three.js/React Three Fiber.
- Added state-reactive head/eye tracking, speaking animation, chest intelligence core, lighting and alert/trading states.
- Added transparent Radar score breakdown: momentum, trend, volume, structure and stability.
- Improved memory retrieval with token-level relevance in addition to exact matching, recency and importance.
- Fixed the backtesting engine so configured commission is actually respected.
- Added configurable slippage support to the backtest API with safe bounds.

## NEXUS Trader AI

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [2.0.0] — 2026-09-25

### Añadido
- **Avatar 3D interactivo de NEXUS** (`components/agents/nexus-3d-scene.tsx`): orbe de cromo procedural construido con Three.js + React Three Fiber.
  - Vivo: flota, respira, parpadea con ritmo natural y deambula con la mirada cuando no detecta actividad.
  - Interactivo: **sigue tu cursor/dedo con ojos y cabeza**, reacciona a los taps con giro celebratorio y "boing".
  - 6 estados animados con color propio: `idle` (esmeralda), `listening` (ámbar), `thinking` (cian), `speaking` (verde con núcleo de voz pulsante), `happy` (dorado con ojos ^^), `alert` (rojo pulsante).
  - Look cinematográfico: bloom (postprocessing), anillos giroscópicos con cuentas luminosas, partículas orbitales, halo de energía en el suelo, iluminación de ánimo y entorno procedural (sin HDR externo).
  - Carga diferida solo en cliente con fallback 2D animado.
- **Radar de Oportunidades** ("ascensor financiero") (`lib/agents/radar.ts` + `api/opportunities`):
  - Escanea 20 principales (Binance/demo) + **tendencias globales de CoinGecko** + las monedas custom del usuario.
  - Puntuación 0-100: momentum 24h, tendencia 7d, volumen relativo, fuerza vs máximo 24h, penalización por volatilidad, calor de tendencias y **descuento por incertidumbre** (riesgo alto nunca puntúa al máximo).
  - Clasificación EMERGENTE / IMPULSO / TENDENCIA / REVERSIÓN / ESTABLE con tesis narrada en español usando los datos reales del escaneo.
  - NEXUS presenta el resultado con su avatar 3D (celebra cuando hay zona de interés) y acción sugerida: ZONA DE INTERÉS / VIGILAR / OBSERVAR / EVITAR.
  - Handoff directo "Analizar con el comité" → chat con `cgId` para análisis completo incluso de monedas fuera del universo base.
- Chat universal de monedas: el chat ahora **resuelve cualquier ticker mencionado** (ONDO, HYPE, PEPE…) vía búsqueda CoinGecko con caché, y acepta `cgId` explícito en la petición.
- `getTrendingCoins()` en la capa CoinGecko + `getCustomQuotes()` con opción `sparkline:false` para llamadas ligeras resistentes al rate limit.

### Corregido
- Detección de símbolos en el chat con límites de palabra ("stop" ya no activa la moneda OP).
- Reintentos de CoinGecko más pacientes (4 intentos, timeouts de 8 s) con caché stale como último recurso.

### Técnico
- Nuevas dependencias: `three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`.
- Versión en UI (header) y `package.json` sincronizadas a 2.0.0.

## [1.0.0] — 2026-09-24

### Añadido
- PWA premium dark glassmorphism mobile-first con 8 vistas + navegación inferior y FAB.
- Comité multiagente de 6 especialistas con pipeline determinista + síntesis LLM vía router multi-modelo con cadena de fallback.
- Conversación por voz (STT/TTS Web Speech API) sincronizada con el avatar.
- 20 criptomonedas con logos de marca + añadir cualquier moneda de CoinGecko con su logo original, precio en vivo y velas.
- Gráficos SVG propios: velas japonesas con volumen, sparklines, indicadores (SMA/EMA/RSI/MACD/ATR/Bollinger).
- Risk Engine (riesgo/op, stop diario, drawdown, exposición, R:R, guardia de volatilidad) y Kill Switch en 4 niveles.
- Paper trading engine (market orders, slippage, comisiones, SL/TP) y backtesting (4 estrategias, Sharpe/Sortino/PF/maxDD).
- Vault AES-256-GCM + scrypt para claves de exchange, memoria persistente del agente con decaimiento por recencia.
- Base de conocimientos: 8 artículos + glosario en español integrados en el chat.
- Documentación: ARQUITECTURA, ROADMAP (6 fases cero → real), SEGURIDAD.
