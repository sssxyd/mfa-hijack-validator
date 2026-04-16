(function(global) {
"use strict";
function getFieldValue(selector) {
    const element = document.querySelector(selector);
    if (!element) {
        return null;
    }
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        return element.value;
    }
    if (element instanceof HTMLSelectElement) {
        return element.value;
    }
    return element.textContent;
}
/**
 * 设备检测：判断是否为移动设备
 */
function isMobileDevice() {
    if (typeof navigator === 'undefined') {
        return false;
    }
    // 通过User-Agent判断
    const userAgent = navigator.userAgent.toLowerCase();
    const mobileKeywords = ['mobile', 'android', 'iphone', 'ipad', 'ipod', 'windows phone', 'blackberry', 'opera mini'];
    if (mobileKeywords.some(keyword => userAgent.includes(keyword))) {
        return true;
    }
    // 通过触摸事件判断
    if (typeof window !== 'undefined' && 'ontouchstart' in window) {
        return true;
    }
    // 通过屏幕宽度判断（iPad等大屏设备）
    if (window.innerWidth < 768) {
        return true;
    }
    return false;
}
/**
 * 获取响应式样式配置
 */
function getResponsiveConfig(isMobile) {
    if (isMobile) {
        // 移动设备配置
        return {
            modal: {
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(0, 0, 0, 0.5)'
            },
            panel: {
                width: 'auto',
                minWidth: '280px',
                maxWidth: '85%',
                padding: '20px 16px',
                borderRadius: '8px',
                maxHeight: '70vh',
                overflow: 'auto'
            },
            title: {
                fontSize: '16px',
                marginBottom: '12px'
            },
            input: {
                padding: '10px',
                fontSize: '16px',
                marginBottom: '12px',
                borderRadius: '4px',
                border: '1px solid #d9d9d9'
            },
            actions: {
                gap: '8px'
            },
            button: {
                flex: 1,
                padding: '10px',
                fontSize: '14px',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer'
            }
        };
    }
    else {
        // 电脑端配置
        return {
            modal: {
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(0, 0, 0, 0.45)'
            },
            panel: {
                width: 'auto',
                minWidth: '280px',
                maxWidth: '400px',
                padding: '20px',
                borderRadius: '8px',
                maxHeight: '80vh',
                overflow: 'auto'
            },
            title: {
                fontSize: '16px',
                marginBottom: '12px'
            },
            input: {
                padding: '8px',
                fontSize: '14px',
                marginBottom: '12px',
                borderRadius: '4px',
                border: '1px solid #d9d9d9'
            },
            actions: {
                gap: '8px'
            },
            button: {
                flex: 1,
                padding: '8px 16px',
                fontSize: '14px',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer'
            }
        };
    }
}
const MODAL_ID = 'mfa-hijack-validator-modal';
const allowedClickElements = new WeakSet();
function initMFAHijackValidator(options) {
    var _a;
    console.log('MFAHijackValidator init');
    console.log('Click selectors:', options.clickSelector);
    console.log('Enter selectors:', options.enterSelector);
    // 至少需要一个 selector（click 或 enter）
    const hasClickSelector = options.clickSelector && (Array.isArray(options.clickSelector) ? options.clickSelector.length > 0 : true);
    const hasEnterSelector = options.enterSelector && (Array.isArray(options.enterSelector) ? options.enterSelector.length > 0 : true);
    if (!hasClickSelector && !hasEnterSelector) {
        throw new Error('At least one of guardedClickSelector or guardedEnterSelector is required');
    }
    let pendingElement = null;
    let pendingEventType = 'click'; // 记录触发方式
    const maxAttempts = (_a = options.maxVerifyAttempts) !== null && _a !== void 0 ? _a : 1; // 默认最多验证1次
    let verifySuccessCount = 0; // 验证成功计数器
    const clickSelectors = [];
    if (hasClickSelector && options.clickSelector) {
        if (Array.isArray(options.clickSelector)) {
            clickSelectors.push(...options.clickSelector);
        }
        else {
            clickSelectors.push(options.clickSelector);
        }
    }
    const enterSelectors = [];
    if (hasEnterSelector && options.enterSelector) {
        if (Array.isArray(options.enterSelector)) {
            enterSelectors.push(...options.enterSelector);
        }
        else {
            enterSelectors.push(options.enterSelector);
        }
    }
    // 检测selector是否存在的辅助函数
    const detectSelectors = () => {
        let clickExists = false;
        let enterExists = false;
        for (const selector of clickSelectors) {
            if (document.querySelector(selector)) {
                clickExists = true;
                console.log(`✓ Click selector found: "${selector}"`);
                break;
            }
        }
        for (const selector of enterSelectors) {
            if (document.querySelector(selector)) {
                enterExists = true;
                console.log(`✓ Enter selector found: "${selector}"`);
                break;
            }
        }
        return { clickExists, enterExists };
    };
    // 初始化时检测一次
    const initialDetection = detectSelectors();
    // selectorsFound: 只要配置的selector都找到了就算找到
    // 例：只配置了clickSelector -> 只需clickExists为true
    //     都配置了 -> 都需要为true
    let selectorsFound = (clickSelectors.length === 0 || initialDetection.clickExists) &&
        (enterSelectors.length === 0 || initialDetection.enterExists);
    if (!initialDetection.clickExists && clickSelectors.length > 0) {
        console.warn('⚠ No click selector found on page. Will work after DOM update.');
    }
    if (!initialDetection.enterExists && enterSelectors.length > 0) {
        console.warn('⚠ No enter selector found on page. Will work after DOM update.');
    }
    // 自动检测 mutation observer
    let mutationObserver = null;
    const enableAutoRedetect = () => {
        if (mutationObserver) {
            return; // 已经启用
        }
        if (options.autoRedetect === false) {
            return;
        }
        console.log('🔍 Auto-redetect enabled. Listening for DOM changes until selectors are found...');
        mutationObserver = new MutationObserver(() => {
            if (selectorsFound) {
                // 已经找到了，不再检测
                return;
            }
            const detection = detectSelectors();
            // 检查是否现在找到了之前没找到的selector
            const clickNowExists = detection.clickExists || clickSelectors.length === 0;
            const enterNowExists = detection.enterExists || enterSelectors.length === 0;
            if (clickNowExists && enterNowExists) {
                console.log('✨ All selectors found! Stopping auto-redetect.');
                selectorsFound = true;
                // 停止监听，因为已经找到了
                if (mutationObserver) {
                    mutationObserver.disconnect();
                    mutationObserver = null;
                }
            }
        });
        mutationObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: false,
            characterData: false
        });
    };
    // 如果初始selector未完全找到，且autoRedetect为true，启用自动检测
    if (!selectorsFound && options.autoRedetect !== false) {
        enableAutoRedetect();
    }
    const triggerMFA = (element, eventType = 'click') => {
        // 检查是否已达到最大验证次数
        if (verifySuccessCount >= maxAttempts) {
            return false;
        }
        pendingElement = element;
        pendingEventType = eventType; // 记录事件类型
        // 获取 uid 并发送验证码
        (async () => {
            try {
                const uid = options.uidSelector ? getFieldValue(options.uidSelector) : null;
                const result = await options.sendCode(uid);
                if (!result.success) {
                    openModal(options, '', () => pendingElement, () => {
                        pendingElement = null;
                    }, () => {
                        verifySuccessCount++;
                    }, result.message, pendingEventType);
                    return;
                }
                openModal(options, result.id, () => pendingElement, () => {
                    pendingElement = null;
                }, () => {
                    verifySuccessCount++; // 验证成功，计数器加1
                }, undefined, pendingEventType);
            }
            catch (error) {
                console.error('获取验证码失败:', error);
            }
        })();
        return true;
    };
    const clickListener = (event) => {
        const target = event.target;
        if (!(target instanceof Element)) {
            return;
        }
        console.log('Click detected on:', target, 'Selectors to check:', clickSelectors);
        // 检查是否匹配任何一个 selector
        let guardedElement = null;
        for (const selector of clickSelectors) {
            let matched = null;
            // 方法1：检查 target 本身是否匹配选择器
            try {
                if (target.matches(selector)) {
                    matched = target;
                    console.log('Element matched directly with selector:', selector);
                }
            }
            catch (e) {
                // 某些复杂选择器可能不支持 matches
            }
            // 方法2：检查 target 的祖先是否匹配
            if (!matched) {
                matched = target.closest(selector);
            }
            // 方法3：如果前两种方法都失败，查询所有匹配的元素并检查 target 是否在其中
            if (!matched && typeof document.querySelector === 'function') {
                const allMatched = document.querySelectorAll(selector);
                console.log(`Selector "${selector}" found ${allMatched.length} elements`);
                for (let i = 0; i < allMatched.length; i++) {
                    if (allMatched[i] === target || allMatched[i].contains(target)) {
                        matched = allMatched[i];
                        console.log('Matched with querySelector:', matched);
                        break;
                    }
                }
            }
            if (matched) {
                console.log('Element matched with selector:', selector);
                guardedElement = matched;
                break;
            }
        }
        if (!guardedElement) {
            console.log('No element matched any selector');
            return;
        }
        // 如果已达到最大验证次数，允许默认行为执行
        if (verifySuccessCount >= maxAttempts) {
            return; // 不阻止默认行为
        }
        if (!triggerMFA(guardedElement, 'click')) {
            return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
    };
    const keydownListener = (event) => {
        if (event.key !== 'Enter') {
            return;
        }
        const target = event.target;
        if (!(target instanceof Element)) {
            return;
        }
        // 检查是否匹配任何一个 enter selector
        let guardedElement = null;
        for (const selector of enterSelectors) {
            let matched = null;
            // 方法1：检查 target 本身是否匹配选择器
            try {
                if (target.matches(selector)) {
                    matched = target;
                }
            }
            catch (e) {
                // 某些复杂选择器可能不支持 matches
            }
            // 方法2：检查 target 的祖先是否匹配
            if (!matched) {
                matched = target.closest(selector);
            }
            // 方法3：如果前两种方法都失败，查询所有匹配的元素并检查 target 是否在其中
            if (!matched && typeof document.querySelector === 'function') {
                const allMatched = document.querySelectorAll(selector);
                for (let i = 0; i < allMatched.length; i++) {
                    if (allMatched[i] === target || allMatched[i].contains(target)) {
                        matched = allMatched[i];
                        break;
                    }
                }
            }
            if (matched) {
                guardedElement = matched;
                break;
            }
        }
        if (!guardedElement) {
            return;
        }
        // 如果已达到最大验证次数，允许默认行为执行
        if (verifySuccessCount >= maxAttempts) {
            return; // 不阻止默认行为
        }
        if (!triggerMFA(guardedElement, 'keydown')) {
            return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
    };
    document.addEventListener('click', clickListener, true);
    if (enterSelectors.length > 0) {
        document.addEventListener('keydown', keydownListener, true);
    }
    return {
        destroy: () => {
            document.removeEventListener('click', clickListener, true);
            document.removeEventListener('keydown', keydownListener, true);
            if (mutationObserver) {
                mutationObserver.disconnect();
                mutationObserver = null;
            }
            closeModal();
        },
        redetect: () => {
            console.log('🔄 Redetecting selectors...');
            const detection = detectSelectors();
            if (!detection.clickExists && !detection.enterExists) {
                console.warn('⚠ No selectors found after redetection');
            }
        }
    };
}
function openModal(options, mfaSessionId, getPendingElement, clearPendingElement, onVerifySuccess, initialError, pendingEventType = 'click') {
    var _a, _b, _c, _d;
    const isMobile = isMobileDevice();
    const config = getResponsiveConfig(isMobile);
    const existing = document.getElementById(MODAL_ID);
    if (existing) {
        existing.remove();
    }
    const modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.style.position = 'fixed';
    modal.style.left = '0';
    modal.style.top = '0';
    modal.style.width = config.modal.width;
    modal.style.height = config.modal.height;
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    modal.style.backgroundColor = config.modal.backgroundColor;
    modal.style.zIndex = '2147483647';
    const panel = document.createElement('div');
    panel.style.backgroundColor = '#fff';
    panel.style.borderRadius = config.panel.borderRadius;
    panel.style.padding = config.panel.padding;
    panel.style.width = config.panel.width;
    panel.style.minWidth = config.panel.minWidth;
    panel.style.maxWidth = config.panel.maxWidth;
    panel.style.boxSizing = 'border-box';
    panel.style.fontFamily = 'Arial, sans-serif';
    panel.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.2)';
    panel.style.maxHeight = config.panel.maxHeight;
    panel.style.overflow = config.panel.overflow;
    const title = document.createElement('h3');
    title.textContent = (_a = options.title) !== null && _a !== void 0 ? _a : 'MFA 验证';
    title.style.margin = '0 0 ' + config.title.marginBottom;
    title.style.fontSize = config.title.fontSize;
    title.style.fontWeight = '500';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = (_b = options.inputPlaceholder) !== null && _b !== void 0 ? _b : '请输入验证码';
    input.autocomplete = 'one-time-code';
    input.inputMode = 'numeric'; // 移动设备弹出数字键盘
    input.disabled = !!initialError; // 如果有初始错误，禁用输入框
    input.style.width = '100%';
    input.style.padding = config.input.padding;
    input.style.marginBottom = config.input.marginBottom;
    input.style.boxSizing = 'border-box';
    input.style.fontSize = config.input.fontSize;
    input.style.borderRadius = config.input.borderRadius;
    input.style.border = config.input.border;
    const message = document.createElement('div');
    message.style.color = '#c92a2a';
    message.style.fontSize = isMobile ? '14px' : '12px';
    message.style.minHeight = '16px';
    message.style.marginBottom = isMobile ? '16px' : '12px';
    message.style.wordBreak = 'break-word';
    // 如果有初始错误信息（例如发送验证码失败），直接显示
    if (initialError) {
        message.textContent = initialError;
    }
    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.justifyContent = 'flex-end';
    actions.style.gap = config.actions.gap;
    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.textContent = (_c = options.cancelText) !== null && _c !== void 0 ? _c : '取消';
    cancelButton.style.flex = isMobile ? '1' : 'auto';
    cancelButton.style.padding = config.button.padding;
    cancelButton.style.fontSize = config.button.fontSize;
    cancelButton.style.borderRadius = config.button.borderRadius;
    cancelButton.style.border = config.button.border;
    cancelButton.style.backgroundColor = isMobile ? '#f5f5f5' : '#fafafa';
    cancelButton.style.cursor = config.button.cursor;
    const confirmButton = document.createElement('button');
    confirmButton.type = 'button';
    confirmButton.textContent = (_d = options.confirmText) !== null && _d !== void 0 ? _d : '验证';
    confirmButton.disabled = !!initialError; // 如果有初始错误，禁用确认按钮
    confirmButton.style.flex = isMobile ? '1' : 'auto';
    confirmButton.style.padding = config.button.padding;
    confirmButton.style.fontSize = config.button.fontSize;
    confirmButton.style.borderRadius = config.button.borderRadius;
    confirmButton.style.border = config.button.border;
    confirmButton.style.backgroundColor = '#1890ff';
    confirmButton.style.color = '#fff';
    confirmButton.style.cursor = config.button.cursor;
    const closeAndClear = () => {
        clearPendingElement();
        closeModal();
    };
    cancelButton.addEventListener('click', closeAndClear);
    cancelButton.addEventListener('mouseover', () => {
        if (!isMobile) {
            cancelButton.style.backgroundColor = '#f0f0f0';
        }
    });
    cancelButton.addEventListener('mouseout', () => {
        if (!isMobile) {
            cancelButton.style.backgroundColor = '#fafafa';
        }
    });
    confirmButton.addEventListener('click', async () => {
        var _a, _b;
        const code = input.value.trim();
        const currentPending = getPendingElement();
        if (!currentPending) {
            closeModal();
            return;
        }
        message.textContent = '';
        confirmButton.disabled = true;
        try {
            const result = await options.verifyCode(mfaSessionId, code);
            if (!result.success) {
                // 验证失败，显示错误信息
                message.textContent = result.message || ((_a = options.errorText) !== null && _a !== void 0 ? _a : '验证码错误，请重试');
                input.value = '';
                input.focus();
                return;
            }
            if (onVerifySuccess) {
                onVerifySuccess(); // 调用计数器增加回调
            }
            closeAndClear();
            // 根据触发方式重放对应的事件
            if (pendingEventType === 'keydown') {
                // 重放 Enter 键事件
                const keyEvent = new KeyboardEvent('keydown', {
                    key: 'Enter',
                    code: 'Enter',
                    bubbles: true,
                    cancelable: true,
                    view: window
                });
                currentPending.dispatchEvent(keyEvent);
            }
            else {
                // 重放 click 事件
                const clickEvent = new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window
                });
                currentPending.dispatchEvent(clickEvent);
            }
        }
        catch (_c) {
            message.textContent = (_b = options.errorText) !== null && _b !== void 0 ? _b : '验证码错误，请重试';
            input.value = '';
            input.focus();
        }
        finally {
            confirmButton.disabled = false;
        }
    });
    confirmButton.addEventListener('mouseover', () => {
        if (!isMobile) {
            confirmButton.style.backgroundColor = '#40a9ff';
        }
    });
    confirmButton.addEventListener('mouseout', () => {
        if (!isMobile) {
            confirmButton.style.backgroundColor = '#1890ff';
        }
    });
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            confirmButton.click();
        }
    });
    actions.appendChild(cancelButton);
    actions.appendChild(confirmButton);
    panel.appendChild(title);
    panel.appendChild(input);
    panel.appendChild(message);
    panel.appendChild(actions);
    modal.appendChild(panel);
    document.body.appendChild(modal);
    // 移动设备点击背景关闭
    if (isMobile) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeAndClear();
            }
        });
    }
    input.focus();
}
function closeModal() {
    const modal = document.getElementById(MODAL_ID);
    if (modal) {
        modal.remove();
    }
}
// 导出为全局方法（在 IIFE 中通过 global 参数传入）
if (typeof global !== 'undefined') {
    global.initMFAHijackValidator = initMFAHijackValidator;
}

})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : {});