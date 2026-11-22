const { app, BrowserWindow, session, Menu } = require('electron');
const path = require('path');

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 800, title: 'Event Deck', icon: path.join(__dirname, 'build', 'icon.png'), backgroundColor: '#070b24',
    webPreferences: { backgroundThrottling: false }, // giữ nhạc/mờ dần chạy đúng khi cửa sổ bị che
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  // cho phép đọc file nhạc đã chọn và chọn thiết bị âm thanh
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(true));
  session.defaultSession.setPermissionCheckHandler(() => true);
  createWindow();
});
app.on('window-all-closed', () => app.quit());
