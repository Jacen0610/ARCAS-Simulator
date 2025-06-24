// --- DOM Element Cache ---
const aircraftList = document.getElementById('aircraft-list');
const channelStatus = document.getElementById('channel-status');
const messageLog = document.getElementById('message-log');
const utilizationStat = document.getElementById('utilization-stat');
const successRateStat = document.getElementById('success-rate-stat');
const logContainer = document.getElementById('log-container');


// 使用 preload 脚本中暴露的 'api.onUpdate' 方法来监听数据
window.api.onUpdate((event, data) => {
    // 1. 更新频段和当前报文 (这部分逻辑不变)
    if (data.channel.isBusy) {
        channelStatus.textContent = `BUSY (被 ${data.channel.user} 占用)`;
        channelStatus.className = 'busy';
        messageLog.textContent = data.channel.message ? JSON.stringify(data.channel.message, null, 2) : '...';
    } else {
        channelStatus.textContent = 'FREE';
        channelStatus.className = 'free';
        messageLog.textContent = '等待接收...';
    }

    // 2. 更新航空器列表 (这部分逻辑不变)
    while (aircraftList.children.length > 1) {
        aircraftList.removeChild(aircraftList.lastChild);
    }

    data.aircrafts.forEach(ac => {
        const listItem = document.createElement('li');
        listItem.innerHTML = `
            <span>${ac.callsign}</span>
            <span>${ac.flightPhase}</span>
            <span>${ac.queueSize}</span>
            <span>${ac.successRate.toFixed(1)}%</span>
            <span class="state state-${ac.state}">${ac.state}</span>
        `;
        aircraftList.appendChild(listItem);
    });

    // 3. 更新全局统计 (这部分逻辑不变)
    utilizationStat.textContent = `${data.stats.channelUtilization.toFixed(2)}%`;
    successRateStat.textContent = `${data.stats.overallSuccessRate.toFixed(2)}%`;

    // 4. 更新日志 (改为重绘方式，更可靠)
    logContainer.innerHTML = ''; // 每次都先清空旧的日志
    data.log.forEach(entry => {
        const logLine = document.createElement('div');
        logLine.textContent = entry;
        logContainer.appendChild(logLine);
    });
    // 自动滚动到底部
    logContainer.scrollTop = logContainer.scrollHeight;
});