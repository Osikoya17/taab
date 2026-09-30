/**
 * Errors thrown by services. `code` is stable and safe to branch on; the UI
 * maps codes to friendly copy and never renders raw technical messages.
 */
export type ServiceErrorCode =
  | 'network'
  | 'not_found'
  | 'forbidden'
  | 'validation'
  | 'history_locked'
  | 'limit_reached'
  | 'rate_limited'
  | 'unavailable'
  /** Not enough scan credits in the chosen balance. */
  | 'insufficient_credits'
  /** The taab already owns this pack. */
  | 'already_owned'
  | 'unknown';

export class ServiceError extends Error {
  readonly code: ServiceErrorCode;

  constructor(code: ServiceErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'ServiceError';
    this.code = code;
  }
}

export function isServiceError(error: unknown): error is ServiceError {
  return error instanceof ServiceError;
}
