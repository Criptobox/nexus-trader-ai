# 🏗️ Arquitectura Técnica — NEXUS Trader AI

## Visión general

NEXUS es una **aplicación Next.js 16 full-stack** monolito (App Router) con base de datos SQLite vía Prisma. Todo corre en un único proceso: el frontend PWA y las rutas API del backend. El LLM se consume en el servidor a través del SDK de Z.ai (nunca en el cliente).

```
┌────────────────────────────────────────────────────────────────┐
│                        CLIENTE (PWA)                          │
│  App Shell (client-side views) ─ Zustand ─ Web Speech API     │
│  Bottom nav ─ Charts SVG/Recharts ─ Service Worker            │
└───────────────┬────────────────────────────────────────────────┘
                │ fetch (JSON, rutas relativas)
┌───────────────▼────────────────────────────────────────────────┐
│                    NEXT.JS API ROUTES                          │
│  /api/market   /api/chat   /api/agent/analyze  /api/paper      │
│  /api/risk     /api/kill-switch  /api/settings  /api/backtest  │
│  /api/knowledge                                                │
└───┬──────────────┬───────────────┬──────────────────┬──────────┘
    │              │               │                  │
┌───▼────┐   ┌─────▼─────┐   ┌─────▼─────┐    ┌───────▼──────┐
│ market │   │  agents   │   │  trading  │    │    risk      │
│ data   │   │ (comité)  │   │  paper    │    │ risk-engine  │
│ Binance│   │ router LLM│   │  engine   │    │ kill-switch  │
│ + demo │   │  memoria  │   │           │    │              │
└───┬────┘   └─────┬─────┘   └─────┬─────┘    └───────┬──────┘
    │              │               │                  │
    └──────────────┴───────┬───────┴──────────────────┘
                           ▼
                  ┌─────────────────┐
                  │  PRISMA/SQLite  │  12 modelos (ver schema)
                  └─────────────────┘
```

## Capas y responsabilidades

### 1. Presentación (`src/components`, `src/app/page.tsx`)
- **App Shell único**: la app es una sola página que cambia de vista con Zustand (`useAppStore.view`). Ventajas: navegación instantánea estilo app nativa, sin recargas, estado compartido simple.
- **Diseño**: dark premium con glassmorphism (`.glass`, `.glass-strong`), acentos emerald (`--bull`), rojo (`--bear`) y oro (`--gold`). Mobile-first con `max-w-md` y navegación inferior con FAB central.
- **Gráficos**: velas japonesas SVG propias (`candle-chart.tsx`) para control total del rendering + Recharts para curvas de equity.

### 2. API Routes (`src/app/api`)
Finas y sin lógica de negocio: validan entrada, delegan en `src/lib`, devuelven JSON. Todas `force-dynamic` para datos frescos.

### 3. Dominio (`src/lib`)

#### Sistema multiagente (`agents/`)
- `base-agent.ts`: define `AGENT_PROFILES` (identidad, avatar, prompt de sistema de cada especialista).
- `orchestrator.ts` — pipeline de análisis:
  1. Descarga velas y cotizaciones (capa de mercado).
  2. **Vega** y **Scout** producen opiniones **deterministas** a partir de indicadores (reproducibles, sin coste de LLM, sin alucinaciones).
  3. **Atlas** sintetiza con LLM vía router (entrada, stop 2×ATR, objetivo, invalidación). Si el LLM falla → síntesis determinista de respaldo.
  4. **Aegis** valida con el Risk Engine.
  5. Se persiste la decisión (`AgentDecision`) y se aprende en memoria.
- `chat-service.ts`: chat conversacional con detección de intención (precios/técnico/portafolio/educación), inyección de contexto de mercado real, memoria y KB; historial persistente en `Conversation`/`Message`.

#### Router multi-modelo (`router/model-router.ts`)
- Perfiles por tarea (`chat` → modelo rápido, `analysis` → balanceado, `summary` → profundo).
- Cadena de **fallback**: si un perfil falla prueba el siguiente y, al final, el modelo por defecto del SDK.
- Extensible a proveedores OpenAI-compatibles (`NEXUS_OPENAI_BASE_URL` + `NEXUS_OPENAI_API_KEY`).

