const {contextBridge, ipcRenderer} = require('electron');

// 我们在 window 对象上暴露一个名为 'api' 的对象
// 这个对象上有一个 onUpdate 方法，可以安全地被渲染进程调用
contextBridge.exposeInMainWorld('api', {
    /**
     * @param {Function} callback - The function to call with simulation data.
     * The callback will receive (event, data) as arguments.
     */
    onUpdate: (callback) => ipcRenderer.on('simulation-update', callback)
});