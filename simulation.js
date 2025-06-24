// --- 常量定义 ---
const TICK_INTERVAL = 100; // ms, 仿真时间步长
const POSITION_REPORT_INTERVAL = 15 * 60 * 1000; // 15 分钟 (仿真时间)
const TRANSMISSION_TIME_MIN = 1500; // ms
const TRANSMISSION_TIME_MAX = 2500; // ms
// 增加退避时间范围
const BACKOFF_TIME_MIN = 2000; // ms
const BACKOFF_TIME_MAX = 5000; // ms
const ACK_TIMEOUT = 5000; // 等待ACK的超时时间 (5秒)，超时则重传
const GROUND_ACK_DELAY = 500; // 地面站响应ACK的模拟延迟
const MAX_BACKOFF_ATTEMPTS = 16; // 最大退避尝试次数

// --- 枚举与优先级 ---
const FLIGHT_PHASES = {
    PRE_FLIGHT: 'PRE-FLIGHT',
    TAXI_OUT: 'TAXI-OUT',
    IN_AIR: 'IN-AIR',
    LANDED: 'LANDED',
    TAXI_IN: 'TAXI-IN',
    PARKED: 'PARKED'
};

const AIRCRAFT_STATES = {
    IDLE: 'IDLE',
    SENSING: 'SENSING',
    TRANSMITTING: 'TRANSMITTING',
    WAITING_FOR_ACK: 'WAITING_FOR_ACK' // 新增状态：等待ACK
};

const MESSAGE_PRIORITY = {
    CRITICAL: 1, // 关键报文 (OOOI)
    ROUTINE: 5   // 常规报文 (位置报告)
};

// 代表一个航空器
class Aircraft {
    constructor(id, callsign, flightPlan) {
        this.id = id;
        this.callsign = callsign;
        this.flightPlan = flightPlan;

        this.state = AIRCRAFT_STATES.IDLE;
        this.flightPhase = FLIGHT_PHASES.PRE_FLIGHT;
        this.messageQueue = [];
        this.backoffTime = 0;
        this.nextPositionReportTime = 0;
        this.backoffAttempts = 0; // <--- 新增：初始化退避尝试次数

        // --- 新增属性，用于处理ACK ---
        this.pendingAckMessage = null; // 正在等待ACK的报文
        this.ackTimer = 0; // ACK超时计时器

        // 统计数据
        this.transmissionAttempts = 0;
        this.successfulTransmissions = 0;
    }

    // 根据仿真时间更新飞机状态
    update(simulationTime) {
        // --- 重传逻辑 ---
        if (this.state === AIRCRAFT_STATES.WAITING_FOR_ACK) {
            this.ackTimer -= TICK_INTERVAL;
            if (this.ackTimer <= 0) {

                // 将超时的报文重新放回队列的最前端
                this.messageQueue.unshift(this.pendingAckMessage);
                this.pendingAckMessage = null;
                this.state = AIRCRAFT_STATES.IDLE;
                // 应用指数退避算法
                this.backoffTime = Math.min(BACKOFF_TIME_MAX, BACKOFF_TIME_MIN * Math.pow(2, this.backoffAttempts));
                this.backoffAttempts = Math.min(MAX_BACKOFF_ATTEMPTS, this.backoffAttempts + 1);
            }
        }

        // 如果正在等待一个关键报文的响应，则不产生新的飞行阶段报文
        if (this.state === AIRCRAFT_STATES.WAITING_FOR_ACK) return;

        // --- OOOI 状态转换现在被阻塞，直到收到ACK ---
        const canChangePhase = !this.pendingAckMessage;

        // 检查函数，防止生成重复的关键报文
        const hasMessageOfType = (type) => this.messageQueue.some(msg => msg.type === type);

        if (canChangePhase && this.flightPhase === FLIGHT_PHASES.PRE_FLIGHT && simulationTime >= this.flightPlan.out) {
            // 只有在队列中没有 'OUT' 报文时才生成
            if (!hasMessageOfType('OUT')) {
                this.generateMessage('OUT', { time: new Date(this.flightPlan.out).toISOString() }, MESSAGE_PRIORITY.CRITICAL, true);
            }
        } else if (canChangePhase && this.flightPhase === FLIGHT_PHASES.TAXI_OUT && simulationTime >= this.flightPlan.off) {
            // 只有在队列中没有 'OFF' 报文时才生成
            if (!hasMessageOfType('OFF')) {
                this.generateMessage('OFF', { time: new Date(this.flightPlan.off).toISOString() }, MESSAGE_PRIORITY.CRITICAL, true);
            }
        } else if (canChangePhase && this.flightPhase === FLIGHT_PHASES.IN_AIR && simulationTime >= this.flightPlan.on) {
            // 只有在队列中没有 'ON' 报文时才生成
            if (!hasMessageOfType('ON')) {
                this.generateMessage('ON', { time: new Date(this.flightPlan.on).toISOString() }, MESSAGE_PRIORITY.CRITICAL, true);
            }
        } else if (canChangePhase && this.flightPhase === FLIGHT_PHASES.LANDED && simulationTime >= this.flightPlan.in) {
            // 只有在队列中没有 'IN' 报文时才生成
            if (!hasMessageOfType('IN')) {
                this.generateMessage('IN', { time: new Date(this.flightPlan.in).toISOString() }, MESSAGE_PRIORITY.CRITICAL, true);
            }
        }

        // 自动位置报告 (常规报文，逻辑不变)
        if (this.flightPhase === FLIGHT_PHASES.IN_AIR && simulationTime >= this.nextPositionReportTime) {
            this.generateMessage('Position Report', { lat: (Math.random() * 180 - 90).toFixed(4), lon: (Math.random() * 360 - 180).toFixed(4) }, MESSAGE_PRIORITY.ROUTINE, false);
            this.nextPositionReportTime = simulationTime + POSITION_REPORT_INTERVAL;
        }
    }
    // 生成带有更多属性的报文
    generateMessage(type, data, priority, requiresAck) {
        const message = {
            id: `${this.callsign}-${Date.now()}-${Math.random()}`, // 用于ACK的唯一ID
            type: type,
            priority: priority,
            requiresAck: requiresAck,
            timestamp: new Date().toISOString(),
            data: data
        };
        this.messageQueue.push(message);
        // 根据优先级对队列排序 (数字越小，优先级越高)
        this.messageQueue.sort((a, b) => a.priority - b.priority);
    }

