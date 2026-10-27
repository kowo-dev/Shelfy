import { TestBed } from '@angular/core/testing';

import { ImageLightboxComponent } from './image-lightbox';

describe('ImageLightboxComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImageLightboxComponent],
    }).compileComponents();
  });

  function createComponent(images: string[], startIndex = 0) {
    const fixture = TestBed.createComponent(ImageLightboxComponent);
    fixture.componentRef.setInput('images', images);
    fixture.componentRef.setInput('startIndex', startIndex);
    fixture.detectChanges();
    return fixture;
  }

  it('renders the image at the start index', () => {
    const fixture = createComponent(['a.jpg', 'b.jpg', 'c.jpg'], 1);
    const img = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('b.jpg');
  });

  it('does not show navigation buttons for a single image', () => {
    const fixture = createComponent(['a.jpg']);
    expect(fixture.nativeElement.querySelectorAll('button').length).toBe(2);
  });

  it('shows navigation buttons for multiple images', () => {
    const fixture = createComponent(['a.jpg', 'b.jpg']);
    expect(fixture.componentInstance.hasMultipleImages()).toBe(true);
  });

  it('next()/previous() wrap around the image list', () => {
    const fixture = createComponent(['a.jpg', 'b.jpg', 'c.jpg'], 2);
    const component = fixture.componentInstance;

    component.next();
    expect(component.currentImage()).toBe('a.jpg');

    component.previous();
    component.previous();
    expect(component.currentImage()).toBe('b.jpg');
  });

  it('emits closed when the backdrop button is clicked', () => {
    const fixture = createComponent(['a.jpg']);
    const emitted: void[] = [];
    fixture.componentInstance.closed.subscribe(() => emitted.push(undefined));

    const backdrop = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    backdrop.click();

    expect(emitted.length).toBe(1);
  });

  it('Escape key emits closed', () => {
    const fixture = createComponent(['a.jpg', 'b.jpg']);
    const emitted: void[] = [];
    fixture.componentInstance.closed.subscribe(() => emitted.push(undefined));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(emitted.length).toBe(1);
  });

  it('ArrowRight navigates to the next image when there are multiple images', () => {
    const fixture = createComponent(['a.jpg', 'b.jpg']);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(fixture.componentInstance.currentImage()).toBe('b.jpg');
  });

  it('currentImage() is null when there are no images', () => {
    const fixture = createComponent([]);
    expect(fixture.componentInstance.currentImage()).toBeNull();
  });
});
