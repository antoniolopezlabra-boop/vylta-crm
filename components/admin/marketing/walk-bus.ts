// Canal entre el chat y la oficina: cuando un agente delega o consulta a
// otros durante una conversación, el chat pide la caminata (ir con cada uno
// y regresar a su lugar) y espera a que termine antes de mostrar la respuesta.
// Si la oficina no está montada, la espera se resuelve de inmediato.

type WalkHandler = (from: string, targets: string[]) => Promise<void>;

let handler: WalkHandler | null = null;

export const walkBus = {
  // Agentes cuya caminata controla el chat: la oficina no los mueve por su cuenta.
  busy: new Set<string>(),
  register(h: WalkHandler) {
    handler = h;
    return () => { if (handler === h) handler = null; };
  },
  walk(from: string, targets: string[]): Promise<void> {
    if (!handler || !targets.length) return Promise.resolve();
    return Promise.race([handler(from, targets), new Promise<void>((r) => setTimeout(r, 90_000))]);
  },
};
