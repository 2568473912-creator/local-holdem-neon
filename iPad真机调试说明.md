# iPad 真机调试说明

当前项目已经是 `iPad only`，并且原生方向已锁定为横屏。

## 准备工程

在项目根目录执行：

```bash
npm install
npm run mobile:ios:prepare
```

这一步会做两件事：
- 重新构建前端到 `dist`
- 把最新 web 资源同步进 `ios/App`

## 打开 Xcode

执行：

```bash
npm run mobile:ios:open
```

如果命令没自动拉起 Xcode，就手动打开：

- `ios/App/App.xcodeproj`

## Xcode 内要确认的内容

1. 选中 `App` target  
2. 打开 `Signing & Capabilities`
3. 确认：
   - `Team` 选你自己的 Apple ID / Developer Team
   - `Bundle Identifier` 可用

当前默认 Bundle ID：

- `com.klaywei.neoncardclub`

如果 Xcode 提示冲突，改成你自己名下唯一的 Bundle ID。

## 连接 iPad 真机

1. 用数据线连接 iPad
2. iPad 上点“信任此电脑”
3. 在 Xcode 顶部设备列表选择你的 iPad
4. 第一次真机调试时，如果提示开发者模式：
   - 到 iPad `设置 -> 隐私与安全性 -> 开发者模式`
   - 打开后重启设备

## 运行调试

在 Xcode 里按：

- `Product -> Run`
- 或快捷键 `Cmd + R`

## 常见问题

### 1. 提示签名失败

通常是：
- `Team` 没选
- `Bundle Identifier` 已被占用

先改这两个，再重试。

### 2. 打开后还是旧页面

先回项目根目录重新执行：

```bash
npm run mobile:ios:prepare
```

再回 Xcode 运行。

### 3. iPad 没出现在设备列表

检查：
- 数据线连接是否正常
- iPad 是否已点“信任”
- Finder / Xcode 是否已经识别设备

### 4. 方向不对

当前原生工程已经限制为横屏。如果还看到旋转异常，先把 iPad 自动旋转锁关闭后再试一次。
