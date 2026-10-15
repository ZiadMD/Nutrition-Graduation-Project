// index.js — Entry point. Imports the configured app and starts listening.
// Run via: node --watch server/src/index.js   (or npm run dev from root)

import app from './app.js'

const PORT = process.env.PORT || 4000

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  console.log(`Health check: http://localhost:${PORT}/api/health`)
})

