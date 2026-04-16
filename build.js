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
  
  try {
    const result = await Terser.minify(combinedContent, {
      compress: {
        passes: 2,
        dead_code: true,
        drop_debugger: true,
        keep_fargs: false,
        reduce_funcs: true
      },
      mangle: {
        keep_fnames: false,
        properties: false
      },
      output: {
        comments: false,
        beautify: false,
        preamble: '/*! MFA Hijack Validator */'
      },
      sourceMap: false
    });

    if (result.error) {
      console.error('Minification failed:', result.error);
      process.exit(1);
    }

    // 验证压缩后的代码
    const minifiedCode = result.code;
    if (!minifiedCode || minifiedCode.length === 0) {
      console.error('Minification produced empty output');
      process.exit(1);
    }

    // 检查代码是否以 '<' 开头（这表示生成失败）
    if (minifiedCode.trim().startsWith('<')) {
      console.error('Minification produced invalid output (starts with "<")');
      console.error('First 100 chars:', minifiedCode.substring(0, 100));
      process.exit(1);
    }

    fs.writeFileSync(minifiedPath, minifiedCode, 'utf8');
  } catch (error) {
    console.error('Minification process failed:', error.message);
    process.exit(1);
  }

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

