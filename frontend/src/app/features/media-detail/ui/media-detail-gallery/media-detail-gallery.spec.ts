import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@app/core/services/translate/translate';

import { MediaDetailGalleryComponent } from './media-detail-gallery';

describe('MediaDetailGalleryComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MediaDetailGalleryComponent],
      providers: [
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    }).compileComponents();
  });

  it('renders nothing when there are no images', () => {
    const fixture = TestBed.createComponent(MediaDetailGalleryComponent);
    fixture.componentRef.setInput('images', []);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('section')).toBeNull();
  });

  it('emits the clicked image through imageSelected', () => {
    const fixture = TestBed.createComponent(MediaDetailGalleryComponent);
    fixture.componentRef.setInput('images', ['/a.jpg', '/b.jpg']);
    fixture.detectChanges();

    const emitted: string[] = [];
    fixture.componentInstance.imageSelected.subscribe((image) => emitted.push(image));

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    expect(buttons.length).toBe(2);
    buttons[1].click();

    expect(emitted).toEqual(['/b.jpg']);
  });
});
