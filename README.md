# mfa-hajack-validator

一个纯 TypeScript 项目，编译后输出 JS 脚本，可直接加挂到网站 `index` 页面。

功能：
- 监听页面上指定 `css-selector` 的点击
- 拦截点击并弹出 MFA 验证框
- 验证通过后，自动放行并重放被拦截的点击动作

## 安装依赖

```bash
npm install
```

## 编译

```bash
npm run build
```

编译产物：`lib/index.js`

## 页面接入示例

```html
<script src="/path/to/lib/index.js"></script>
<script>
  window.initMFAHajackValidator({
    selector: '.need-mfa',
    verifyCode: async function (code) {
      return code === '123456';
    }
  });
</script>
```