    // 从地面站接收ACK
    receiveAck(messageId) {
        if (this.pendingAckMessage && this.pendingAckMessage.id === messageId) {


            // --- 收到ACK后，正式转换飞行阶段 ---
            switch(this.pendingAckMessage.type) {
                case 'OUT': this.flightPhase = FLIGHT_PHASES.TAXI_OUT; break;
                case 'OFF': this.flightPhase = FLIGHT_PHASES.IN_AIR; this.nextPositionReportTime = this.flightPlan.off + POSITION_REPORT_INTERVAL; break;
                case 'ON': this.flightPhase = FLIGHT_PHASES.LANDED; break;
                case 'IN': this.flightPhase = FLIGHT_PHASES.PARKED; break;
            }

            this.pendingAckMessage = null;
            this.ackTimer = 0;
            this.state = AIRCRAFT_STATES.IDLE;
            this.backoffAttempts = 0; // <--- 新增：成功通信后重置退避计数
        }
    }

    tryTransmit(channel, logCallback) {
        // 如果正在发送或等待ACK，则不执行任何操作
        if (this.state === AIRCRAFT_STATES.TRANSMITTING || this.state === AIRCRAFT_STATES.WAITING_FOR_ACK) return;

        if (this.backoffTime > 0) {
            this.backoffTime -= TICK_INTERVAL;
            return;
        }

        if (this.messageQueue.length === 0) {
            this.state = AIRCRAFT_STATES.IDLE;
            this.backoffAttempts = 0; // 队列空时重置退避尝试次数
            return;
        }

        this.state = AIRCRAFT_STATES.SENSING;
        this.transmissionAttempts++;

        if (!channel.isBusy) {
            this.state = AIRCRAFT_STATES.TRANSMITTING;
            this.successfulTransmissions++;
            const messageToSend = this.messageQueue.shift(); // 取出优先级最高的报文

            const transmissionTime = TRANSMISSION_TIME_MIN + Math.random() * (TRANSMISSION_TIME_MAX - TRANSMISSION_TIME_MIN);
            channel.occupy(this, messageToSend, transmissionTime, logCallback);

            // 如果此报文需要ACK，则设置等待状态和计时器
            if (messageToSend.requiresAck) {
                this.pendingAckMessage = messageToSend;
                this.ackTimer = ACK_TIMEOUT;
            }

            setTimeout(() => {
                channel.release(this, logCallback);
                // 发送完成后，如果需要ACK，则进入等待状态，否则返回空闲状态
                this.state = messageToSend.requiresAck ? AIRCRAFT_STATES.WAITING_FOR_ACK : AIRCRAFT_STATES.IDLE;
                if (!messageToSend.requiresAck) {
                    this.backoffAttempts = 0; // 非关键报文发送成功后重置退避尝试次数
                }
            }, transmissionTime);

        } else {
            // 检测到信道忙时，应用指数退避算法
            this.backoffTime = Math.min(BACKOFF_TIME_MAX, BACKOFF_TIME_MIN * Math.pow(2, this.backoffAttempts));
            this.backoffAttempts = Math.min(MAX_BACKOFF_ATTEMPTS, this.backoffAttempts + 1);
        }
    }

