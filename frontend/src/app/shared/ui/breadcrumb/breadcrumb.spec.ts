import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateService } from '@app/core/services/translate/translate';

import { BreadcrumbComponent, type Crumb } from './breadcrumb';

describe('BreadcrumbComponent', () => {
  function render(trail: Crumb[], current: string) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    });
    const fixture = TestBed.createComponent(BreadcrumbComponent);
    fixture.componentRef.setInput('trail', trail);
    fixture.componentRef.setInput('current', current);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return {
      links: Array.from(el.querySelectorAll('a')).map((a) => a.getAttribute('href')),
      current: el.querySelector('[aria-current="page"]')?.textContent?.trim(),
      count: el.querySelectorAll('li').length,
    };
  }

  it('shows only the current page without a trail', () => {
    const view = render([], 'Shelf');

    expect(view.links).toEqual([]);
    expect(view.current).toBe('Shelf');
    expect(view.count).toBe(1);
  });

  it('links every parent and appends the current page', () => {
    const view = render(
      [{ label: 'Community', link: '/community', query: { f: 'lists' } }],
      'Best of',
    );

    expect(view.links).toEqual(['/community?f=lists']);
    expect(view.current).toBe('Best of');
  });

  it('uses a last crumb without link as the current page', () => {
    const view = render(
      [{ label: 'Dune', link: ['/media', 'movie', '1'] }, { label: 'Episodes' }],
      'Dune',
    );

    expect(view.links).toEqual(['/media/movie/1']);
    expect(view.current).toBe('Episodes');
    expect(view.count).toBe(2);
  });
});
