'use strict'

const { app, BrowserWindow, dialog, utilityProcess } = require('electron')
const path = require('path')
const http = require('http')

const PORT = 3000
let serverProcess = null
let isQuitting = false

function resolveServerPath() {
   return app.isPackaged
      ? path.join(process.resourcesPath, 'next-app', 'server.js')
      : path.join(__dirname, '..', '.next', 'standalone', 'server.js')
}

function startNextServer() {
   const serverPath = resolveServerPath()
   const cwd = path.dirname(serverPath)

   serverProcess = utilityProcess.fork(serverPath, [], {
      cwd,
      env: { ...process.env, PORT: String(PORT), NODE_ENV: 'production' },
      stdio: 'pipe',
   })

   serverProcess.stdout.on('data', (d) => process.stdout.write(`[next] ${d}`))
   serverProcess.stderr.on('data', (d) => process.stderr.write(`[next] ${d}`))

   serverProcess.on('exit', (code, signal) => {
      if (isQuitting || signal === 'SIGTERM' || code === null || code === 0) {
         return
      }
      dialog.showErrorBox(
         'CryptoTools — Server Error',
         `The Next.js server exited unexpectedly (code ${code}${signal ? `, signal ${signal}` : ''}).`,
      )
      app.quit()
   })
}

function waitForServer(retries = 40, intervalMs = 250) {
   return new Promise((resolve, reject) => {
      let attempts = 0
      const check = () => {
         const req = http.get(`http://localhost:${PORT}`, (res) => {
            res.resume()
            resolve()
         })
         req.on('error', () => {
            if (++attempts >= retries) {
               return reject(new Error(`Next.js server did not start after ${retries} attempts`))
            }
            setTimeout(check, intervalMs)
         })
         req.end()
      }
      check()
   })
}

function createWindow() {
   const win = new BrowserWindow({
      width: 1280,
      height: 800,
      title: 'CryptoTools',
      webPreferences: {
         nodeIntegration: false,
         contextIsolation: true,
      },
   })
   win.loadURL(`http://localhost:${PORT}`)
}

app.whenReady().then(async () => {
   startNextServer()
   try {
      await waitForServer()
      createWindow()
   } catch (err) {
      console.error(err.message)
      dialog.showErrorBox(
         'CryptoTools — Server Timeout',
         'The Next.js server did not respond in time.',
      )
      app.quit()
   }
})

app.on('before-quit', () => {
   isQuitting = true
})

app.on('window-all-closed', () => {
   isQuitting = true
   if (serverProcess) serverProcess.kill()
   app.quit()
})
