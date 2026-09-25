# 🤖 NEXUS Trader AI — Agente de Trading Cripto Multiagente

**PWA móvil premium** con un comité de agentes IA especializados, **avatar 3D interactivo vivo**, conversación por voz, radar de oportunidades, análisis técnico en vivo, backtesting, paper trading, Risk Engine y Kill Switch — listo para montar en GitHub.

![Versión](https://img.shields.io/badge/versión-2.0.0-emerald) ![Stack](https://img.shields.io/badge/Next.js%2016-React%2019-black) ![TS](https://img.shields.io/badge/TypeScript-5-blue) ![DB](https://img.shields.io/badge/Prisma-SQLite-green) ![Licencia](https://img.shields.io/badge/Licencia-MIT-yellow)

---

## ✨ Funcionalidades

| Módulo | Descripción |
|---|---|
| 🧊 **Avatar 3D interactivo** | NEXUS es un orbe de cromo **vivo en 3D (Three.js + React Three Fiber)**: flota, respira, parpadea, **sigue tu cursor/dedo con la mirada y la cabeza**, reacciona a los taps con giro celebratorio, y cambia de color/animación según su estado (reposo, escuchando, pensando, hablando, feliz 🎉, alerta 🚨). Bloom cinematográfico, anillos giroscópicos, partículas orbitales y núcleo de voz que pulsa al hablar |
| 🤖 **Comité multiagente** | 6 especialistas: **NEXUS** (orquestador con avatar 3D), **Vega** (técnico), **Scout** (mercado), **Aegis** (riesgo), **Atlas** (estratega) y **Lyra** (educadora) |
| 🎙️ **Voz** | Habla con el agente (Web Speech API) y escucha sus respuestas con la mejor voz española disponible; el avatar 3D reacciona en vivo (escuchando → pensando → hablando) |
| 📡 **Radar de Oportunidades** | El **"ascensor financiero"**: escanea los principales + **tendencias globales de CoinGecko** + tus monedas, puntúa cada activo 0-100 (momentum, tendencia 7d, volumen, fuerza vs máximo, volatilidad) y **NEXUS te aconseja** con tesis narrada, nivel de riesgo y acción sugerida. Handoff directo al comité para análisis completo |
| 📱 **PWA premium** | Instalable en el móvil (Añadir a pantalla de inicio), service worker con modo offline, iconos maskable, diseño dark glassmorphism mobile-first |
| 🪙 **Logos originales** | 20 criptomonedas con SVG de marca **+ cualquier moneda que añadas con su logo original oficial de CoinGecko** |
| ➕ **Añade cualquier moneda** | Busca entre **+13.000 criptomonedas** (nombre o símbolo), añádelas a "Mis monedas" con persistencia local: precio en vivo, sparkline, velas e análisis del comité también para tus monedas |
| 📊 **Gráficos y análisis** | Velas japonesas SVG propias con volumen y medias móviles, RSI, MACD, ATR, Bollinger, soportes/resistencias |
| 🧠 **Memoria del agente** | Memoria episódica, semántica, preferencias y lecciones aprendidas — persistente y con decaimiento por recencia |
| 📚 **Base de conocimientos** | 8 artículos curados + glosario de 12 términos en español, integrados en el chat |
| 🧪 **Backtesting** | 4 estrategias (Cruce SMA, Momentum, RSI Reversión, Ruptura Donchian), comisiones + slippage, Sharpe/Sortino/PF/maxDD |
| 🧾 **Paper trading** | Cuenta simulada con $10.000, órdenes market con slippage, posiciones long/short con SL/TP automáticos |
| 🛡️ **Risk Engine** | Riesgo por operación, stop diario, drawdown máximo, exposición, R:R mínimo, guardia de volatilidad, recorte automático de tamaño |
| 🚨 **Kill Switch** | Corte de emergencia en 4 niveles con cierre total de posiciones y bloqueo del trading |
| 🔐 **Seguridad de API** | Vault con cifrado AES-256-GCM + scrypt, vista enmascarada, claves de retiro prohibidas |
| 🔄 **Router multi-modelo** | Cada tarea se enruta al modelo óptimo con cadena de fallback automática |
| ⚙️ **Exchange** | Binance spot en vivo (klines + ticker 24h), lectura de cuenta real firmada HMAC, arquitectura preparada para Bybit/OKX/Coinbase |

## 🚀 Puesta en marcha

```bash
# 1. Clona e instala
git clone https://github.com/TU_USUARIO/nexus-trader-ai.git
cd nexus-trader-ai
bun install        # o: npm install

# 2. Configura el entorno
cp .env.example .env   # edita NEXUS_MASTER_SECRET con un valor aleatorio

# 3. Base de datos
bun run db:push

# 4. Arranca
bun run dev          # http://localhost:3000
```

> Requisitos: Node 20+ o Bun 1.1+. Sin claves de exchange ni de LLM externas — el chat usa el SDK de Z.ai incluido.

## 📲 Instalar como app (móvil)

1. Abre la URL en Chrome/Safari del móvil.
2. Pulsa el botón ⬇️ flotante o **"Añadir a pantalla de inicio"**.
3. Úsala como app nativa, también offline (modo shell).

## 🗂️ Estructura

```
src/
├── app/
│   ├── page.tsx                 # App única (shell + vistas client-side)
│   └── api/                     # market · chat · agent/analyze · backtest ·
│                                # paper · risk · kill-switch · settings · knowledge
├── components/
│   ├── app-shell.tsx            # Header + bottom nav + router de vistas
│   ├── views/                   # dashboard (+ radar) · markets (+ añadir monedas) · agent ·
│   │                            # portfolio · backtest · risk · knowledge · settings
│   ├── charts/                  # candle-chart SVG · area-chart recharts
│   └── agents/                  # nexus-3d (avatar 3D interactivo R3F) · nexus-avatar ·
│                                # agent-avatar · especialistas
├── lib/
│   ├── agents/                  # base-agent · orchestrator · chat-service ·
│   │                            # radar (escáner de oportunidades + scoring)
│   ├── risk/                    # risk-engine · kill-switch
│   ├── trading/paper-engine.ts  # simulador de ejecución
│   ├── backtest/engine.ts       # motor de backtesting
│   ├── exchange/adapter.ts      # adaptador Binance (solo lectura)
│   ├── router/model-router.ts   # router multi-modelo con fallback
│   ├── memory/agent-memory.ts   # memoria persistente del agente
│   ├── knowledge/kb.ts          # base de conocimientos
│   ├── security/vault.ts        # vault AES-256-GCM
│   └── market/                  # monedas · datos (Binance + fallback demo)
│                                # · custom (CoinGecko: búsqueda, cotizaciones, velas,
│                                #   tendencias globales)
├── hooks/use-voice.ts           # Web Speech API (STT + TTS) sincronizada con el avatar
└── prisma/schema.prisma         # 12 modelos
docs/                            # ARQUITECTURA · ROADMAP · SEGURIDAD
CHANGELOG.md                     # historial de versiones
```

## 🧭 Cómo funciona el comité

```
Tú pides "Analiza BTC"
        │
        ▼
┌──────────────┐   velas 1h + ticker en vivo (Binance o demo)
│  ORQUESTADOR │──────────────┬──────────────────┐
└──────────────┘              ▼                  ▼
                     ┌──────────────┐   ┌──────────────┐
                     │ VEGA técnico │   │ SCOUT mercado│   ← deterministas
                     │ RSI·MACD·SMA │   │ momentum·vol │   (sin alucinaciones)
                     └──────┬───────┘   └──────┬───────┘
                            └────────┬─────────┘
                                     ▼
                            ┌──────────────┐
                            │ ATLAS estrat.│   ← LLM vía router
                            │ sintetiza    │     multi-modelo
                            └──────┬───────┘
                                   ▼
                            ┌──────────────┐   ¿aprueba la operación?
                            │ AEGIS riesgo │──► NO ──► se registra el motivo
                            └──────┬───────┘
                                   ▼ SÍ
                    Tarjeta de decisión con plan, stop y objetivo
```

## 🛣️ Del cero al trading real

Ver **[docs/ROADMAP.md](docs/ROADMAP.md)** — 6 fases: instalación → paper trading → validación estadística → testnet → micro-capital real → escalar. **La ejecución con dinero real está deshabilitada por diseño** hasta completar las fases de validación.

## 🔐 Seguridad

- Claves cifradas con **AES-256-GCM** (clave derivada con scrypt desde `NEXUS_MASTER_SECRET`).
- La API jamás devuelve una clave completa — solo la máscara `AbC4••••••••Xy9z`.
- **Prohibidas** las claves con permiso de retiro (validación server-side).
- Kill Switch y Risk Engine como defensa en profundidad. Más en [docs/SEGURIDAD.md](docs/SEGURIDAD.md).

## ⚠️ Aviso legal

Este software es una herramienta educativa y de simulación. **No es asesoramiento financiero.** El trading de criptomonedas implica riesgo de pérdida total del capital. Usa el modo paper hasta completar el roadmap y nunca inviertas dinero que no puedas perder.

## 📄 Licencia

MIT — úsalo, modifícalo y compártelo.

## NEXUS 2.1 — Market Memory + Trade Journal

This release adds two local-first deterministic services:

- `src/services/market-memory.ts` — stores market situations and finds similar historical contexts using symbol/timeframe/regime/tags/features.
- `src/services/trade-journal.ts` — stores structured decisions, agent votes, risk/context and eventual outcomes.

The services use browser `localStorage` and do not require an external database or LLM.
They are deliberately isolated so the existing NEXUS UI and agent architecture can adopt them incrementally.

Recommended integration flow:

`market snapshot → agents → decision → tradeJournal.create() → marketMemory.add() → outcome → updateOutcome()/journal.close()`
