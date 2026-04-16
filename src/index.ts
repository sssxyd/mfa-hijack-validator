/**
 * 根据 CSS selector 获取元素的值
 * 支持获取：input/textarea/select 的 value，其他元素的 textContent
 */
declare const global: any;

function getFieldValue(selector: string): string | null {
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
function isMobileDevice(): boolean {
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
function getResponsiveConfig(isMobile: boolean) {
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
  } else {
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

interface MFAHajackValidatorOptions {
  uidSelector: string | null; // 用户唯一标识选择器
  clickSelector?: string | string[] | null; // click 事件选择器（可选）
  enterSelector?: string | string[] | null; // enter 事件选择器（可选）
  sendCode: (uid: string | null) => Promise<{ success: boolean; id: string; message: string }>; // 发送验证码函数，返回 {success, id, message}
  verifyCode: (id: string, code: string) => Promise<{ success: boolean; message: string }>; // 返回 {success, message}，message 为错误信息
  title?: string;
  confirmText?: string;
  cancelText?: string;
  inputPlaceholder?: string;
  errorText?: string;
  maxVerifyAttempts?: number; // 最大验证次数，默认为1
}

interface MFAHajackValidatorController {
  destroy: () => void;
}

const MODAL_ID = 'mfa-hajack-validator-modal';
const allowedClickElements = new WeakSet<HTMLElement>();

function initMFAHajackValidator(options: MFAHajackValidatorOptions): MFAHajackValidatorController {
  // 至少需要一个 selector（click 或 enter）
  const hasClickSelector = options.clickSelector && (Array.isArray(options.clickSelector) ? options.clickSelector.length > 0 : true);
  const hasEnterSelector = options.enterSelector && (Array.isArray(options.enterSelector) ? options.enterSelector.length > 0 : true);
  
  if (!hasClickSelector && !hasEnterSelector) {
    throw new Error('At least one of guardedClickSelector or guardedEnterSelector is required');
  }

  let pendingElement: HTMLElement | null = null;
  const maxAttempts = options.maxVerifyAttempts ?? 1; // 默认最多验证1次
  let verifySuccessCount = 0; // 验证成功计数器
  
  const clickSelectors: string[] = [];
  if (hasClickSelector && options.clickSelector) {
    if (Array.isArray(options.clickSelector)) {
      clickSelectors.push(...options.clickSelector);
    } else {
      clickSelectors.push(options.clickSelector);
    }
  }
  
  const enterSelectors: string[] = [];
  if (hasEnterSelector && options.enterSelector) {
    if (Array.isArray(options.enterSelector)) {
      enterSelectors.push(...options.enterSelector);
    } else {
      enterSelectors.push(options.enterSelector);
    }
  }

  const triggerMFA = (element: HTMLElement) => {
    // 检查是否已达到最大验证次数
    if (verifySuccessCount >= maxAttempts) {
      return false;
    }

    pendingElement = element;

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
          }, result.message);
          return;
        }
        openModal(options, result.id, () => pendingElement, () => {
          pendingElement = null;
        }, () => {
          verifySuccessCount++; // 验证成功，计数器加1
        });
      } catch (error) {
        console.error('获取验证码失败:', error);
      }
    })();

    return true;
  };

  const clickListener = (event: MouseEvent): void => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    // 检查是否匹配任何一个 selector
    let guardedElement: HTMLElement | null = null;
    for (const selector of clickSelectors) {
      guardedElement = target.closest(selector) as HTMLElement | null;
      if (guardedElement) {
        break;
      }
    }
    if (!guardedElement) {
      return;
    }

    // 如果该元素在允许列表中，说明已通过 MFA 验证，允许默认行为执行
    if (allowedClickElements.has(guardedElement)) {
      allowedClickElements.delete(guardedElement);
      return; // 不阻止默认行为
    }

    if (!triggerMFA(guardedElement)) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
  };

  const keydownListener = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter') {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    // 检查是否匹配任何一个 enter selector
    let guardedElement: HTMLElement | null = null;
    for (const selector of enterSelectors) {
      guardedElement = target.closest(selector) as HTMLElement | null;
      if (guardedElement) {
        break;
      }
    }
    if (!guardedElement) {
      return;
    }

    if (!triggerMFA(guardedElement)) {
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
      closeModal();
    }
  };
}

function openModal(
  options: MFAHajackValidatorOptions,
  mfaSessionId: string,
  getPendingElement: () => HTMLElement | null,
  clearPendingElement: () => void,
  onVerifySuccess?: () => void,
  initialError?: string
): void {
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
  title.textContent = options.title ?? 'MFA 验证';
  title.style.margin = '0 0 ' + config.title.marginBottom;
  title.style.fontSize = config.title.fontSize;
  title.style.fontWeight = '500';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = options.inputPlaceholder ?? '请输入验证码';
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
  cancelButton.textContent = options.cancelText ?? '取消';
  cancelButton.style.flex = isMobile ? '1' : 'auto';
  cancelButton.style.padding = config.button.padding;
  cancelButton.style.fontSize = config.button.fontSize;
  cancelButton.style.borderRadius = config.button.borderRadius;
  cancelButton.style.border = config.button.border;
  cancelButton.style.backgroundColor = isMobile ? '#f5f5f5' : '#fafafa';
  cancelButton.style.cursor = config.button.cursor;

  const confirmButton = document.createElement('button');
  confirmButton.type = 'button';
  confirmButton.textContent = options.confirmText ?? '验证';
  confirmButton.disabled = !!initialError; // 如果有初始错误，禁用确认按钮
  confirmButton.style.flex = isMobile ? '1' : 'auto';
  confirmButton.style.padding = config.button.padding;
  confirmButton.style.fontSize = config.button.fontSize;
  confirmButton.style.borderRadius = config.button.borderRadius;
  confirmButton.style.border = config.button.border;
  confirmButton.style.backgroundColor = '#1890ff';
  confirmButton.style.color = '#fff';
  confirmButton.style.cursor = config.button.cursor;

  const closeAndClear = (): void => {
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
        message.textContent = result.message || (options.errorText ?? '验证码错误，请重试');
        input.value = '';
        input.focus();
        return;
      }

      if (onVerifySuccess) {
        onVerifySuccess(); // 调用计数器增加回调
      }
      allowedClickElements.add(currentPending);
      closeAndClear();
      currentPending.click();
    } catch {
      message.textContent = options.errorText ?? '验证码错误，请重试';
      input.value = '';
      input.focus();
    } finally {
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

function closeModal(): void {
  const modal = document.getElementById(MODAL_ID);
  if (modal) {
    modal.remove();
  }
}

// 导出为全局方法（在 IIFE 中通过 global 参数传入）
if (typeof (global as any) !== 'undefined') {
  (global as any).initMFAHajackValidator = initMFAHajackValidator;
}