#### Riesgo (`risk/`)
- `risk-engine.ts` — valida cada entrada: Kill Switch activo → stop diario → nº de posiciones → exposición → R:R mínimo → guardia de volatilidad (ATR% > 6). El tamaño de posición se **recorta** (no se rechaza) para respetar el riesgo por operación: `qty = (capital × riesgo%) / distanciaStop`.
- `kill-switch.ts` — niveles `soft_stop` (pérdida diaria, racha de pérdidas) y `full_stop` (drawdown global, manual). El disparador manual solo se desactiva a mano; los automáticos se re-evalúan en cada evento. El full stop cierra todas las posiciones paper.

#### Paper trading (`trading/paper-engine.ts`)
- Órdenes market con slippage (0,05%) y comisión (0,1%), posiciones long/short, SL/TP revisados con cada lectura de precio, PnL realizado y curva de equity.
- Toda orden pasa por el Risk Engine salvo cierres.

#### Backtesting (`backtest/engine.ts`)
- 4 estrategias de señales puras; gestión por riesgo fijo con stop/take en múltiplos de ATR; comisión + slippage en cada operación; métricas: CAGR, Sharpe, Sortino, profit factor, win rate, maxDD, exposición.

#### Memoria (`memory/agent-memory.ts`)
- Tipos: `episodic` (qué pasó), `semantic` (hechos), `preference` (gustos del usuario), `lesson` (resultado de operaciones).
- Recuperación por relevancia = coincidencia + importancia + recencia (decaimiento exponencial ~2 semanas).

#### Seguridad (`security/vault.ts`)
- AES-256-GCM con clave derivada por **scrypt** (N=16384) desde `NEXUS_MASTER_SECRET` + salt aleatorio por clave. IV y authTag almacenados por registro.

#### Mercado (`market/`)
- `data.ts`: Binance público (klines, ticker 24h) con caché en memoria (30–60 s) y **fallback determinista** (random walk con semilla) para funcionar sin internet — el flag `source` indica `binance` o `demo` en toda la UI.
- `custom.ts`: **monedas personalizadas vía CoinGecko API pública** (sin clave). Búsqueda (`/search`), cotizaciones con logo original (`/coins/markets`) y velas OHLC sintetizadas desde `market_chart` según el intervalo. Incluye reintentos con backoff ante 429, caché TTL y caché "stale" como último recurso. Prioridad de datos para velas: **Binance (si el par existe) → CoinGecko → demo**.

#### Avatar 3D interactivo (`components/agents/nexus-3d-scene.tsx` + `nexus-3d.tsx`)
- Desde v2.0.0, NEXUS es un **compañero vivo en 3D** construido proceduralmente con Three.js + React Three Fiber (sin assets GLB): orbe de cromo (`MeshPhysicalMaterial` con clearcoat), placa facial de cristal, ojos-cápsula emisivos, boca-barra ecualizadora, gema crestal, 3 anillos giroscópicos con cuentas luminosas, 30 partículas orbitales en elipses inclinadas y halo de energía en el suelo.
- **Interactividad**: ojos y cabeza siguen el puntero de toda la ventana (lerp con decaimiento exponencial); si no hay actividad, la mirada deambula sola ("vida propia"); tap → giro celebratorio con decaimiento + ojos felices; parpadeo con ritmo natural (2,6-5,8 s aleatorio).
- **Estados** (`idle | listening | thinking | speaking | happy | alert`): cada uno ajusta color (lerp suave de materiales), velocidad de anillos/partículas, forma de ojos, amplitud de la boca (waveform pseudo-voz al hablar) y luz de ánimo de las rim-lights. Post-procesado con **Bloom + Vignette**; entorno procedural con `Lightformer` (reflejos del cromo sin descargar HDR).
- Rendimiento: carga diferida con `next/dynamic` (`ssr: false`), fallback 2D animado mientras carga, `dpr` limitado a 1,8 y geometrías de bajo coste. El wrapper `nexus-3d.tsx` exporta `NexusAvatar3D` con estados extendidos `happy` y `alert`.
- El avatar 2D CSS (`nexus-avatar.tsx`) sigue usándose en contextos pequeños (header, chips, barra de estado) donde un canvas no compensa.

