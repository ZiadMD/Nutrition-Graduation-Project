// errorHandler.js — Global Express error-handling middleware.
//
// Any route can call next(err) (or throw inside an async wrapper) and this
// function will format a consistent JSON error response so the client always
// gets the same shape: { "error": { "code": "...", "message": "..." } }.
//
// Express recognises an error-handling middleware by the 4-argument signature.
// Do NOT rename or remove `next` even though it isn't used — Express needs it.

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  // Log the full error server-side so we can debug it, but don't expose
  // internal details to the client.
  console.error(err)

  const status = err.status ?? 500
  const code = err.code ?? 'INTERNAL_ERROR'
  const message = err.message ?? 'An unexpected error occurred.'

  res.status(status).json({ error: { code, message } })
}

