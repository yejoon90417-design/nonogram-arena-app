import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

// https://vite.dev/config/
const appsInTossExcludedPublicPaths = [
  'about',
  'faq',
  'how-to-play',
  'privacy',
  'pvp-guide',
  'ranking-guide',
  'terms',
  'updates',
  'profile',
  'site-tour',
  'tier-guide',
  'tiers',
  'votes',
  'ads.txt',
  'back.png',
  'content-pages.css',
  'darkdiscord.png',
  'google9cd66cf4d4190871.html',
  'robots.txt',
  'sitemap.xml',
  'vite.svg',
  'whitediscord.png',
]

function pruneAppsInTossPublicAssets() {
  return {
    name: 'prune-apps-in-toss-public-assets',
    closeBundle() {
      const root = path.resolve('.')
      for (const relativePath of appsInTossExcludedPublicPaths) {
        for (const base of ['dist', path.join('dist', 'web')]) {
          const target = path.resolve(root, base, relativePath)
          if (fs.existsSync(target)) {
            fs.rmSync(target, { recursive: true, force: true })
          }
        }
      }
    },
  }
}

export default defineConfig(({ mode }) => ({
  base: mode === 'apk' ? './' : '/',
  plugins: [react(), (mode === 'appsintoss' || mode === 'apk') && pruneAppsInTossPublicAssets()].filter(Boolean),
}))