#### Radar de Oportunidades (`lib/agents/radar.ts` + `api/opportunities`)
- Escaneo paralelo: cotizaciones base (Binance/demo) + **tendencias globales CoinGecko** (`/search/trending`, caché 10 min) + monedas custom del usuario. Para tendencias fuera del universo base se piden cotizaciones **sin sparkline** (respuesta ligera, más resistente al rate limit).
- Scoring 0-100: momentum 24h (32%), tendencia 7d (24%), volumen relativo (18%), fuerza vs máximo 24h (14%), baja volatilidad (12%), + calor de tendencias y bonificación de majors; **descuento por incertidumbre** (riesgo alto ×0,86, medio ×0,95).
- Clasificación EMERGENTE/IMPULSO/TENDENCIA/REVERSIÓN/ESTABLE → riesgo y acción (ZONA DE INTERÉS/VIGILAR/OBSERVAR/EVITAR) con **tesis narrada en español** con los números reales del escaneo. El dashboard lo presenta con el avatar 3D (estado `happy` si hay zona de interés) y handoff al chat con `cgId` para el análisis del comité.

#### Avatar del agente — legado (`components/agents/nexus-avatar.tsx`)
- Rostro de NEXUS generado con IA (`public/img/nexus-avatar.png`) con 4 estados animados en CSS puro: `idle` (respiración + anillo orbital lento), `listening` (anillos sónicos), `thinking` (partículas orbitando + giro rápido) y `speaking` (ecualizador + halo pulsante).
- El estado se deriva en `agent-view.tsx` de los flags del hook de voz (`listening`, `speaking`) y del envío (`sending`), de modo que el avatar "vive" con la conversación. Los iconos PWA se generan desde la misma imagen (`scripts/gen-icons.mjs`).

### 4. Datos (`prisma/schema.prisma`)
12 modelos: `Setting`, `VaultKey`, `Conversation`, `Message`, `AgentMemory`, `PaperAccount`, `PaperPosition`, `PaperOrder`, `RiskConfig`, `RiskEvent`, `KillSwitchState`, `BacktestRun`, `AgentDecision`. Los campos JSON se serializan como String (SQLite).

## Decisiones de diseño clave

| Decisión | Razón |
|---|---|
| Opiniones técnicas deterministas | Reproducibles, gratis, instantáneas; el LLM solo sintetiza |
| Monolito Next.js | Un solo deploy, cero infra extra, ideal para GitHub |
| SQLite + Prisma | Cero configuración, perfecta para self-hosted; migrable a Postgres cambiando el datasource |
| Fallback demo de mercado | La app nunca se rompe sin internet; útil para demos |
| Avatar 3D procedural (sin GLB) | Cero assets binarios que mantener, peso mínimo en el repo, animaciones 100% parametrizables por estado |
| CoinGecko para monedas custom | Permite añadir +13.000 monedas sin claves ni coste; Binance sigue siendo la fuente primaria cuando existe el par |
| Avatar 2D CSS en contextos pequeños | Cero coste de canvas en header/chips; el 3D se reserva para los héroes de agente y radar |
| Ejecución real deshabilitada | Seguridad por diseño: el paso a real es una fase consciente del roadmap |
| Vistas client-side en una página | Comportamiento de app nativa en la PWA |

## Extender el sistema

- **Nuevo agente**: añade su `AgentProfile` en `base-agent.ts` y su opinión en `orchestrator.ts`.
- **Nueva estrategia de backtest**: agrega la función de señales en `engine.ts` y regístrala en `signalsFor` y `STRATEGY_INFO`.
- **Nuevo exchange**: implementa `ExchangeAdapter` en `exchange/adapter.ts`.
- **Nuevo modelo**: añade un `RouterProfile` (Z.ai u OpenAI-compatible) en Ajustes.
