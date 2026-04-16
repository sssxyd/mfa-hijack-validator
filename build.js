const fs = require('fs');
const path = require('path');
const Terser = require('terser');

// 主函数
async function build() {
  // 读取 package.json
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const projectName = packageJson.name;
  const version = packageJson.version;

  const libDir = path.join(__dirname, 'lib');
  const indexJsPath = path.join(libDir, 'index.js');

  // 读取编译后的 index.js
  let combinedContent = fs.readFileSync(indexJsPath, 'utf8');

  // 移除 CommonJS 相关代码
  combinedContent = combinedContent
    .replace(/^"use strict";\s*/m, '')
    .replace(/Object\.defineProperty\(exports,\s*"__esModule",\s*\{[^}]*\}\);?\s*/g, '')
    .replace(/exports\.(\w+)\s*=\s*(\w+);/g, '');

  // 用 IIFE 包装代码，将全局作用域作为参数传入
  combinedContent = `(function(global) {
"use strict";
${combinedContent}
})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : {});`;

  // 1. 生成不压缩版本（带版本号）
  const unminifiedFileName = `${projectName}.${version}.js`;
  const unminifiedPath = path.join(libDir, unminifiedFileName);
  fs.writeFileSync(unminifiedPath, combinedContent, 'utf8');

  // 2. 生成压缩版本（带版本号）
  const minifiedFileName = `${projectName}.${version}.min.js`;
  const minifiedPath = path.join(libDir, minifiedFileName);
  const result = await Terser.minify(combinedContent, {
    compress: true,
    mangle: true,
    output: {
      comments: false
    }
  });

  if (result.error) {
    console.error('Minification failed:', result.error);
    process.exit(1);
  }

  fs.writeFileSync(minifiedPath, result.code, 'utf8');

  // 3. 删除原始的 index.js 和 utils.js（因为已经合并）
  const filesToDelete = ['index.js', 'utils.js'];
  filesToDelete.forEach(file => {
    const filePath = path.join(libDir, file);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  });

  console.log(`✓ Build completed successfully!`);
  console.log(`  - Unminified: ${unminifiedFileName} (${(fs.statSync(unminifiedPath).size / 1024).toFixed(2)} KB)`);
  console.log(`  - Minified:   ${minifiedFileName} (${(fs.statSync(minifiedPath).size / 1024).toFixed(2)} KB)`);
}

// 执行构建
build().catch(error => {
  console.error('Build failed:', error);
  process.exit(1);
});

