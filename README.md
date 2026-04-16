# MFA 劫持验证器

一个纯 TypeScript 编写的库，用于在网页中拦截用户的点击和回车事件，在执行操作前进行 MFA（多因素认证）验证。适用于需要额外安全保护的关键操作。

## 核心功能

- 🎯 **精准事件拦截**：支持通过 CSS selector 拦截指定元素的点击事件和 Enter 键事件
- 🔐 **灵活 MFA 流程**：集成验证码发送、验证和重试机制
- 📱 **响应式设计**：自动检测移动设备，提供适配不同屏幕的 UI 样式
- 🔄 **事件重放**：验证通过后自动重放被拦截的原始事件

## 安装依赖

```bash
npm install
```

## 编译

```bash
npm run build
```

编译后输出到 `lib/` 目录

## 基础使用示例

### HTML 集成

```html
<button id="loginBtn" class="need-mfa">登录</button>

<script src="lib/mfa-hijack-validator.1.0.3.min.js"></script>
<script>
  window.initMFAHajackValidator({
    uidSelector: '#username',           // 用户标识选择器（可选）
    clickSelector: '#loginBtn',         // 点击事件拦截选择器（可选）
    enterSelector: '#password',         // Enter键拦截选择器（可选）
    sendCode: async (uid) => {
      // 调用后端接口发送验证码
      const response = await fetch('/api/send-code', {
        method: 'POST',
        body: JSON.stringify({ uid })
      });
      const data = await response.json();
      return {
        success: data.success,
        id: data.sessionId,              // 验证码会话ID
        message: data.message
      };
    },
    verifyCode: async (id, code) => {
      // 调用后端接口验证验证码
      const response = await fetch('/api/verify-code', {
        method: 'POST',
        body: JSON.stringify({ id, code })
      });
      const data = await response.json();
      return {
        success: data.success,
        message: data.message             // 验证失败时的错误提示
      };
    }
  });
</script>
```

## 配置选项

### 必需配置

| 选项 | 类型 | 说明 |
|-----|------|------|
| `sendCode` | `(uid: string \| null) => Promise<{success: boolean, id: string, message: string}>` | 发送验证码的回调函数，返回会话ID用于后续验证 |
| `verifyCode` | `(id: string, code: string) => Promise<{success: boolean, message: string}>` | 验证验证码的回调函数，message 用于显示错误提示 |

### 选择器配置

| 选项 | 类型 | 默认值 | 说明 |
|-----|------|--------|------|
| `uidSelector` | `string \| null` | `null` | CSS selector，用于获取用户唯一标识（发送验证码时传递） |
| `clickSelector` | `string \| string[] \| null` | `null` | CSS selector 或数组，指定需要拦截的点击元素 |
| `enterSelector` | `string \| string[] \| null` | `null` | CSS selector 或数组，指定在 Enter 键时拦截的元素（如输入框） |

**注意**：`clickSelector` 和 `enterSelector` 至少需要配置一个

### UI 文本配置

| 选项 | 类型 | 默认值 | 说明 |
|-----|------|--------|------|
| `title` | `string` | `'MFA 验证'` | 验证框标题 |
| `confirmText` | `string` | `'验证'` | 确认按钮文本 |
| `cancelText` | `string` | `'取消'` | 取消按钮文本 |
| `inputPlaceholder` | `string` | `'请输入验证码'` | 验证码输入框占位符 |
| `errorText` | `string` | `'验证码错误，请重试'` | 通用错误提示 |

### 其他配置

| 选项 | 类型 | 默认值 | 说明 |
|-----|------|--------|------|
| `maxVerifyAttempts` | `number` | `1` | 最大验证次数限制，达到限制后不再拦截后续操作 |

## 高级示例

### 支持多个拦截选择器

```javascript
window.initMFAHajackValidator({
  uidSelector: '#userId',
  clickSelector: ['#deleteBtn', '#submitBtn', '.critical-action'],  // 多个选择器
  sendCode: async (uid) => { /* ... */ },
  verifyCode: async (id, code) => { /* ... */ }
});
```

### 自定义 UI 文本

```javascript
window.initMFAHajackValidator({
  clickSelector: '#pay',
  sendCode: async (uid) => { /* ... */ },
  verifyCode: async (id, code) => { /* ... */ },
  title: '支付验证',
  confirmText: '确认支付',
  cancelText: '取消支付',
  inputPlaceholder: '请输入短信验证码',
  errorText: '验证码输入错误，请检查后重试',
  maxVerifyAttempts: 3  // 允许多次操作
});
```

### 获取验证控制器销毁验证器

```javascript
const controller = window.initMFAHajackValidator({
  /* 配置项 */
});

// 需要时可销毁（移除所有事件监听）
controller.destroy();
```

## 事件流程

```
用户点击或按 Enter
    ↓
事件被拦截，发送验证码 sendCode()
    ↓
弹出 MFA 验证框
    ↓
用户输入验证码，点击验证按钮
    ↓
调用 verifyCode() 验证
    ↓
验证成功？
├─ 是 → 关闭验证框，重放原始事件
└─ 否 → 显示错误信息，等待重试
```

## 获取用户信息

设置 `uidSelector` 时，验证器会从指定的 DOM 元素中自动提取用户标识：

- **InputElement 和 TextareaElement**：获取 `value` 属性
- **SelectElement**：获取选中的 `value` 属性  
- **其他元素**：获取 `textContent` 文本内容

```html
<input id="username" type="text" value="john@example.com" />
<script>
  window.initMFAHajackValidator({
    uidSelector: '#username',  // 会获取输入框的值：'john@example.com'
    clickSelector: '#loginBtn',
    sendCode: async (uid) => {
      console.log('用户 ID:', uid);  // 输出：用户 ID: john@example.com
      // ...
    },
    verifyCode: async (id, code) => { /* ... */ }
  });
</script>
```

## 响应式设计

验证器根据设备类型自动调整 UI 样式：

- **桌面设备**：固定宽度对话框，优化鼠标交互
- **移动设备**：全屏或大型对话框，优化触摸交互
  - 自动弹出数字键盘
  - 点击背景可关闭验证框
  - 按钮宽度自动调整

## 完整工作示例

请查看 [example.html](example.html) 文件，它包含了一个完整的登录表单演示，展示如何集成 MFA 验证器。

## 编译输出文件

- `lib/mfa-hijack-validator.1.0.3.js` - 未压缩版本
- `lib/mfa-hijack-validator.1.0.3.min.js` - 压缩版本

## 浏览器兼容性

支持所有现代浏览器，需要 ES6 以上版本支持。
