// Re-export client API module for bundlers/Vite resolving './api' directly as a file.
export * from './api/client'
export { api as default, api } from './api/client'
