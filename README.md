# 航空器信道分配仿真软件 (ARCAS-Sim)

这是一个基于 **Electron** 框架开发的桌面应用程序，旨在仿真航空通信系统（如 ACARS/ARCAS）中的信道分配机制。项目核心是模拟多架航空器在共享的单一信道上，如何通过 **CSMA (载波侦听多路访问)** 协议以及 **ACK/重传** 机制来发送报文。

## ✨ 主要功能

-   **多实体仿真**: 可同时模拟多达50架航空器和一个地面控制中心，它们共同竞争信道资源。
-   **完整飞行周期**: 每架飞机都遵循一个包含 **O-O-O-I** (Out, Off, On, In) 关键节点的完整飞行计划。
-   **真实的CSMA协议**: 所有通信实体（飞机和地面站）在发送前都会侦听信道。如果信道繁忙，则会采用**指数退避算法**进行等待和重试。
-   **确认与重传机制**: 关键的OOOI报文必须收到地面站的ACK（确认）报文。若在规定时间内未收到，飞机会自动重传。
-   **报文优先级**: 通信报文被分为不同优先级（如：关键的OOOI报文 vs. 常规的位置报告），高优先级的报文会优先被发送。
-   **地面站仿真**: 地面站不再是理想化的存在，它发送的ACK报文也需要像飞机一样竞争信道，遵循同样的CSMA协议。
-   **实时可视化界面**:
    -   **航空器状态列表**: 实时展示每架飞机的呼号、当前飞行阶段、消息队列长度、请求成功率和信道状态。
    -   **全局统计**: 以数字形式清晰展示频段的实时使用率和所有通信的总体成功率。
    -   **信道监控**: 明确显示信道当前是“空闲”还是“被占用”，并展示正在传输的报文详情。
    -   **事件日志**: 滚动显示每一次信道占用、释放、报文递送和ACK生成的详细记录。

## 🛠️ 技术栈

-   **框架**: Electron
-   **前端**: HTML5, CSS3, JavaScript (ES6+)

## 🚀 如何运行

1.  **克隆项目** 
2.  **安装依赖**
    -  安装Node和Electron
3.  **启动应用**
    -  `npm start`
    
    