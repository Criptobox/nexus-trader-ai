# 🛣️ Roadmap — Del cero al trading real

> Filosofía: **primero demostrar que no pierdes dinero, después arriesgar el mínimo.**
> Cada fase tiene criterios de salida objetivos. No te saltes fases.

---

## Fase 0 — Instalación y exploración (hoy)

- [ ] Clonar el repo, `bun install`, `db:push`, `bun run dev`.
- [ ] Instalar la PWA en tu móvil.
- [ ] Explorar las 9 pantallas y conversar con el comité.
- [ ] Leer la base de conocimientos (8 artículos) si empiezas desde cero.

**Criterio de salida:** entiendes qué hace cada módulo y la app corre en tu dispositivo.

## Fase 1 — Modo demo y familiarización (semana 1)

- [ ] Verifica que el badge dice `BINANCE LIVE` (con internet) o `MODO DEMO` (sin él).
- [ ] Lanza 10 análisis multiagente de monedas distintas y compara veredictos con la realidad.
- [ ] Configura el Risk Engine con valores conservadores (1% por operación, 4% stop diario).
- [ ] Activa el Kill Switch una vez y comprueba que bloquea todo.

**Criterio de salida:** sabes interpretar la tarjeta de decisión y los indicadores.

## Fase 2 — Paper trading activo (semanas 2–6)

- [ ] Opera manualmente con el ticket paper: mínimo 30 operaciones.
- [ ] Usa el análisis del comité para al menos la mitad de las entradas.
- [ ] Revisa cada día el log de eventos de riesgo.
- [ ] No reinicies la cuenta — la curva de equity es tu expediente.

**Criterio de salida:** ≥ 30 operaciones cerradas y **win rate + profit factor registrados**. El sistema de memoria habrá aprendido tus patrones.

## Fase 3 — Validación estadística (semanas 4–8, en paralelo)

- [ ] Backtestea las 4 estrategias en 3 temporalidades × 5 monedas (60 corridas).
- [ ] Queda solo con estrategias con: Sharpe > 1 · profit factor > 1,3 · maxDD < 20% · > 100 trades simulados.
- [ ] Compara el backtest con tus resultados paper reales: si divergen mucho, tu ejecución tiene sesgos.
- [ ] Documenta en un cuaderno qué filtros añadirías (volumen, sesión, eventos).

**Criterio de salida:** una estrategia validada fuera de muestra y coherente entre backtest y paper.

## Fase 4 — Testnet / micro-capital (mes 3+)

⚠️ *Aquí es donde se habilita la ejecución real. Hazlo solo si superaste las fases 2–3.*

- [ ] Clave API nueva con permiso de **trading** (nunca retiros), restringida por IP.
- [ ] Implementa el adaptador de ejecución en `exchange/adapter.ts` (la interfaz ya existe).
- [ ] Empieza en **testnet de Binance** (dinero falso pero ejecución real con latencia real).
- [ ] Primer capital real: **el 5–10% del paper**, máximo el dinero que puedas quemar sin dolor.
- [ ] Añade confirmación humana en la UI para cada orden real ( patrón "human-in-the-loop").

**Criterio de salida:** 50+ operaciones reales con slippage y comisiones reales documentados, sin sobrepasar el drawdown máximo.

## Fase 5 — Escalar con disciplina (mes 4+)

- [ ] Escala capital solo en tramos de +25–50% **cada mes sin violar límites de riesgo**.
- [ ] Añade más pares/marcos cuando el sistema sea estable (no antes).
- [ ] Automatiza el scheduler: análisis cada hora + paper→real según señal (cron job del roadmap técnico).
- [ ] Revisa mensualmente la memoria del agente y purga lecciones obsoletas.
- [ ] Monitoriza el sistema con alertas (Telegram/Discord webhook) para cada evento `critical`.

**Criterio de salida:** un sistema que gana poco pero **de forma aburrida y constante** — ese es el objetivo.

---

## Trampas que matan proyectos como este

1. **Saltarse a real demasiado pronto** — el 90% quiebra aquí. Las fases 2–3 existen por algo.
2. **Sobreoptimizar el backtest** — 7 parámetros perfectos en el pasado = desastre en el futuro.
3. **Aumentar el riesgo tras rachas ganadoras** — el Risk Engine existe para impedirlo.
4. **Desactivar el Kill Switch "temporalmente"** — no lo hagas.
5. **Meter claves con permiso de retiro** — jamás, ni en testnet.

## Ideas de evolución técnica

- WebSockets para precios en tiempo real (mini-service propio ya soportado).
- Cola de trabajos para backtests largos (BullMQ + Redis).
- Embeddings vectoriales para la memoria (sqlite-vss) en vez de scoring simple.
- Multi-usuario con NextAuth (el paquete ya está incluido).
- Notificaciones push PWA para señales y eventos de riesgo.
