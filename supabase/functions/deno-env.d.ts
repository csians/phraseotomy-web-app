/** Deno globals for Supabase Edge Functions (editor type-checking). */

declare namespace Deno {
  function serve(
    handler: (request: Request) => Response | Promise<Response>,
    options?: {
      port?: number;
      hostname?: string;
      signal?: AbortSignal;
      onListen?: (params: { hostname: string; port: number }) => void;
      onError?: (error: unknown) => void;
    },
  ): { shutdown: () => Promise<void>; finished: Promise<void> };

  function upgradeWebSocket(
    request: Request,
    options?: { protocol?: string; signal?: AbortSignal },
  ): { socket: WebSocket; response: Response };

  const env: {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    delete(key: string): void;
    toObject(): Record<string, string>;
  };
}
