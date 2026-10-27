import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { SearchFocusService } from './search-focus';

describe('SearchFocusService', () => {
  function setup(url: string) {
    const navigate = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: { url, navigate } }],
    });
    return { service: TestBed.inject(SearchFocusService), navigate };
  }

  it('goes to Explore and asks for the search field focus', () => {
    const { service, navigate } = setup('/discover');

    service.open();

    expect(navigate).toHaveBeenCalledWith(['/explore']);
    expect(service.pending()).toBe(true);
  });

  it('starts a fresh search even when already on Explore', () => {
    const { service, navigate } = setup('/explore?type=game&with=fantasy');

    service.open();

    expect(navigate).toHaveBeenCalledWith(['/explore']);
    expect(service.pending()).toBe(true);
  });

  it('holds a focused field until Explore takes the focus, so mobile keeps its keyboard', () => {
    const { service } = setup('/discover');

    service.open();
    const proxy = document.activeElement as HTMLInputElement;
    expect(proxy.tagName).toBe('INPUT');

    proxy.blur();
    expect(proxy.isConnected).toBe(false);
  });
});
