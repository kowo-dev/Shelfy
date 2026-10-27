import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@app/core/services/translate/translate';

import { VersusBracketProgressComponent } from './versus-bracket-progress';

describe('VersusBracketProgressComponent', () => {
  function setup(currentRound: number, roundsTotal: number, bracketSize = 16, matchSlotIndex = 0) {
    TestBed.configureTestingModule({
      imports: [VersusBracketProgressComponent],
      providers: [
        { provide: TranslateService, useValue: { get: (key: string) => key, lang: () => 'en' } },
      ],
    });
    const fixture = TestBed.createComponent(VersusBracketProgressComponent);
    fixture.componentRef.setInput('currentRound', currentRound);
    fixture.componentRef.setInput('roundsTotal', roundsTotal);
    fixture.componentRef.setInput('bracketSize', bracketSize);
    fixture.componentRef.setInput('matchSlotIndex', matchSlotIndex);
    fixture.detectChanges();
    return fixture;
  }

  it('says the round in words, without a progress bar', () => {
    const fixture = setup(1, 4);
    const host: HTMLElement = fixture.nativeElement;
    expect(host.textContent).toContain('versus.play.round');
    expect(host.querySelector('[role="progressbar"]')).toBeNull();
  });

  it('computes the remaining choices in the current round', () => {
    const fixture = setup(1, 4, 16, 3);
    expect(fixture.componentInstance.choicesRemaining()).toBe(5);
  });

  it('accounts for slot index in a later round', () => {
    const fixture = setup(3, 4, 16, 1);
    expect(fixture.componentInstance.choicesRemaining()).toBe(1);
  });
});
