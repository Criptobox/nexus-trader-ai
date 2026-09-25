// ─────────────────────────────────────────────────────────────
// Base de conocimientos — artículos curados en español
// sirve al agente educador y al buscador de la app
// ─────────────────────────────────────────────────────────────

export interface KBArticle {
  id: string
  title: string
  category: 'fundamentos' | 'analisis-tecnico' | 'gestion-riesgo' | 'psicologia' | 'estrategias' | 'seguridad'
  level: 'principiante' | 'intermedio' | 'avanzado'
  summary: string
  content: string
  tags: string[]
}

export const KB_ARTICLES: KBArticle[] = [
  {
    id: 'kb-001',
    title: 'Análisis técnico: velas japonesas y estructura de mercado',
    category: 'analisis-tecnico',
    level: 'principiante',
    summary: 'Cómo leer velas, soportes, resistencias y tendencias para contextualizar cualquier operación.',
    content: `Cada vela japonesa resume cuatro datos de un periodo: apertura, cierre, máximo y mínimo. El cuerpo muestra la fuerza de la dirección; las mechas, el rechazo de precios. Una vela verde con cuerpo grande indica compra agresiva; una vela con mecha inferior larga sugiere que los vendedores presionaron pero los compradores defendieron.

La estructura de mercado se construye con máximos y mínimos. Una tendencia alcista saludable imprime máximos y mínimos progresivamente más altos; una tendencia bajista, máximos y mínimos más bajos. Las zonas donde el precio se giró varias veces se convierten en soportes (debajo) y resistencias (encima): no son líneas exactas sino zonas donde hay órdenes acumuladas.

Reglas prácticas del sistema NEXUS:
1. Opera a favor de la tendencia del gráfico de temporalidad superior (4h/1d).
2. Marca zonas (no líneas) de soporte y resistencia con al menos 3 toques.
3. El volumen confirma: rupturas sin volumen suelen fallar.
4. El ATR mide la volatilidad real — úsalo para colocar stops, no valores fijos.`,
    tags: ['velas', 'soportes', 'resistencias', 'tendencia', 'atr'],
  },
  {
    id: 'kb-002',
    title: 'RSI, MACD y medias móviles: los tres pilares del momentum',
    category: 'analisis-tecnico',
    level: 'principiante',
    summary: 'Qué miden exactamente los indicadores clásicos y cómo combinarlos sin sobreoptimizar.',
    content: `El RSI (Índice de Fuerza Relativa) compara la magnitud de las subidas y bajadas recientes en una escala de 0 a 100. Por encima de 70 el activo está sobrecomprado; por debajo de 30, sobrevendido. Pero en tendencias fuertes el RSI puede permanecer extremo durante mucho tiempo: en una tendencia alcista el RSI rara vez cae bajo 40.

El MACD mide la relación entre dos medias exponenciales (12 y 26 por defecto). Cuando la línea MACD cruza por encima de su señal hay aceleración alcista; el histograma (MACD − señal) muestra si la fuerza crece o decrece. Las divergencias —precio marca nuevo máximo pero el MACD no— anticipan agotamiento.

Las medias móviles (SMA/EMA) filtran el ruido y definen la tendencia: 20 para el corto plazo, 50 para el medio, 200 para el régimen general. El cruce dorado (50 cruza sobre 200) marca cambio de régimen alcista; el cruce de la muerte, lo contrario.

El sistema multiagente de NEXUS exige confluencia: nunca opera con un solo indicador. El agente técnico busca al menos dos señales alineadas antes de proponer una entrada.`,
    tags: ['rsi', 'macd', 'medias moviles', 'momentum', 'divergencias'],
  },
  {
    id: 'kb-003',
    title: 'Gestión de riesgo: la única ventaja que controlas al 100%',
    category: 'gestion-riesgo',
    level: 'principiante',
    summary: 'Tamaño de posición, ratio riesgo/beneficio y por qué sobrevivir es la primera estrategia.',
    content: `Ninguna estrategia gana siempre. Lo que separa a los traders que perduran de los que quiebran no es la puntería sino el tamaño de sus pérdidas. La regla cardinal: nunca arriesgar más del 1–2% del capital en una sola operación. Con 2% de riesgo necesitas 10 pérdidas consecutivas para perder el 18% del capital; arriesgando 10%, bastan 7 para perder más de la mitad.

El tamaño de posición se calcula así:
  Tamaño = (Capital × % Riesgo) / (Precio entrada − Stop)
Si tienes 10.000 USDT, arriesgas 1% (100 USDT) y tu stop está 4% bajo la entrada, compras 2.500 USDT del activo.

El ratio riesgo/beneficio (R:R) debe ser mínimo 1,5:1. Con R:R de 2 y un 40% de acierto eres rentable: 10 operaciones → 4 ganancias (+8R) y 6 pérdidas (−6R) = +2R neto.

El Risk Engine de NEXUS aplica estas reglas automáticamente: rechaza operaciones cuyo tamaño exceda el riesgo configurado, valida la exposición total del portafolio y detiene la actividad si la pérdida diaria supera el límite. La curva de equity y el drawdown máximo son el expediente real de tu sistema.`,
    tags: ['riesgo', 'tamaño de posicion', 'rr', 'drawdown', 'survivorship'],
  },
  {
    id: 'kb-004',
    title: 'Psicología del trading: sesgos que el agente neutraliza por ti',
    category: 'psicologia',
    level: 'intermedio',
    summary: 'FOMO, aversión a la pérdida, promedio a la baja: cómo el sistema impone disciplina.',
    content: `El cerebro humano está mal diseñado para los mercados. La aversión a la pérdida hace que doler una pérdida duplique el malestar de un beneficio equivalente, empujando a cerrar ganancias pronto y mantener pérdidas "esperando que vuelva". El FOMO (miedo a perderse la oportunidad) provoca entradas tardías en velas de euforia, justo donde el riesgo es máximo. El sesgo de confirmación hace que busquemos señales que apoyen nuestra posición e ignoremos las contrarias.

El promedio a la baja —añadir a una posición perdedora para "bajar el precio medio"— convierte una pérdida controlada en una apuesta desesperada. Es el sesgo más destructivo del trading retail.

NEXUS ataca estos sesgos con arquitectura, no con fuerza de voluntad:
· Las decisiones nacen de un comité de agentes, no de una emoción.
· El Risk Engine rechaza operativas que violen los límites aunque el usuario lo pida (si activa el candado estricto).
· El Kill Switch corta todo ante pérdidas diarias o drawdowns anómalos.
· La memoria del agente registra cada operación y sus aprendizajes, creando un expediente objetivo de tu comportamiento.`,
    tags: ['psicologia', 'fomo', 'sesgos', 'disciplina'],
  },
  {
    id: 'kb-005',
    title: 'Backtesting honesto: cómo no engañarte con tus propios datos',
    category: 'estrategias',
    level: 'intermedio',
    summary: 'Sobreoptimización, look-ahead bias, costes y por qué el paper trading valida antes del real.',
    content: `Un backtest es una simulación histórica de tu estrategia. Hecho bien, te dice si la idea tiene esperanza matemática positiva. Hecho mal, te vende un espejismo. Los errores clásicos:

1. Sobreoptimización (curve fitting): ajustar parámetros hasta que la curva sea perfecta en el pasado. Si tu estrategia necesita 7 parámetros exactos para funcionar, no funcionará fuera de muestra. Regla: menos parámetros, más robustez.
2. Look-ahead bias: usar información que en el momento real no existía (por ejemplo, el cierre de la vela actual para decidir dentro de esa misma vela).
3. Ignorar costes: comisiones (0,1% por lado en Binance spot) y slippage comen estrategias de alta frecuencia. El motor de NEXUS aplica comisión configurable y slippage estimado en cada operación.
4. Tamaño de muestra insuficiente: menos de 100 operaciones no dice nada estadísticamente.

Métricas que importan: Sharpe > 1 (riesgo ajustado), profit factor > 1,3, drawdown máximo que puedas soportar psicológicamente, y consistencia entre ventanas temporales.

Después del backtest viene el paper trading: al menos 4–8 semanas en tiempo real sin dinero. Solo cuando la ejecución paper replica el backtest tiene sentido considerar capital real — y siempre empezando por montos que puedas perder.`,
    tags: ['backtesting', 'paper trading', 'sharpe', 'estadistica'],
  },
  {
    id: 'kb-006',
    title: 'Seguridad de claves API: cómo no regalar tu exchange',
    category: 'seguridad',
    level: 'principiante',
    summary: 'Reglas de oro para crear, almacenar y rotar claves de exchange sin exponer tus fondos.',
    content: `Las claves API de un exchange son el equivalente a las llaves de tu caja fuerte. Tres reglas no negociables:

1. Mínimo privilegio: crea claves SOLO con permiso de lectura si el objetivo es analizar tu cuenta. Habilita trading solo cuando sea imprescindible. NUNCA habilites retiros (withdraw) en una clave usada por software.
2. Restricción por IP: la mayoría de exchanges permiten limitar la clave a direcciones IP concretas. Si tu servidor tiene IP fija, úsalo.
3. Nunca en el código: una clave en el código fuente de un repositorio GitHub público se compromete en minutos (los bots escanean GitHub continuamente).

NEXUS protege las claves con tres capas:
· Cifrado AES-256-GCM con clave derivada por scrypt desde NEXUS_MASTER_SECRET (variable de entorno, nunca en el repo).
· La base de datos guarda solo el texto cifrado: robar el archivo .db no expone las claves.
· La API jamás devuelve la clave completa al frontend — solo la vista enmascarada (primeros y últimos 4 caracteres).

Rotación recomendada: cada 90 días, o inmediatamente si un dispositivo con acceso se pierde o se compromete. El Kill Switch es tu último recurso: corta la actividad del agente al instante sin tocar el exchange.`,
    tags: ['seguridad', 'api keys', 'aes', 'privilegios', 'rotacion'],
  },
  {
    id: 'kb-007',
    title: 'Tokenomics y liquidity: qué hace segura a una criptomoneda',
    category: 'fundamentos',
    level: 'principiante',
    summary: 'Supply, capitalización, volumen y liquidez: los filtros previos a cualquier análisis técnico.',
    content: `Antes de analizar un gráfico conviene entender qué hay detrás del token. La capitalización de mercado (precio × supply circulante) mide el tamaño real del proyecto: un token de 50 millones es 100 veces más volátil y manipulable que uno de 50.000 millones. El supply total y máximo importan: la inflación futura (emisiones, desbloqueos) diluye el precio.

La liquidez —cuánto se puede comprar/vender sin mover el precio— es el filtro de supervivencia. Un activo con 200.000 USDT de volumen diario permite a un agente entrar y salir con spread mínimo; uno con 5.000 convierte cada operación en slippage. NEXUS solo opera pares con volumen de 24h suficiente para absorber el tamaño de posición sin impacto.

El volumen también valida: subidas con volumen creciente son tendencias; subidas con volumen decreciente son trampas. Los agentes scout y técnico cruzan precio-volumen continuamente para detectar divergencias de liquidez antes de proponer cualquier entrada.`,
    tags: ['tokenomics', 'liquidez', 'volumen', 'capitalizacion'],
  },
  {
    id: 'kb-008',
    title: 'Kill Switch y límites automáticos: defensa en profundidad',
    category: 'gestion-riesgo',
    level: 'avanzado',
    summary: 'Arquitectura de los cortes de emergencia: niveles, disparadores y política de reactivación.',
    content: `El Kill Switch es el mecanismo de último recurso que detiene toda actividad de trading de forma inmediata e irreversible por el usuario. Su diseño sigue el principio de defensa en profundidad: varios anillos de protección que actúan antes de llegar al desastre.

Nivel 1 — Límites por operación: el Risk Engine valida tamaño, exposición y R:R antes de cada orden. Rechaza y registra el motivo.
Nivel 2 — Stop diario: si las pérdidas realizadas del día superan el máximo configurado (por defecto 4%), se activa soft_stop: no se abren posiciones nuevas hasta el siguiente día. Las existentes mantienen sus stops.
Nivel 3 — Drawdown global: si la curva de equity cae más del máximo permitido desde su pico (por defecto 12%), se activa full_stop: se cierra toda posición y el sistema queda congelado.
Nivel 4 — Kill Switch manual: el botón rojo. Corta todo, marca la razón y requiere reactivación explícita.

La política de reactivación es deliberadamente friccionada: tras un full_stop automático, el sistema exige revisar el informe de eventos y reactivar manualmente. No hay auto-reactivación tras drawdowns severos — la disciplina post-pérdida es donde la mayoría quiebra.`,
    tags: ['kill switch', 'defensa', 'drawdown', 'stop diario'],
  },
]

