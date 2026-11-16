import type { HumanMoves } from '@chessmenthol/core/lib/arrows';

// Maia-3 inference happens entirely in a bundled browser Worker. Never on
// localhost or a Python service; cancelled/stale positions are discarded.
type Key = keyof HumanMoves;
type Reply =
  | { id: number; kind: 'partial'; key: Key; move: string }
  | { id: number; kind: 'complete' }
  | { id: number; kind: 'error'; message: string };
type Pending = {
  moves: HumanMoves;
  resolve: (value: HumanMoves) => void;
  reject: (err: Error) => void;
  progress?: (moves: HumanMoves) => void;
  cleanup: () => void;
};
const VALID_UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
const KEYS = ['purple', 'green', 'yellow', 'red'];
let instance: Worker | null = null;
let counter = 0;
const waiting = new Map<number, Pending>();
function failAll(err: Error) {
  for (const [id, request] of waiting) {
    waiting.delete(id);
    request.cleanup();
    request.reject(err);
  }
}
function worker(): Worker {
  if (!instance) {
    instance = new Worker(new URL('../engine/maia3-worker.ts', import.meta.url), { type: 'module', name: 'Maia-3' });
    instance.onmessage = (event: MessageEvent<Reply>) => {
      const reply = event.data;
      const request = waiting.get(reply?.id);
      if (!request) return;
      if (reply.kind === 'partial') {
        if (!KEYS.includes(reply.key) || !VALID_UCI.test(reply.move)) return;
        request.moves[reply.key] = reply.move;
        request.progress?.({ ...request.moves });
      } else {
        waiting.delete(reply.id);
        request.cleanup();
        if (reply.kind === 'complete') request.resolve({ ...request.moves });
        else request.reject(new Error(reply.message));
      }
    };
    instance.onerror = (event: ErrorEvent) => {
      failAll(new Error(event.message || 'Maia-3 Worker error'));
      instance?.terminate();
      instance = null;
    };
  }
  return instance;
}
export function fetchHumanRecommendations(
  fen: string, signal?: AbortSignal, onPartial?: (moves: HumanMoves) => void,
): Promise<HumanMoves> {
  if (signal?.aborted) return Promise.reject(new Error('cancelled'));
  return new Promise((resolve, reject) => {
    const id = ++counter;
    const cleanup = () => signal?.removeEventListener('abort', abort);
    const abort = () => {
      waiting.delete(id);
      cleanup();
      reject(new Error('cancelled'));
    };
    waiting.set(id, { moves: {}, resolve, reject, progress: onPartial, cleanup });
    signal?.addEventListener('abort', abort, { once: true });
    try { worker().postMessage({ id, fen }); }
    catch (err) {
      waiting.delete(id);
      cleanup();
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}
