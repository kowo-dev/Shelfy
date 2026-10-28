import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateService } from '@app/core/services/translate/translate';
import { BackLinkComponent, type BackTarget, exploreBack } from './back-link';

describe('BackLinkComponent', () => {
  function render(target: BackTarget) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: TranslateService,
          useValue: {
            get: (key: string, params?: Record<string, string>) =>
              params ? `${key}:${params['page']}` : key,
            lang: () => 'en',
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(BackLinkComponent);
    fixture.componentRef.setInput('target', target);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector('a')!;
  }

  it('links to its fixed parent with the query kept', () => {
    const link = render({ to: ['/creations'], query: { f: 'lists' }, label: 'Creations' });

    expect(link.getAttribute('href')).toBe('/creations?f=lists');
    expect(link.getAttribute('aria-label')).toBe('nav.back_to:Creations');
  });

  it('falls back to a plain back label without a parent name', () => {
    const link = render({ to: ['/media', 'movie', '1'] });

    expect(link.getAttribute('aria-label')).toBe('nav.back');
  });

  it('sends catalogue pages to Explore filtered on their type', () => {
    expect(exploreBack('anime', 'Explore').query).toEqual({ type: 'anime' });
    expect(exploreBack(null, 'Explore').query).toBeNull();
  });
});
