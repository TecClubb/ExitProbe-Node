export class ExitProbeError extends Error {
  /** HTTP status code returned by the API. */
  readonly status: number;
  /** Field-level validation errors, when the API returned a 422. */
  readonly errors?: Record<string, string[]>;
  /** Raw decoded JSON body, if any. */
  readonly body?: unknown;

  constructor(message: string, status: number, errors?: Record<string, string[]>, body?: unknown) {
    super(message);
    this.name = 'ExitProbeError';
    this.status = status;
    this.errors = errors;
    this.body = body;
  }
}
