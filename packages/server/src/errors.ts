/** An error that becomes an OData error response: `{ error: { code, message, target?, details? } }`. */
export class ODataServerError extends Error {
  override name = 'ODataServerError';
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly target?: string,
    readonly details: { code: string; message: string; target?: string }[] = [],
  ) {
    super(message);
  }
}

/** 400 Bad Request: the request is not valid for this service. */
export const badRequest = (code: string, message: string, target?: string) => new ODataServerError(400, code, message, target);

/** 404 Not Found. */
export const notFound = (message: string) => new ODataServerError(404, 'NotFound', message);

/** 501 Not Implemented: valid OData, but outside what this service supports (ADR-027). */
export const notImplemented = (message: string) => new ODataServerError(501, 'NotImplemented', message);

/** The JSON body of an OData error response. */
export function errorBody(e: ODataServerError) {
  return {
    error: {
      code: e.code,
      message: e.message,
      ...(e.target ? { target: e.target } : {}),
      ...(e.details.length ? { details: e.details } : {}),
    },
  };
}
