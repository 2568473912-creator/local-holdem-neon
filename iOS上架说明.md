# iPad App Store 上架说明

当前仓库已经接入 `Capacitor iOS shell`，目标为 `iPad only`，并固定为横屏使用。

## 当前已具备
- Web 前端可正常 `build`
- 已生成原生 iOS 工程：`ios/App`
- 已接入：
  - `manifest.webmanifest`
  - `apple-touch-icon`
  - `service worker`
  - iPad 安装提示 / 横屏提示
  - `iPad only` 原生目标
  - `UIRequiresFullScreen = true`

## 调试机器建议具备
- 完整 `Xcode.app`
- Apple ID / Apple Developer Team（真机签名要用）
- `CocoaPods` 可选：当前这套 Capacitor 8 iOS 工程走 Swift Package，不装也能调试

## 本机后续操作
### 1. 安装完整 Xcode
- 从 App Store 安装 `Xcode`
- 然后执行：

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
```

### 2. 安装 CocoaPods（建议）
```bash
sudo gem install cocoapods
```

### 3. 同步前端到 iOS 工程
```bash
npm install
npm run mobile:ios:prepare
```

### 4. 打开 iOS 工程
```bash
npm run mobile:ios:open
```

如果 `cap open ios` 无法直接调起，也可以手动打开：
- `ios/App/App.xcodeproj`

## Xcode 里要做的事
### 1. 签名
- 选中 `App` target
- `Signing & Capabilities`
- 选择你的 `Team`
- 确认 `Bundle Identifier`

当前默认 Bundle ID：
- `com.klaywei.neoncardclub`

上架前建议改成你自己名下可用的唯一 ID。

### 2. 版本号
- `MARKETING_VERSION`
- `CURRENT_PROJECT_VERSION`

当前默认：
- `1.0`
- `1`

### 3. App 图标 / 启动图
- 当前项目已经有基础图标资源
- 如果要正式上架，建议再在 Xcode 的 `Assets.xcassets` 中人工校验一次品牌图标和启动图观感

### 4. 设备方向
- 当前原生目标为 `iPad only`
- 当前原生层和 Web 层都以横屏为准

## 上架前还需要准备
- App Store Connect 新建 App
- 隐私标签（Privacy Nutrition Labels）
- 应用截图：
  - 11 英寸 iPad
  - 13 英寸 iPad
- 应用描述、关键词、分类、年龄分级
- 支持 URL / 隐私政策 URL

当前仓库已提供基础材料：
- App Store 文案模板：`app-store/AppStore元数据-zh-CN.md`
- 审核备注模板：`app-store/AppReviewNotes.md`
- 上架检查清单：`app-store/上架检查清单.md`
- 静态隐私页：`public/privacy.html`
- 静态支持页：`public/support.html`
- 截图脚本：`npm run appstore:shots:ipad`

说明：
- `Support URL` 建议最终指向你部署后的 `support.html`
- `Privacy Policy URL` 建议最终指向你部署后的 `privacy.html`
- 这两个 URL 仍需要你放到真实 HTTPS 域名上，仓库当前只提供静态页面与文案模板

## 建议的 App Store 定位
- 名称：`夜局`
- 副标题：`德州 · 斗地主 · 21 点 · 百家乐`
- 分类：`Games`

## 审核风险提醒
- 当前产品是本地单机多玩法牌桌，不涉及真实货币赌博后端。
- 上架时不要在文案里强调“真钱”“提现”“押注兑换”等内容。
- 保持为娱乐和单机训练产品，更稳。

## 已验证的命令
```bash
npm run build
npm run mobile:ios:sync
```

## 当前生成的关键文件
- `capacitor.config.ts`
- `ios/App/App.xcodeproj/project.pbxproj`
- `ios/App/App/Info.plist`
- `public/manifest.webmanifest`
- `public/sw.js`
- `public/apple-touch-icon.png`
