#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import http from 'node:http'

const FRONT_URL = process.env.APP_URL || 'http://localhost:5173'
const BACK_URL = process.env.BACKEND_URL || 'http://localhost:4100'

function waitHttpOk(url, timeoutMs = 15000) {
  const started = Date.now()
  return new Promise(async (resolve, reject) => {
    while (Date.now() - started < timeoutMs) {
      try {
        await new Promise((res, rej) => {
          const req = http.get(url, r => {
            r.resume()
            if (r.statusCode && r.statusCode >= 200 && r.statusCode < 500) res()
            else rej(new Error('bad status ' + r.statusCode))
          })
          req.on('error', rej)
          req.setTimeout(3000, () => rej(new Error('timeout')))
        })
        return resolve(true)
      } catch (e) {
        await delay(500)
      }
    }
    reject(new Error(`timeout waiting ${url}`))
  })
}

async function ensureBackend() {
  try {
    await waitHttpOk(`${BACK_URL}/health`, 3000)
    return { proc: null, url: BACK_URL }
  } catch {}
  console.log(`[e2e] starting backend at ${BACK_URL}`)
  const env = { ...process.env, PORT: new URL(BACK_URL).port || '4100' }
  const proc = spawn(process.execPath, ['server/index.js'], { env, stdio: 'inherit' })
  await waitHttpOk(`${BACK_URL}/health`, 15000)
  return { proc, url: BACK_URL }
}

async function ensureFrontend() {
  try {
    await waitHttpOk(FRONT_URL, 3000)
    return { proc: null, url: FRONT_URL }
  } catch {}
  console.log(`[e2e] starting frontend at ${FRONT_URL}`)
  const proc = spawn('npm', ['run', 'dev'], { stdio: 'inherit', shell: true })
  await waitHttpOk(FRONT_URL, 15000)
  return { proc, url: FRONT_URL }
}

async function runPlaywright() {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, APP_URL: FRONT_URL, BACKEND_URL: BACK_URL }
    const proc = spawn('npx', ['playwright', 'test', 'tests/ui.spec.js', 'tests/appointment.spec.js', '--browser=chromium', '--timeout=45000'], { stdio: 'inherit', shell: true, env })
    proc.on('exit', code => code === 0 ? resolve(0) : reject(new Error('tests failed')))
  })
}

;(async () => {
  const backs = await ensureBackend()
  const fronts = await ensureFrontend()
  try {
    await runPlaywright()
    console.log('[e2e] tests passed')
    process.exit(0)
  } catch (e) {
    console.error('[e2e] tests failed:', e.message)
    process.exit(1)
  } finally {
    if (fronts.proc) { try { fronts.proc.kill() } catch {} }
    if (backs.proc)  { try { backs.proc.kill() } catch {} }
  }
})()
