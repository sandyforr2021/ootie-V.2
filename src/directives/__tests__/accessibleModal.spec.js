import { describe, expect, it } from 'vitest';

async function loadDirective() {
  return (await import('../accessibleModal')).default;
}

describe('accessible modal migration directive', () => {
  it('adds dialog semantics and focuses the first control', async () => {
    const directive = await loadDirective();
    const modal = document.createElement('section');
    modal.innerHTML = '<h2>標題</h2><button class="modal-close">關閉</button><button>動作</button>';
    document.body.appendChild(modal);

    directive.mounted(modal);
    await Promise.resolve();

    expect(modal.getAttribute('role')).toBe('dialog');
    expect(modal.getAttribute('aria-modal')).toBe('true');
    expect(modal.getAttribute('aria-labelledby')).toBe(modal.querySelector('h2').id);
    expect(document.activeElement).toBe(modal.querySelector('.modal-close'));
    directive.unmounted(modal);
    modal.remove();
  });

  it('closes with Escape through the existing close action', async () => {
    const directive = await loadDirective();
    const modal = document.createElement('section');
    modal.innerHTML = '<h2>標題</h2><button class="modal-close">關閉</button>';
    document.body.appendChild(modal);
    let clicked = 0;
    modal.querySelector('.modal-close').addEventListener('click', () => clicked++);

    directive.mounted(modal);
    modal.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(clicked).toBe(1);
    directive.unmounted(modal);
    modal.remove();
  });

  it('restores focus when the modal unmounts', async () => {
    const directive = await loadDirective();
    const trigger = document.createElement('button');
    trigger.textContent = '開啟';
    document.body.appendChild(trigger);
    trigger.focus();
    const modal = document.createElement('section');
    modal.innerHTML = '<h2>標題</h2><button class="modal-close">關閉</button>';
    document.body.appendChild(modal);

    directive.mounted(modal);
    directive.unmounted(modal);

    expect(document.activeElement).toBe(trigger);
    modal.remove();
    trigger.remove();
  });
});
