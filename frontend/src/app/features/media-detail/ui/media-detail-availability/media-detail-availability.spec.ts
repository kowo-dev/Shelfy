import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@app/core/services/translate/translate';

import { MediaDetailAvailabilityComponent } from './media-detail-availability';

describe('MediaDetailAvailabilityComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MediaDetailAvailabilityComponent],
      providers: [
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    }).compileComponents();
  });

  it('renders nothing when there are no steam app ids', () => {
    const fixture = TestBed.createComponent(MediaDetailAvailabilityComponent);
    fixture.componentRef.setInput('steamAppIds', []);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('section')).toBeNull();
  });

  it('renders one encoded Steam link per app id', () => {
    const fixture = TestBed.createComponent(MediaDetailAvailabilityComponent);
    fixture.componentRef.setInput('steamAppIds', ['1091500', '123 456']);
    fixture.detectChanges();

    const links = Array.from(fixture.nativeElement.querySelectorAll('a')) as HTMLAnchorElement[];
    expect(links.length).toBe(2);
    expect(links[0].getAttribute('href')).toBe('https://store.steampowered.com/app/1091500');
    expect(links[1].getAttribute('href')).toBe('https://store.steampowered.com/app/123%20456');
  });
});
