import type { WritingTaskType } from '../types';

export interface WritingPromptMeta {
  id: string;
  title: string;
  prompt: string;
  mode: '5min' | '10min' | '20min';
  cefrLevel: 'B1' | 'B2' | 'C1';
  genre: string;
  wordTarget: string;
  wordMin: number;
  wordMax: number;
  taskType: WritingTaskType;
  requiredElements?: string[];
  exampleAnswer?: string;
  tip: string;
}

export interface SpeakingPromptMeta {
  id: string;
  title: string;
  prompt: string;
  mode: '30s' | '60s' | '2min';
  cefrLevel: 'B1' | 'B2' | 'C1';
  topic: string;
  planningSeconds: number;
  tip: string;
}

export const writingPrompts: WritingPromptMeta[] = [
  {
    id: 'wp-01',
    title: 'Correo formal de reclamación',
    prompt: 'Escribe un correo formal de reclamación a una empresa de transporte. Tu pedido llegó dañado y con una semana de retraso. Pide una explicación y una solución.',
    mode: '5min',
    cefrLevel: 'B2',
    genre: 'correo formal',
    wordTarget: '80–100 palabras',
    wordMin: 80,
    wordMax: 100,
    taskType: 'formal_email',
    requiredElements: [
      'formal salutation (estimados/distinguidos)',
      'reason for complaint (retraso/dañado/problema)',
      'explanation request (explicación/aclaración/razón)',
      'proposed solution (solución/reembolso/sustitución)',
      'formal closing (atentamente/cordialmente)',
    ],
    tip: 'Usa fórmulas como "Me dirijo a ustedes para...", "Les comunico que...", "Quedo a la espera de..."',
  },
  {
    id: 'wp-02',
    title: 'Resumen de un artículo',
    prompt: 'Escribe un resumen objetivo de 80–100 palabras del siguiente argumento: "El teletrabajo ha aumentado la productividad pero ha dificultado la separación entre vida laboral y personal."',
    mode: '5min',
    cefrLevel: 'B2',
    genre: 'resumen',
    wordTarget: '80–100 palabras',
    wordMin: 80,
    wordMax: 100,
    taskType: 'summary',
    tip: 'No incluyas tu opinión personal. Usa el presente para describir el argumento general.',
  },
  {
    id: 'wp-03',
    title: 'Opinión sobre el sistema educativo',
    prompt: 'Escribe un párrafo de opinión (100–130 palabras) sobre si el sistema educativo actual prepara bien a los jóvenes para el mercado laboral. Incluye tu postura, dos argumentos y una conclusión.',
    mode: '10min',
    cefrLevel: 'B2',
    genre: 'párrafo de opinión',
    wordTarget: '100–130 palabras',
    wordMin: 100,
    wordMax: 130,
    taskType: 'opinion',
    requiredElements: [
      'clear position (considero/a mi juicio/creo que)',
      'two arguments (en primer lugar/además/por otra parte)',
      'conclusion (por todo ello/en suma/por consiguiente)',
    ],
    tip: 'Estructura: tesis → argumento 1 → argumento 2 → conclusión. Usa conectores como "en primer lugar", "además", "por todo ello".',
  },
  {
    id: 'wp-04',
    title: 'Carta de motivación profesional',
    prompt: 'Escribe una carta de motivación breve (100–130 palabras) para una posición de analista de datos en una empresa de tecnología. Destaca tu formación, experiencia relevante y motivación.',
    mode: '10min',
    cefrLevel: 'B2',
    genre: 'carta formal',
    wordTarget: '100–130 palabras',
    wordMin: 100,
    wordMax: 130,
    taskType: 'formal_email',
    requiredElements: [
      'formal salutation (estimados/distinguidos)',
      'your background (formación/estudios/experiencia)',
      'relevant skills (analítica/datos/conocimientos)',
      'motivation (interés/motivación/oportunidad)',
      'formal closing (atentamente/cordialmente)',
    ],
    tip: 'Usa el subjuntivo cuando sea apropiado: "Confío en que mi perfil responda a sus expectativas".',
  },
  {
    id: 'wp-05',
    title: 'Artículo de opinión — cambio climático',
    prompt: 'Escribe un artículo de opinión (180–220 palabras) sobre la responsabilidad individual frente al cambio climático. Defiende una postura matizada: reconoce la responsabilidad individual pero argumenta que las políticas estructurales son más determinantes.',
    mode: '20min',
    cefrLevel: 'C1',
    genre: 'artículo de opinión',
    wordTarget: '180–220 palabras',
    wordMin: 180,
    wordMax: 220,
    taskType: 'argumentative',
    requiredElements: [
      'concession (si bien/aunque/a pesar de)',
      'main argument (porque/ya que/debido a)',
      'reference to individual responsibility (individual/personal/ciudadano)',
      'reference to policy or structural factors (políticas/estructural/gobierno)',
      'conclusion (en suma/por ello/de ahí que)',
    ],
    tip: 'Usa estructuras concesivas: "Si bien es cierto que... no obstante...", "A pesar de que... de ahí que..."',
  },
  {
    id: 'wp-06',
    title: 'Informe sobre encuesta laboral',
    prompt: 'Basándote en estos datos: 72% satisfecho con el teletrabajo, 54% echa de menos el contacto social, 38% tiene dificultades con la concentración en casa. Escribe un informe breve (100–130 palabras) dirigido a la dirección de una empresa.',
    mode: '10min',
    cefrLevel: 'B2',
    genre: 'informe',
    wordTarget: '100–130 palabras',
    wordMin: 100,
    wordMax: 130,
    taskType: 'report',
    requiredElements: [
      'reference to satisfaction figure (72/satisfecho/satisfacción)',
      'reference to social contact issue (54/contacto/social)',
      'reference to concentration issue (38/concentración/dificultades)',
      'recommendation (se recomienda/conviene/se sugiere)',
    ],
    tip: 'Los informes son objetivos: "Los datos revelan que...", "Se observa que...", "En vista de los resultados..."',
  },
  {
    id: 'wp-07',
    title: 'Reseña de un libro',
    prompt: 'Escribe una reseña breve (100–130 palabras) de un libro que hayas leído recientemente. Incluye: de qué trata, qué aspectos destacan, y si lo recomendarías y a quién.',
    mode: '10min',
    cefrLevel: 'B2',
    genre: 'reseña',
    wordTarget: '100–130 palabras',
    wordMin: 100,
    wordMax: 130,
    taskType: 'narrative',
    tip: 'Combina descripción objetiva con valoración personal. Usa el presente para el argumento y el pasado para tu reacción.',
  },
  {
    id: 'wp-08',
    title: 'Ensayo argumentativo — redes sociales',
    prompt: 'Escribe un ensayo argumentativo de 200–250 palabras sobre el siguiente tema: "Las redes sociales hacen más daño que bien a la sociedad contemporánea." Presenta dos argumentos a favor y uno en contra de esta afirmación, y llega a una conclusión matizada.',
    mode: '20min',
    cefrLevel: 'C1',
    genre: 'ensayo argumentativo',
    wordTarget: '200–250 palabras',
    wordMin: 200,
    wordMax: 250,
    taskType: 'argumentative',
    tip: 'Usa "no obstante", "en cambio", "de ahí que + subjuntivo", "si bien es cierto que... conviene recordar que..."',
  },
  {
    id: 'wp-09',
    title: 'Propuesta de mejora',
    prompt: 'Escribe una propuesta (120–150 palabras) dirigida al ayuntamiento de tu ciudad para mejorar el transporte público. Identifica un problema específico, explica sus causas y propón una solución concreta con justificación.',
    mode: '10min',
    cefrLevel: 'C1',
    genre: 'propuesta formal',
    wordTarget: '120–150 palabras',
    wordMin: 120,
    wordMax: 150,
    taskType: 'formal_email',
    requiredElements: [
      'context (actualmente/en la actualidad/contexto)',
      'problem statement (problema/dificultad)',
      'causes (causas/debido a/se debe a)',
      'solution (solución/propuesta/medida)',
      'benefits (beneficios/ventajas/mejora)',
    ],
    tip: 'Estructura la propuesta: contexto → problema → solución → beneficios → conclusión.',
  },
  {
    id: 'wp-10',
    title: 'Comentario crítico de texto',
    prompt: 'Lee la siguiente afirmación y escribe un comentario crítico de 150–180 palabras: "La tecnología está destruyendo la capacidad humana de concentración profunda y pensamiento crítico." Evalúa la afirmación con argumentos equilibrados.',
    mode: '20min',
    cefrLevel: 'C1',
    genre: 'comentario crítico',
    wordTarget: '150–180 palabras',
    wordMin: 150,
    wordMax: 180,
    taskType: 'argumentative',
    tip: 'Evita posiciones extremas. Usa "cabe preguntarse si...", "sería simplista afirmar que...", "la evidencia sugiere que..."',
  },
];

