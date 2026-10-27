import { trapTab } from './focus-trap';

describe('trapTab', () => {
  let container: HTMLElement;
  let outside: HTMLButtonElement;
  let first: HTMLButtonElement;
  let hidden: HTMLButtonElement;
  let last: HTMLInputElement;

  const visible = (element: HTMLElement, shown: boolean) =>
    vi
      .spyOn(element, 'getClientRects')
      .mockReturnValue((shown ? [{}] : []) as unknown as DOMRectList);

  beforeEach(() => {
    document.body.innerHTML = `
      <button id="outside"></button>
      <div id="container">
        <button id="first"></button>
        <button tabindex="-1"></button>
        <button id="hidden"></button>
        <input id="last" />
      </div>`;
    container = document.getElementById('container')!;
    outside = document.getElementById('outside') as HTMLButtonElement;
    first = document.getElementById('first') as HTMLButtonElement;
    hidden = document.getElementById('hidden') as HTMLButtonElement;
    last = document.getElementById('last') as HTMLInputElement;
    for (const element of [first, last]) visible(element, true);
    visible(hidden, false);
  });

  const tab = (shiftKey = false) => {
    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, cancelable: true });
    trapTab(event, container);
    return event;
  };

  it('wraps from the last visible element back to the first', () => {
    last.focus();
    expect(tab().defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);
  });

  it('wraps backwards from the first element to the last, skipping hidden ones', () => {
    first.focus();
    expect(tab(true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
  });

  it('lets the browser move focus between elements in the middle', () => {
    first.focus();
    expect(tab().defaultPrevented).toBe(false);
  });

  it('pulls focus back in when it has escaped the container', () => {
    outside.focus();
    tab();
    expect(document.activeElement).toBe(first);
  });

  it('treats focus on the container itself as a starting point', () => {
    container.tabIndex = -1;
    container.focus();
    tab(true);
    expect(document.activeElement).toBe(last);
  });

  it('keeps focus on the container when nothing inside can take it', () => {
    container.innerHTML = '<button hidden></button>';
    container.tabIndex = -1;
    outside.focus();
    expect(tab().defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(container);
  });

  it('ignores keys other than Tab', () => {
    last.focus();
    const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    trapTab(event, container);
    expect(event.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(last);
  });
});
