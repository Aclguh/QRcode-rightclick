# 右键扫描二维码 (QR Code Right-Click Scanner)

<p align="center">
  <img src="icons/icon128.png" alt="Logo" width="96" height="96">
</p>

<p align="center">
  <strong>一款基于 Chrome Manifest V3 的轻量级浏览器扩展，网页右键任意图片即可离线快速扫描与识别二维码。</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Manifest-V3-blue?style=flat-square" alt="Manifest V3">
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License">
  <img src="https://img.shields.io/badge/Privacy-100%25_Offline-success?style=flat-square" alt="100% Offline">
  <img src="https://img.shields.io/badge/Platform-Chrome_%7C_Edge_%7C_Chromium-orange?style=flat-square" alt="Platform">
</p>

---

## 🌟 核心特性

- 🖱️ **右键极速扫码**：在网页任何二维码图片上点击鼠标右键，选择「扫描图片中的二维码」，无需截图即可原地识别。
- 🛡️ **Shadow DOM 独立弹窗**：采用原生 Web Components Shadow DOM 渲染交互结果卡片，与原网页 CSS 样式 100% 隔离，绝无样式错乱或被覆盖问题。
- 🔒 **100% 本地离线与隐私保护**：基于轻量级纯前端引擎 `jsQR`，所有图像解码与数据处理均在浏览器本地完成，**不发起任何外部网络请求，不收集任何用户隐私**。
- 🚀 **突破跨域与防盗链限制**：后台 Service Worker 跨域 Fetch 与页面 DOM 元素抓取双通道兜底，从容应对外链跨域图、防盗链图、Base64 内联图、Blob 临时对象等各种复杂场景。
- 🧠 **智能内容识别与分类**：
  - **网址链接**：一键在新标签页安全打开，防止钓鱼风险。
  - **WiFi 网络码**：自动解析并结构化显示网络名称 (SSID)、密码及加密协议。
  - **纯文本**：一键复制到剪贴板，支持键盘 `Esc` 键快捷关闭。
- ⚡ **多功能工具栏面板 (Popup)**：
  - **截图扫码**：支持直接按 `Ctrl + V` 粘贴剪切板中的任意截图快速识别。
  - **拖拽上传**：支持本地图片直接拖拽或点击选取解析。
  - **二维码生成**：输入任意文本或一键提取当前页面网址生成清晰二维码，支持一键下载 PNG。
  - **历史记录**：自动记录近期扫描内容，支持随时回看与清空。
- 🌓 **现代深色模式**：自动跟随操作系统 `prefers-color-scheme` 切换暗黑风格。

---

## 📸 界面预览

| 网页右键扫描结果弹窗 | 工具栏快速识别与生成面板 |
| :---: | :---: |
| 原地弹出 Shadow DOM 优雅卡片，支持分类与一键复制/直达 | 支持拖拽、Ctrl+V 截图粘贴、二维码生成与历史记录 |

---

## 📥 安装指南

### 方式一：开发者模式加载（推荐，免编译）

1. 点击 GitHub 右上角绿色按钮 **Code -> Download ZIP** 或通过 Git 克隆到本地：
   ```bash
   git clone https://github.com/Aclguh/QRcode-rightclick.git
   ```
2. 打开 Chromium 内核浏览器（如 **Google Chrome**、**Microsoft Edge**、**Brave** 等），在地址栏输入：
   - Chrome：`chrome://extensions/`
   - Edge：`edge://extensions/`
3. 打开右上角的 **「开发者模式」 (Developer mode)** 开关。
4. 点击左上角的 **「加载已解压的扩展程序」 (Load unpacked)**。
5. 选择刚克隆/解压的 `qrcode-rightclick` 项目根目录，即可完成安装！

### 方式二：使用 Release 离线安装包

1. 前往 GitHub 仓库的 **Releases** 页面下载最新版本的 `qrcode-scanner-vX.X.X.zip`。
2. 解压到本地任意固定文件夹。
3. 按照上述方式进入浏览器扩展管理页，点击「加载已解压的扩展程序」选择该文件夹即可。

---

## 🛠️ 项目目录结构

```text
qrcode-rightclick/
├── manifest.json              # 核心扩展清单 (Manifest V3 规范)
├── background.js              # 后台 Service Worker (上下文菜单、跨域图像提取与解码)
├── content.js                 # 网页内容脚本 (Shadow DOM 弹窗注入与 DOM 图像兜底)
├── content.css                # 宿主页面挂载重置样式
├── popup/
│   ├── popup.html             # 工具栏弹出层界面
│   ├── popup.css              # 弹出层深色/浅色样式
│   └── popup.js               # 粘贴、文件拖拽扫码、二维码生成与历史记录管理
├── lib/
│   ├── jsQR.js                # 纯 JavaScript 离线二维码识别引擎
│   └── qrcode.js              # 纯前端二维码生成引擎 (支持多字节 UTF-8)
├── icons/                     # 高清矢量渲染应用图标集
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── _locales/                  # 国际化多语言支持
│   ├── zh_CN/messages.json    # 中文语言包
│   └── en/messages.json       # 英文语言包
├── scripts/
│   ├── test_qr.js             # 自动化测试用例
│   ├── generate_icons.js      # 图标生成辅助脚本
│   └── pack.js                # 自动打包发布脚本
├── LICENSE                    # MIT 开源协议
└── README.md                  # 说明文档
```

---

## 🧪 开发与测试

本项目采用原生现代 JavaScript (ES6+) 构建，无需任何复杂的打包工具或 Webpack/Vite 编译流程，开箱即改即测。

### 运行自动化测试套件
验证 `jsQR` 与 `qrcode` 在多字节中文、URL、WiFi 配置字符串等各种场景下的编码与解码准确率：
```bash
npm test
```

### 重新生成各尺寸高清图标
```bash
npm run icons
```

### 一键打包发布文件
生成适合发布到 GitHub Releases 的压缩包（输出至 `dist/` 目录）：
```bash
npm run pack
```

---

## 🔐 权限声明

本扩展遵循 Chrome 最小权限原则（Principle of Least Privilege），所有权限用途清晰透明：

| 权限名称 | 申请用途说明 |
| :--- | :--- |
| `contextMenus` | 用于在鼠标右键图片的系统菜单中注册「扫描图片中的二维码」菜单项。 |
| `activeTab` / `scripting` | 用于在用户点击扫描时，向当前网页注入结果展示弹窗（Shadow DOM）。 |
| `storage` | 用于在用户本地浏览器持久化保存最近的扫码记录（上限 50 条）。 |
| `host_permissions: ["<all_urls>"]` | 仅用于后台 Service Worker 读取防盗链或受 CORS 限制的跨域图片二进制流以进行解码。扩展不向任何第三方服务器发送任何数据。 |

---

## 🤝 贡献与反馈

欢迎提交 Issue 或 Pull Request！
1. Fork 本项目
2. 创建您的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的修改 (`git commit -m 'feat: Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启一个 Pull Request

---

## 📄 开源许可证

本项目基于 [MIT License](LICENSE) 开源，欢迎自由学习、使用与二次开发。