export const speakingPrompts: SpeakingPromptMeta[] = [
  {
    id: 'sp-p-01',
    title: 'Tu experiencia de aprendizaje de idiomas',
    prompt: 'Habla sobre tu experiencia aprendiendo español u otros idiomas extranjeros. ¿Qué método te ha resultado más eficaz? ¿Qué dificultades has encontrado?',
    mode: '60s',
    cefrLevel: 'B1',
    topic: 'language learning',
    planningSeconds: 30,
    tip: 'Usa el pasado para narrar tu experiencia y el presente para hablar de tu situación actual.',
  },
  {
    id: 'sp-p-02',
    title: 'Ventajas e inconvenientes de las redes sociales',
    prompt: 'Habla durante 60 segundos sobre las ventajas e inconvenientes de las redes sociales para los jóvenes. Menciona al menos dos aspectos positivos y dos negativos.',
    mode: '60s',
    cefrLevel: 'B2',
    topic: 'technology',
    planningSeconds: 30,
    tip: 'Usa "por un lado... por otro...", "sin embargo", "no obstante" para estructurar el contraste.',
  },
  {
    id: 'sp-p-03',
    title: 'Describe una fotografía',
    prompt: 'Imagina que estás viendo una fotografía de un mercado al aire libre en una ciudad latinoamericana. Descríbela con detalle: qué hay, qué está pasando, qué ambiente transmite.',
    mode: '60s',
    cefrLevel: 'B2',
    topic: 'description',
    planningSeconds: 20,
    tip: 'Usa el presente continuo para acciones: "hay personas que están comprando...". Describe planos: primer plano, al fondo...',
  },
  {
    id: 'sp-p-04',
    title: 'El papel de la cultura en la identidad personal',
    prompt: 'Habla durante 90 segundos sobre cómo la cultura de tu país o región ha influido en tu identidad personal y en tus valores.',
    mode: '2min',
    cefrLevel: 'C1',
    topic: 'identity',
    planningSeconds: 45,
    tip: 'Reflexiona sobre aspectos concretos: lengua, tradiciones, valores familiares, relación con el tiempo, actitudes ante el trabajo.',
  },
  {
    id: 'sp-p-05',
    title: 'Debate: ¿Debería limitarse la jornada laboral?',
    prompt: 'Presenta y defiende tu postura durante 90 segundos: ¿Crees que los gobiernos deberían legislar para limitar la jornada laboral máxima? Incluye al menos un contraargumento y respóndelo.',
    mode: '2min',
    cefrLevel: 'C1',
    topic: 'work',
    planningSeconds: 45,
    tip: 'Estructura: postura → argumento principal → contraargumento → respuesta → conclusión.',
  },
  {
    id: 'sp-p-06',
    title: 'Recomendar un destino de viaje',
    prompt: 'Recomienda un lugar que hayas visitado o que te gustaría visitar. Explica por qué vale la pena ir, qué actividades se pueden hacer y qué tipo de viajero disfrutaría más de ese destino.',
    mode: '60s',
    cefrLevel: 'B2',
    topic: 'travel',
    planningSeconds: 30,
    tip: 'Usa el condicional para recomendaciones: "te recomendaría...", "valdría la pena..."',
  },
  {
    id: 'sp-p-07',
    title: 'Una situación difícil que has resuelto',
    prompt: 'Habla sobre una situación profesional o personal difícil que hayas tenido que resolver. Describe el problema, cómo lo abordaste y qué aprendiste.',
    mode: '60s',
    cefrLevel: 'B2',
    topic: 'personal',
    planningSeconds: 30,
    tip: 'Usa el pretérito indefinido para acciones específicas y el imperfecto para contexto y estados de ánimo.',
  },
  {
    id: 'sp-p-08',
    title: 'La desigualdad económica global',
    prompt: 'Habla durante 2 minutos sobre las causas principales de la desigualdad económica global y las posibles soluciones. Muestra tu capacidad de razonamiento matizado.',
    mode: '2min',
    cefrLevel: 'C1',
    topic: 'economics',
    planningSeconds: 60,
    tip: 'Organiza tu respuesta: causas estructurales → consecuencias → soluciones propuestas → evaluación crítica de esas soluciones.',
  },
  {
    id: 'sp-p-09',
    title: 'Tu rutina ideal',
    prompt: 'Describe cómo sería tu jornada ideal de trabajo o estudio. ¿Cuándo trabajarías? ¿Dónde? ¿Cómo organizarías tu tiempo?',
    mode: '30s',
    cefrLevel: 'B1',
    topic: 'daily life',
    planningSeconds: 20,
    tip: 'Usa el condicional para describir situaciones hipotéticas ideales: "me levantaría...", "trabajaría en..."',
  },
  {
    id: 'sp-p-10',
    title: 'Evalúa un titular de prensa',
    prompt: 'Evalúa el siguiente titular: "Los jóvenes de hoy no saben comunicarse sin tecnología." ¿Crees que es una afirmación justa? Defiende tu postura con ejemplos concretos. Habla 90 segundos.',
    mode: '2min',
    cefrLevel: 'C1',
    topic: 'society',
    planningSeconds: 45,
    tip: 'Cuestiona los supuestos del titular: "habría que definir qué se entiende por...", "esta afirmación generaliza en exceso..."',
  },
];
