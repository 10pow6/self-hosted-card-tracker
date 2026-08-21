// Shared fetch helpers so every module reports errors the same way.

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function handle<T>(res: Response, label: string): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ApiError(res.status, `${label} → ${res.status}${text ? `: ${text}` : ''}`);
  }
  return (await res.json()) as T;
}

export async function apiGet<T>(url: string, label: string = url): Promise<T> {
  return handle<T>(await fetch(url), label);
}

export async function apiSend<T>(
  url: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: unknown,
  label: string = url,
): Promise<T> {
  return handle<T>(
    await fetch(url, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
    label,
  );
}

// Human-readable message for toasts and inline error states.
export function getErrorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status >= 500) return 'The backend hit an error. Check the server logs and try again.';
    return e.message;
  }
  if (e instanceof TypeError) return 'Could not reach the backend — is it running?';
  if (e instanceof Error) return e.message;
  return 'Something went wrong.';
}
