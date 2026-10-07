const modalState = new WeakMap();
let modalSequence = 0;

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

const getFocusable = (element) => Array.from(element.querySelectorAll(focusableSelector));

export default {
  mounted(element) {
    const previousFocus = document.activeElement;
    element.setAttribute('role', 'dialog');
    element.setAttribute('aria-modal', 'true');
    element.setAttribute('tabindex', '-1');

    const heading = element.querySelector('h1, h2, h3');
    if (heading) {
      if (!heading.id) heading.id = `ootie-dialog-title-${++modalSequence}`;
      element.setAttribute('aria-labelledby', heading.id);
    } else if (!element.hasAttribute('aria-label')) {
      element.setAttribute('aria-label', '對話框');
    }

    const handleKeydown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        element.querySelector('.modal-close')?.click();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = getFocusable(element);
      if (!items.length) {
        event.preventDefault();
        element.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    element.addEventListener('keydown', handleKeydown);
    modalState.set(element, { previousFocus, handleKeydown });
    queueMicrotask(() => (getFocusable(element)[0] || element).focus());
  },

  unmounted(element) {
    const state = modalState.get(element);
    if (!state) return;
    element.removeEventListener('keydown', state.handleKeydown);
    if (state.previousFocus && typeof state.previousFocus.focus === 'function' && document.contains(state.previousFocus)) {
      state.previousFocus.focus();
    }
    modalState.delete(element);
  }
};