    getSuccessRate() {
        if (this.transmissionAttempts === 0) return 100;
        return (this.successfulTransmissions / this.transmissionAttempts) * 100;
    }
}

class GroundStation {
    constructor() {
        this.callsign = 'GND-CTRL'; // 地面站呼号
        this.messageQueue = [];
        this.backoffTime = 0;
        this.backoffAttempts = 0;
    }

    /**
     * 生成一个 ACK 报文
     * @param {object} originalMessage - 需要被确认的原始报文
     * @param {string} recipientCallsign - 接收该ACK的飞机呼号
     */
    generateAck(originalMessage, recipientCallsign) {
        // 检查是否已存在针对此报文的ACK，防止重复生成
        const hasAckForId = this.messageQueue.some(msg => msg.ackForId === originalMessage.id);
        if (hasAckForId) {
            return; // 如果已在队列中，则不重复添加
        }

        const ackMessage = {
            id: `ACK-${originalMessage.id}`,
            type: 'ACK',
            priority: 0, // ACK 拥有最高优先级
            requiresAck: false,
            recipient: recipientCallsign,
            ackForId: originalMessage.id, // 指明这是对哪个报文的确认
            timestamp: new Date().toISOString(),
        };
        this.messageQueue.push(ackMessage);
        this.messageQueue.sort((a, b) => a.priority - b.priority);
    }

    /**
     * 尝试发送报文 (与 Aircraft.tryTransmit 非常相似)
     */
    tryTransmit(channel, logCallback) {
        if (this.backoffTime > 0) {
            this.backoffTime -= TICK_INTERVAL;
            return;
        }

        if (this.messageQueue.length === 0) {
            this.backoffAttempts = 0;
            return;
        }

        if (!channel.isBusy) {
            const messageToSend = this.messageQueue.shift();
            const transmissionTime = 500; // ACK报文通常较短，可以设为固定值
            channel.occupy(this, messageToSend, transmissionTime, logCallback);

            setTimeout(() => {
                channel.release(this, logCallback);
                this.backoffAttempts = 0; // 发送成功后重置退避
            }, transmissionTime);
        } else {
            // 信道忙，指数退避
            this.backoffTime = Math.min(BACKOFF_TIME_MAX, BACKOFF_TIME_MIN * Math.pow(2, this.backoffAttempts));
            this.backoffAttempts = Math.min(MAX_BACKOFF_ATTEMPTS, this.backoffAttempts + 1);
        }
    }
}

class Channel {
    constructor() {
        this.isBusy = false;
        this.currentUser = null;
        this.currentMessage = null;
        // --- 新增属性，用于ACK逻辑 ---
        this.lastSender = null;
        this.lastMessage = null;
    }

    occupy(aircraft, message, duration, logCallback) {
        this.isBusy = true;
        this.currentUser = aircraft;
        this.currentMessage = message;
        logCallback(`[占用] ${aircraft.callsign} 占用信道 ${duration.toFixed(0)}ms. 报文: ${message.type} (优先级: ${message.priority})`);
    }

    release(aircraft, logCallback) {
        if (this.currentUser && this.currentUser.id === aircraft.id) {
            logCallback(`[释放] ${aircraft.callsign} 释放信道. 信道空闲.`);
            this.isBusy = false;
            // 记录下最后的使用者和报文，供地面站逻辑使用
            this.lastSender = this.currentUser;
            this.lastMessage = this.currentMessage;
            this.currentUser = null;
            this.currentMessage = null;
        }
    }
}

// 仿真主类
class Simulation {
    constructor(onUpdateCallback) {
        this.onUpdate = onUpdateCallback;
        this.channel = new Channel();
        this.log = [];
        this.simulationTime = 0;
        this.totalTime = 0;
        this.busyTime = 0;
        this.aircrafts = this.generateAircrafts(50);
        this.intervalId = null;
        this.groundStation = new GroundStation();
    }

