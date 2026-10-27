import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@app/core/services/translate/translate';

import { EntitySortComponent } from './entity-sort';

describe('EntitySortComponent', () => {
  function create() {
    TestBed.configureTestingModule({
      imports: [EntitySortComponent],
      providers: [
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    });
    const fixture = TestBed.createComponent(EntitySortComponent);
    fixture.componentRef.setInput('options', [
      { id: 'popularity', label: 'Popularity', natural: 'desc' },
      { id: 'title', label: 'Title', natural: 'asc' },
    ]);
    fixture.componentRef.setInput('sort', 'popularity');
    fixture.componentRef.setInput('direction', 'desc');
    fixture.detectChanges();
    return fixture;
  }

  it('shows the current sort and its direction', () => {
    const fixture = create();
    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('Popularity');
    expect(text).toContain('entity.direction.popularity.desc');
  });

  it('switches sort with its natural direction and lets the direction change', () => {
    const fixture = create();
    const sorts: string[] = [];
    const directions: string[] = [];
    fixture.componentInstance.sortChange.subscribe((sort) => sorts.push(sort));
    fixture.componentInstance.directionChange.subscribe((dir) => directions.push(dir));
    const el = fixture.nativeElement as HTMLElement;

    (el.querySelector('button[aria-haspopup]') as HTMLButtonElement).click();
    fixture.detectChanges();
    const radios = Array.from(el.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    radios[0].click();
    expect(sorts).toEqual([]);
    radios[1].click();
    expect(sorts).toEqual(['title']);
    expect(directions).toEqual(['asc']);

    radios[3].click();
    expect(directions).toEqual(['asc', 'asc']);
  });

  it('closes on escape and on outside clicks', () => {
    const fixture = create();
    fixture.componentInstance.open.set(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(fixture.componentInstance.open()).toBe(false);

    fixture.componentInstance.open.set(true);
    document.body.click();
    expect(fixture.componentInstance.open()).toBe(false);
  });
});
