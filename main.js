const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { Simulation } = require('./simulation.js'); // 引入我们的仿真引擎

function createWindow () {
    const win = new BrowserWindow({
        width: 1000,
        height: 750,
        webPreferences: {
            // 使用 preload 脚本，这是更安全的方式
            preload: path.join(__dirname, 'preload.js'),
            // 关闭下面这两个不安全的选项
            // nodeIntegration: false,
            // contextIsolation: true // 默认即为 true
        }
    });

    win.loadFile('index.html');
    // win.webContents.openDevTools(); // 需要时可以取消注释来调试
}

app.whenReady().then(() => {
    createWindow();

    // 获取当前窗口
    const mainWindow = BrowserWindow.getAllWindows()[0];

    // 1. 创建仿真实例
    // 传入一个回调函数，当仿真状态更新时，此函数会被调用
    const simulation = new Simulation((update) => {
        // 2. 通过 IPC 将仿真状态发送到渲染进程
        mainWindow.webContents.send('simulation-update', update);
    });

    // 3. 启动仿真
    simulation.start();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});