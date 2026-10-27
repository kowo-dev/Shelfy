import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { ItemSheetService } from '@app/core/services/item-sheet/item-sheet';
import { ShelfLookupService } from '@app/core/services/shelf-lookup/shelf-lookup';
import { TranslateService } from '@app/core/services/translate/translate';
import { buildPreviewItem } from '@app/features/discover/data-access/discover-preview.util';
import { MediaCardComponent } from './media-card';

const ITEM = buildPreviewItem('movie', 1, 'Movie A', null, 7, null, {});

@Component({
  imports: [MediaCardComponent],
  template: `<shelfy-media-card [item]="item" [addable]="false" [mine]="mine" [tinted]="true">
    <button cardOverlay type="button" class="overlay" (click)="removed = true">x</button>
  </shelfy-media-card>`,
})
class HostComponent {
  item = ITEM;
  mine = false;
  removed = false;
}

describe('MediaCardComponent', () => {
  let navigate: ReturnType<typeof vi.fn>;
  let openSheet: ReturnType<typeof vi.fn>;

  function create(mine = false, item = ITEM) {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideRouter([]),
        { provide: ShelfLookupService, useValue: { find: () => null, request: vi.fn() } },
        { provide: ItemSheetService, useValue: { open: (openSheet = vi.fn()) } },
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true) as never;
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.mine = mine;
    fixture.componentInstance.item = item;
    fixture.detectChanges();
    return fixture;
  }

  it('opens the media page when the card is clicked', () => {
    const fixture = create();

    fixture.nativeElement.querySelector('article').click();

    expect(navigate).toHaveBeenCalledWith(['/media', 'movie', '1']);
  });

  it('runs an overlay button without opening the media page', () => {
    const fixture = create();

    fixture.nativeElement.querySelector('.overlay').click();

    expect(fixture.componentInstance.removed).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('opens the edit sheet instead of the page for an item of my library', () => {
    const fixture = create(true);

    fixture.nativeElement.querySelector('article').click();

    expect(openSheet).toHaveBeenCalledWith(ITEM);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('greys an external rating and colours a personal one', () => {
    const star = (item = ITEM) =>
      (create(false, item).nativeElement.querySelector('.v-star') as HTMLElement).style.color;

    expect(star()).toBe('');
    TestBed.resetTestingModule();
    expect(star({ ...ITEM, userId: 'u1' })).not.toBe('');
  });
});