export function searchKB(query: string): KBArticle[] {
  const q = query.toLowerCase().trim()
  if (!q) return KB_ARTICLES
  return KB_ARTICLES.filter((a) =>
    a.title.toLowerCase().includes(q) ||
    a.summary.toLowerCase().includes(q) ||
    a.content.toLowerCase().includes(q) ||
    a.tags.some((t) => t.includes(q)),
  )
}

export function kbContextForQuery(query: string): string {
  const results = searchKB(query).slice(0, 2)
  if (!results.length) return ''
  return results.map((a) => `📚 ${a.title}:\n${a.content}`).join('\n\n')
}

export const KB_GLOSSARY: { term: string; def: string }[] = [
  { term: 'ATR', def: 'Average True Range — volatilidad media real por vela. Se usa para dimensionar stops.' },
  { term: 'Backtesting', def: 'Simular una estrategia sobre datos históricos para medir su esperanza matemática.' },
  { term: 'Drawdown', def: 'Caída porcentual desde el pico máximo de la curva de equity hasta el mínimo posterior.' },
  { term: 'FOMO', def: 'Fear Of Missing Out — entrar por miedo a perderse una subida, normalmente tarde y caro.' },
  { term: 'Kill Switch', def: 'Corte de emergencia que detiene toda actividad de trading del sistema al instante.' },
  { term: 'Liquidez', def: 'Facilidad de comprar/vender sin mover el precio. Depende del volumen y el order book.' },
  { term: 'Paper Trading', def: 'Operar con dinero simulado en tiempo real para validar la ejecución sin riesgo.' },
  { term: 'Profit Factor', def: 'Ganancia total ÷ pérdida total. Por encima de 1,3 se considera robusto.' },
  { term: 'R:R', def: 'Ratio riesgo/beneficio: lo que arriesgas (entrada→stop) contra lo que buscas (entrada→objetivo).' },
  { term: 'Sharpe', def: 'Retorno ajustado por riesgo. Mide cuánto retorno obtienes por unidad de volatilidad.' },
  { term: 'Slippage', def: 'Diferencia entre el precio esperado y el precio real de ejecución.' },
  { term: 'Stop Loss', def: 'Orden automática que cierra la posición si el precio alcanza tu nivel máximo de pérdida.' },
]
