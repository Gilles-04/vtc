import { defineConfig, devices } from '@playwright/test'

// Sert le build de production (`vite preview`) — mêmes fichiers que ceux
// réellement déployés, contrairement au serveur de dev (`vite dev`) qui
// n'a jamais exercé le vrai bundle. Réseau Supabase entièrement simulé
// dans chaque test (voir e2e/mocks.ts) : ces tests ne dépendent d'aucun
// accès réseau réel, y compris dans un environnement qui le bloquerait.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
