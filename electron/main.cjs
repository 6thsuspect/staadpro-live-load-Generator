const { app, BrowserWindow, session } = require("electron");
const path = require("node:path");
app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler(
    (_contents, _permission, callback) => callback(false),
  );
  const createWindow = () => {
    const window = new BrowserWindow({
      width: 1600,
      height: 1050,
      minWidth: 1050,
      minHeight: 720,
      title: "Span · STAAD Live Load Generator",
      backgroundColor: "#f5f7f5",
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });
    window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    window.webContents.on("will-navigate", (event) => event.preventDefault());
    window.loadFile(path.join(__dirname, "../dist/index.html"));
  };
  createWindow();
  app.on("activate", () => {
    if (!BrowserWindow.getAllWindows().length) createWindow();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
