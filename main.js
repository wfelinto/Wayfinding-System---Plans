const { app, BrowserWindow } = require("electron");
const path = require("path");
const net = require("net");
const { spawn } = require("child_process");

const PORT = 3000;
let serverProcess = null;
let mainWindow = null;

/** Resolves the path to the bundled Next.js standalone server.js, in dev vs. packaged builds. */
function getServerEntryPath() {
  if (app.isPackaged) {
    // electron-builder copies .next/standalone here as "standalone" via extraResources.
    return path.join(process.resourcesPath, "standalone", "server.js");
  }
  return path.join(__dirname, "..", ".next", "standalone", "server.js");
}

/** Waits until the local server is actually accepting connections before loading the window. */
function waitForServer(port, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    (function tryConnect() {
      const socket = net.createConnection(port, "127.0.0.1");
      socket.once("connect", () => {
        socket.end();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() - start > timeoutMs) {
          reject(new Error("Timed out waiting for the local server to start."));
          return;
        }
        setTimeout(tryConnect, 300);
      });
    })();
  });
}

function startServer() {
  const entry = getServerEntryPath();
  // ELECTRON_RUN_AS_NODE lets Electron's own bundled binary act as a
  // plain Node.js process — this is what avoids requiring a separate
  // Node.js installation on the user's machine just to run the server.
  serverProcess = spawn(process.execPath, [entry], {
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: "production",
      ELECTRON_RUN_AS_NODE: "1",
      HOSTNAME: "127.0.0.1",
    },
    stdio: "inherit",
  });

  serverProcess.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`Local server exited unexpectedly with code ${code}`);
    }
  });
}

async function createWindow() {
  startServer();

  try {
    await waitForServer(PORT);
  } catch (err) {
    console.error(err);
  }

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    title: "Wayfinding Scoping Tool",
    webPreferences: {
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
}

app.whenReady().then(createWindow);

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

function shutdownServer() {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
    serverProcess = null;
  }
}

app.on("window-all-closed", () => {
  shutdownServer();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", shutdownServer);
