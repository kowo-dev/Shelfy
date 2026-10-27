import { TestBed } from '@angular/core/testing';

import { ImportCardShellComponent } from './import-card-shell';

describe('ImportCardShellComponent', () => {
  function create(covers: string[]) {
    const fixture = TestBed.createComponent(ImportCardShellComponent);
    fixture.componentRef.setInput('icon', 'steam');
    fixture.componentRef.setInput('title', 'Steam');
    fixture.componentRef.setInput('covers', covers);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('lines the covers up in a strip', () => {
    const el = create(['a.jpg', 'b.jpg']);
    const images = el.querySelectorAll('img');
    expect(images.length).toBe(2);
    expect(images[0].getAttribute('loading')).toBe('lazy');
    expect(el.textContent).toContain('Steam');
  });

  it('falls back to the profile gradient without covers', () => {
    const el = create([]);
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('.bg-profile-fallback')).not.toBeNull();
  });
});
