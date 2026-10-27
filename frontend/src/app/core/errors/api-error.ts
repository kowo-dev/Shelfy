import { HttpErrorResponse } from '@angular/common/http';

type ApiProblemShape = {
  detail?: string;
  code?: string;
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly detail: string,
    readonly code: string,
  ) {
    super(detail);
    this.name = 'ApiError';
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof HttpErrorResponse) {
    const body = error.error as ApiProblemShape | undefined;
    return new ApiError(
      error.status,
      body?.detail ?? error.message,
      body?.code ?? inferCodeFromStatus(error.status),
    );
  }

  const message = error instanceof Error ? error.message : 'Unknown error';
  return new ApiError(0, message, 'UNKNOWN_ERROR');
}

function inferCodeFromStatus(status: number): string {
  switch (status) {
    case 400:
      return 'VALIDATION_FAILED';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 500:
      return 'INTERNAL_SERVER_ERROR';
    default:
      return 'UNKNOWN_ERROR';
  }
}