    generateAircrafts(count) {
        const aircrafts = [];
        const baseTime = new Date().getTime();
        for (let i = 0; i < count; i++) {
            const callsign = `SKY${1000 + i}`;
            // 随机生成错开的飞行计划 (单位: 仿真毫秒)
            const outTime = (Math.random() * 10 * 60 * 1000); // 0-10分钟内推出
            const offTime = outTime + (5 * 60 * 1000 + Math.random() * 5 * 60 * 1000); // 推出后5-10分钟起飞
            const onTime = offTime + (60 * 60 * 1000 + Math.random() * 30 * 60 * 1000); // 飞行60-90分钟
            const inTime = onTime + (5 * 60 * 1000 + Math.random() * 5 * 60 * 1000); // 落地后5-10分钟停靠

            const flightPlan = { out: outTime, off: offTime, on: onTime, in: inTime };
            aircrafts.push(new Aircraft(i + 1, callsign, flightPlan));
        }
        return aircrafts;
    }

    logEvent(message) {
        const logEntry = `${new Date().toLocaleTimeString()}: ${message}`;
        this.log.push(logEntry);
        // 保持日志大小，防止内存溢出
        if (this.log.length > 200) {
            this.log.shift();
        }
    }

    tick() {
        this.simulationTime += TICK_INTERVAL;
        this.totalTime += TICK_INTERVAL;
        if (this.channel.isBusy) {
            this.busyTime += TICK_INTERVAL;
        }

        // 1. 更新所有飞机状态 (生成报文、处理重传超时)
        this.aircrafts.forEach(aircraft => aircraft.update(this.simulationTime));

        // 2. 所有飞机和地面站都尝试根据 CSMA 和优先级发送报文
        this.groundStation.tryTransmit(this.channel, (msg) => this.logEvent(msg)); // <--- 新增
        this.aircrafts.forEach(aircraft => {
            aircraft.tryTransmit(this.channel, (msg) => this.logEvent(msg));
        });

        // 3. --- 报文递送与ACK生成逻辑 (重构) ---
        // 检查信道是否刚被释放，处理刚被成功发送的报文
        if (!this.channel.isBusy && this.channel.lastMessage) {
            const deliveredMessage = this.channel.lastMessage;
            const sender = this.channel.lastSender;

            // 清理信道记录，防止重复处理
            this.channel.lastMessage = null;
            this.channel.lastSender = null;

            if (deliveredMessage.type === 'ACK') {
                // 如果是ACK报文，则递送给目标飞机
                const targetAircraft = this.aircrafts.find(ac => ac.callsign === deliveredMessage.recipient);
                if (targetAircraft) {
                    this.logEvent(`[递送] ACK 成功递送给 ${targetAircraft.callsign}.`);
                    targetAircraft.receiveAck(deliveredMessage.ackForId);
                }
            } else if (deliveredMessage.requiresAck) {
                // 如果是飞机发来的关键报文，则命令地面站生成ACK
                this.groundStation.generateAck(deliveredMessage, sender.callsign);
            }
        }

        // 4. 准备UI数据 (无变化)
        const totalAttempts = this.aircrafts.reduce((sum, ac) => sum + ac.transmissionAttempts, 0);
        const totalSuccesses = this.aircrafts.reduce((sum, ac) => sum + ac.successfulTransmissions, 0);
        const updateData = {
            channel: {
                isBusy: this.channel.isBusy,
                user: this.channel.currentUser ? this.channel.currentUser.callsign : 'N/A',
                message: this.channel.currentMessage
            },
            aircrafts: this.aircrafts.map(ac => ({
                id: ac.id,
                callsign: ac.callsign,
                state: ac.state,
                flightPhase: ac.flightPhase,
                queueSize: ac.messageQueue.length,
                successRate: ac.getSuccessRate()
            })),
            stats: {
                channelUtilization: this.totalTime > 0 ? (this.busyTime / this.totalTime) * 100 : 0,
                overallSuccessRate: totalAttempts > 0 ? (totalSuccesses / totalAttempts) * 100 : 100,
            },
            log: this.log
        };
        this.onUpdate(updateData);
    }

    start() {
        if (this.intervalId) clearInterval(this.intervalId);
        this.intervalId = setInterval(() => this.tick(), TICK_INTERVAL);
    }

    stop() {
        clearInterval(this.intervalId);
    }
}

module.exports = { Simulation };