import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { TranslateService } from '@app/core/services/translate/translate';
import type { SearchResult } from '@app/core/services/search/search.model';

import { BannerPickerDialogComponent, type BannerCandidate } from './banner-picker-dialog';

describe('BannerPickerDialogComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BannerPickerDialogComponent],
      providers: [
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    }).compileComponents();
  });

  function candidate(title = 'Movie'): BannerCandidate {
    return {
      result: { title, provider: 'tmdb', mediaType: 'movie', externalId: '1' } as SearchResult,
      coverUrl: 'https://img/cover.jpg',
    };
  }

  function create() {
    const fixture = TestBed.createComponent(BannerPickerDialogComponent);
    fixture.componentRef.setInput('query', '');
    fixture.componentRef.setInput('results', []);
    fixture.componentRef.setInput('loading', false);
    fixture.componentRef.setInput('loadingMore', false);
    fixture.componentRef.setInput('hasMore', false);
    fixture.componentRef.setInput('unavailableProviders', []);
    fixture.componentRef.setInput('selectedMedia', null);
    fixture.componentRef.setInput('images', []);
    fixture.componentRef.setInput('imagesLoading', false);
    fixture.componentRef.setInput('saving', false);
    fixture.componentRef.setInput('selectedImage', null);
    fixture.componentRef.setInput('imagePosition', 50);
    fixture.detectChanges();
    return fixture;
  }

  it('shows the shelf shortcut when the query is empty', () => {
    const fixture = create();
    fixture.componentRef.setInput('shelfResults', [candidate('Dune')]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('profile.banner.shelf_heading');
    expect(fixture.nativeElement.textContent).toContain('Dune');
  });

  it('offers an automatic choice ahead of the shelf titles when asked', () => {
    const fixture = create();
    fixture.componentRef.setInput('shelfResults', [candidate('Dune')]);
    fixture.componentRef.setInput('autoOption', true);
    fixture.componentRef.setInput('autoActive', true);
    fixture.componentRef.setInput('autoLabel', 'Automatic');
    fixture.componentRef.setInput('title', 'Shelf banner');
    fixture.componentRef.setInput('previewTitle', 'My shelf');
    fixture.detectChanges();
    const spy = vi.fn();
    fixture.componentInstance.autoChosen.subscribe(spy);
    const root = fixture.nativeElement as HTMLElement;
    const auto = root.querySelector<HTMLButtonElement>('button[aria-pressed]')!;

    expect(auto.textContent).toContain('Automatic');
    expect(auto.getAttribute('aria-pressed')).toBe('true');
    expect(root.textContent).toContain('Shelf banner');
    expect(root.textContent).toContain('My shelf');
    expect(root.querySelector('shelfy-avatar')).toBeNull();
    auto.click();
    expect(spy).toHaveBeenCalled();
  });

  it('emits queryChange when typing in the search bar', () => {
    const fixture = create();
    const spy = vi.fn();
    fixture.componentInstance.queryChange.subscribe(spy);

    fixture.componentInstance.queryChange.emit('matrix');

    expect(spy).toHaveBeenCalledWith('matrix');
  });

  it('shows results and emits mediaSelected on click', () => {
    const fixture = create();
    fixture.componentRef.setInput('query', 'matrix');
    fixture.componentRef.setInput('results', [candidate('The Matrix')]);
    fixture.detectChanges();

    const spy = vi.fn();
    fixture.componentInstance.mediaSelected.subscribe(spy);
    const resultButton = fixture.nativeElement.querySelector('button.group') as HTMLButtonElement;
    resultButton.click();

    expect(spy).toHaveBeenCalled();
  });

  it('shows load more button when hasMore is true and emits loadMore', () => {
    const fixture = create();
    fixture.componentRef.setInput('query', 'matrix');
    fixture.componentRef.setInput('results', [candidate()]);
    fixture.componentRef.setInput('hasMore', true);
    fixture.detectChanges();

    const spy = vi.fn();
    fixture.componentInstance.loadMore.subscribe(spy);
    const loadMoreButton = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
      (btn) => (btn as HTMLButtonElement).textContent?.includes('load_more'),
    ) as HTMLButtonElement;
    loadMoreButton.click();

    expect(spy).toHaveBeenCalled();
  });

  it('shows the image grid once a media is selected and no image chosen yet', () => {
    const fixture = create();
    fixture.componentRef.setInput('selectedMedia', candidate('The Matrix'));
    fixture.componentRef.setInput('images', [{ url: 'https://img/1.jpg', label: 'Backdrop' }]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('The Matrix');
    expect(fixture.nativeElement.querySelector('button[aria-label="Backdrop"]')).not.toBeNull();
  });

  it('emits backToSearch when navigating back from the image step', () => {
    const fixture = create();
    fixture.componentRef.setInput('selectedMedia', candidate());
    fixture.detectChanges();
    const spy = vi.fn();
    fixture.componentInstance.backToSearch.subscribe(spy);

    const backButton = Array.from(fixture.nativeElement.querySelectorAll('button')).find((btn) =>
      (btn as HTMLButtonElement).textContent?.includes('choose_another'),
    ) as HTMLButtonElement;
    backButton.click();

    expect(spy).toHaveBeenCalled();
  });

  it('emits imageConfirmed with the current position when confirming', () => {
    const fixture = create();
    fixture.componentRef.setInput('selectedMedia', candidate());
    fixture.componentRef.setInput('selectedImage', { url: 'https://img/1.jpg', label: 'Poster' });
    fixture.componentRef.setInput('imagePosition', 30);
    fixture.detectChanges();
    const spy = vi.fn();
    fixture.componentInstance.imageConfirmed.subscribe(spy);

    const confirmButton = Array.from(fixture.nativeElement.querySelectorAll('button')).find((btn) =>
      (btn as HTMLButtonElement).textContent?.includes('use_banner'),
    ) as HTMLButtonElement;
    confirmButton.click();

    expect(spy).toHaveBeenCalledWith({ url: 'https://img/1.jpg', position: 30 });
  });

  it('updates the image position on pointer drag', () => {
    const fixture = create();
    fixture.componentRef.setInput('selectedMedia', candidate());
    fixture.componentRef.setInput('selectedImage', { url: 'https://img/1.jpg', label: 'Poster' });
    fixture.componentRef.setInput('imagePosition', 50);
    fixture.detectChanges();
    const spy = vi.fn();
    fixture.componentInstance.imagePositionChange.subscribe(spy);

    const dragArea = fixture.nativeElement.querySelector('[role="slider"]') as HTMLElement;
    Object.defineProperty(dragArea, 'clientHeight', { value: 200, configurable: true });
    dragArea.setPointerCapture = vi.fn();
    dragArea.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientY: 100 }));
    dragArea.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientY: 50 }));

    expect(spy).toHaveBeenCalled();

    dragArea.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
    expect(fixture.componentInstance['drag']).toBeNull();
  });

  it('ignores pointer move events from a different pointer', () => {
    const fixture = create();
    const component = fixture.componentInstance;
    const moveSpy = vi.fn();
    component.imagePositionChange.subscribe(moveSpy);

    component.onImagePointerMove(new PointerEvent('pointermove', { pointerId: 99, clientY: 10 }));

    expect(moveSpy).not.toHaveBeenCalled();
  });
});
