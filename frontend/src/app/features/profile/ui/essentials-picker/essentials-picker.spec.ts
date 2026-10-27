import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { CollectionService } from '@app/core/services/collection/collection';
import type { CollectionItemResponse } from '@app/core/services/collection/collection.model';
import type { EssentialEntry } from '@app/core/services/essentials/essentials.model';
import { TranslateService } from '@app/core/services/translate/translate';
import { EssentialsPickerComponent } from './essentials-picker';

const item = (id: string) =>
  ({
    id,
    media: { id: `m-${id}`, mediaType: 'movie', externalId: id, title: id, coverUrl: null },
  }) as unknown as CollectionItemResponse;

const entry = (id: string, slot: number) =>
  ({ slot, userMediaId: id, media: item(id).media }) as EssentialEntry;

describe('EssentialsPickerComponent', () => {
  function render(entries: EssentialEntry[], shelf: string[]) {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [EssentialsPickerComponent],
      providers: [
        {
          provide: CollectionService,
          useValue: {
            list: () =>
              of({ content: shelf.map(item), page: 0, size: 48, totalElements: shelf.length }),
          },
        },
        {
          provide: TranslateService,
          useValue: { get: (key: string) => key, lang: () => 'en' },
        },
      ],
    });
    const fixture = TestBed.createComponent(EssentialsPickerComponent);
    fixture.componentRef.setInput('entries', entries);
    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);
    fixture.detectChanges();
    vi.advanceTimersByTime(300);
    fixture.detectChanges();
    vi.useRealTimers();
    const tile = (id: string) =>
      document.querySelector<HTMLButtonElement>(`shelfy-pick-tile button[aria-label="${id}"]`)!;
    const save = () =>
      [...document.querySelectorAll<HTMLButtonElement>('footer button')].find((button) =>
        button.textContent?.includes('profile.essentials.save'),
      )!;
    const click = (element: HTMLElement) => {
      element.click();
      fixture.detectChanges();
    };
    return { tile, save, click, saved };
  }

  afterEach(() => document.body.querySelectorAll('shelfy-dialog').forEach((el) => el.remove()));

  it('checks the current Essentials and saves additions after it', () => {
    const { tile, save, click, saved } = render([entry('a', 0)], ['a', 'b', 'c']);
    expect(tile('a').getAttribute('aria-pressed')).toBe('true');

    click(tile('c'));
    const order = [...document.querySelectorAll('shelfy-pick-tile button')].map((button) =>
      button.getAttribute('aria-label'),
    );
    expect(order).toEqual(['a', 'c', 'b']);
    click(save());

    expect(saved).toHaveBeenCalledWith(['a', 'c']);
  });

  it('stops at five titles', () => {
    const shelf = ['a', 'b', 'c', 'd', 'e', 'f'];
    const { tile, save, click, saved } = render([], shelf);

    shelf.forEach((id) => click(tile(id)));
    click(save());

    expect(tile('f').getAttribute('aria-pressed')).toBe('false');
    expect(saved).toHaveBeenCalledWith(['a', 'b', 'c', 'd', 'e']);
  });

  it('unchecks a title to remove it', () => {
    const { tile, save, click, saved } = render([entry('a', 0), entry('b', 1)], ['a', 'b']);

    click(tile('a'));
    click(save());

    expect(saved).toHaveBeenCalledWith(['b']);
  });
});
