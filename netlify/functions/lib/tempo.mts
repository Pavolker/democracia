/**
 * Utilitário de tempo compartilhado pelos adaptadores e pelo orquestrador.
 */

/**
 * Resolve com o valor da promessa, ou rejeita se ela não resolver no prazo.
 *
 * Usado para que uma casa lenta não defina sozinha o tempo de toda a coleta.
 * `Promise.race` já anexa tratador a todas as promessas de entrada, então a
 * promessa que perde a corrida não gera rejeição sem tratador.
 */
export function comTeto<T>(promessa: Promise<T>, ms: number): Promise<T> {
  let temporizador: ReturnType<typeof setTimeout>;

  const limite = new Promise<never>((_, rejeitar) => {
    temporizador = setTimeout(() => rejeitar(new Error(`tempo esgotado após ${ms / 1000}s`)), ms);
  });

  return Promise.race([promessa, limite]).finally(() => clearTimeout(temporizador));
}
