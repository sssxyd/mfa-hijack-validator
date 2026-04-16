interface MFAHajackValidatorOptions {
  selector: string;
  verifyCode: (code: string, element: HTMLElement) => boolean | Promise<boolean>;
  title?: string;
  confirmText?: string;
  cancelText?: string;
  inputPlaceholder?: string;
  errorText?: string;
}

interface MFAHajackValidatorController {
  destroy: () => void;
}

interface Window {
  initMFAHajackValidator?: (options: MFAHajackValidatorOptions) => MFAHajackValidatorController;
}

const MODAL_ID = 'mfa-hajack-validator-modal';
const allowedClickElements = new WeakSet<HTMLElement>();

function initMFAHajackValidator(options: MFAHajackValidatorOptions): MFAHajackValidatorController {
  if (!options.selector) {
    throw new Error('selector is required');
  }

  let pendingElement: HTMLElement | null = null;

  const listener = (event: MouseEvent): void => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const guardedElement = target.closest(options.selector);
    if (!(guardedElement instanceof HTMLElement)) {
      return;
    }

    if (allowedClickElements.has(guardedElement)) {
      allowedClickElements.delete(guardedElement);
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    pendingElement = guardedElement;
    openModal(options, () => pendingElement, () => {
      pendingElement = null;
    });
  };

  document.addEventListener('click', listener, true);

  return {
    destroy: () => {
      document.removeEventListener('click', listener, true);
      closeModal();
    }
  };
}

function openModal(
  options: MFAHajackValidatorOptions,
  getPendingElement: () => HTMLElement | null,
  clearPendingElement: () => void
): void {
  const existing = document.getElementById(MODAL_ID);
  if (existing) {
    existing.remove();
  }

  const modal = document.createElement('div');
  modal.id = MODAL_ID;
  modal.style.position = 'fixed';
  modal.style.left = '0';
  modal.style.top = '0';
  modal.style.width = '100%';
  modal.style.height = '100%';
  modal.style.display = 'flex';
  modal.style.justifyContent = 'center';
  modal.style.alignItems = 'center';
  modal.style.backgroundColor = 'rgba(0, 0, 0, 0.45)';
  modal.style.zIndex = '2147483647';

  const panel = document.createElement('div');
  panel.style.backgroundColor = '#fff';
  panel.style.borderRadius = '8px';
  panel.style.padding = '20px';
  panel.style.width = '320px';
  panel.style.boxSizing = 'border-box';
  panel.style.fontFamily = 'Arial, sans-serif';
  panel.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.2)';

  const title = document.createElement('h3');
  title.textContent = options.title ?? 'MFA 验证';
  title.style.margin = '0 0 12px';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = options.inputPlaceholder ?? '请输入验证码';
  input.autocomplete = 'one-time-code';
  input.style.width = '100%';
  input.style.padding = '8px';
  input.style.marginBottom = '12px';
  input.style.boxSizing = 'border-box';

  const message = document.createElement('div');
  message.style.color = '#c92a2a';
  message.style.fontSize = '12px';
  message.style.minHeight = '16px';
  message.style.marginBottom = '12px';

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.justifyContent = 'flex-end';
  actions.style.gap = '8px';

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.textContent = options.cancelText ?? '取消';

  const confirmButton = document.createElement('button');
  confirmButton.type = 'button';
  confirmButton.textContent = options.confirmText ?? '验证';

  const closeAndClear = (): void => {
    clearPendingElement();
    closeModal();
  };

  cancelButton.addEventListener('click', closeAndClear);

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
      const verified = await options.verifyCode(code, currentPending);
      if (!verified) {
        message.textContent = options.errorText ?? '验证码错误，请重试';
        return;
      }

      allowedClickElements.add(currentPending);
      closeAndClear();
      currentPending.click();
    } catch {
      message.textContent = options.errorText ?? '验证码错误，请重试';
    } finally {
      confirmButton.disabled = false;
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
  input.focus();
}

function closeModal(): void {
  const modal = document.getElementById(MODAL_ID);
  if (modal) {
    modal.remove();
  }
}

window.initMFAHajackValidator = initMFAHajackValidator;
