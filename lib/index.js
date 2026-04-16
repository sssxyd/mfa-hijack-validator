"use strict";
const MODAL_ID = 'mfa-hajack-validator-modal';
const allowedClickElements = new WeakSet();
function initMFAHajackValidator(options) {
    if (!options.selector) {
        throw new Error('selector is required');
    }
    let pendingElement = null;
    const listener = (event) => {
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
function openModal(options, getPendingElement, clearPendingElement) {
    var _a, _b, _c, _d;
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
    title.textContent = (_a = options.title) !== null && _a !== void 0 ? _a : 'MFA 验证';
    title.style.margin = '0 0 12px';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = (_b = options.inputPlaceholder) !== null && _b !== void 0 ? _b : '请输入验证码';
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
    cancelButton.textContent = (_c = options.cancelText) !== null && _c !== void 0 ? _c : '取消';
    const confirmButton = document.createElement('button');
    confirmButton.type = 'button';
    confirmButton.textContent = (_d = options.confirmText) !== null && _d !== void 0 ? _d : '验证';
    const closeAndClear = () => {
        clearPendingElement();
        closeModal();
    };
    cancelButton.addEventListener('click', closeAndClear);
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
            const verified = await options.verifyCode(code, currentPending);
            if (!verified) {
                message.textContent = (_a = options.errorText) !== null && _a !== void 0 ? _a : '验证码错误，请重试';
                return;
            }
            allowedClickElements.add(currentPending);
            closeAndClear();
            currentPending.click();
        }
        catch (_c) {
            message.textContent = (_b = options.errorText) !== null && _b !== void 0 ? _b : '验证码错误，请重试';
        }
        finally {
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
function closeModal() {
    const modal = document.getElementById(MODAL_ID);
    if (modal) {
        modal.remove();
    }
}
window.initMFAHajackValidator = initMFAHajackValidator;
