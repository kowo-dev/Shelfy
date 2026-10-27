import { TestBed } from '@angular/core/testing';

import { CommentVoteComponent } from './comment-vote';

describe('CommentVoteComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommentVoteComponent],
    }).compileComponents();
  });

  function createComponent() {
    return TestBed.createComponent(CommentVoteComponent);
  }

  it('shows the score label when net score is positive', () => {
    const fixture = createComponent();
    fixture.componentRef.setInput('upvotes', 5);
    fixture.componentRef.setInput('downvotes', 2);
    fixture.detectChanges();

    const span = fixture.nativeElement.querySelector('span.tabular-nums');
    expect(span?.textContent?.trim()).toBe('3');
  });

  it('hides the score label when net score is not positive', () => {
    const fixture = createComponent();
    fixture.componentRef.setInput('upvotes', 1);
    fixture.componentRef.setInput('downvotes', 4);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('span.tabular-nums')).toBeNull();
  });

  it('emits voteChange(1) when the upvote button is clicked', () => {
    const fixture = createComponent();
    fixture.componentRef.setInput('upvotes', 0);
    fixture.componentRef.setInput('downvotes', 0);
    fixture.detectChanges();

    const emitted: number[] = [];
    fixture.componentInstance.voteChange.subscribe((v) => emitted.push(v));

    const buttons = fixture.nativeElement.querySelectorAll('button');
    (buttons[0] as HTMLButtonElement).click();

    expect(emitted).toEqual([1]);
  });

  it('emits voteChange(-1) when the downvote button is clicked', () => {
    const fixture = createComponent();
    fixture.componentRef.setInput('upvotes', 0);
    fixture.componentRef.setInput('downvotes', 0);
    fixture.detectChanges();

    const emitted: number[] = [];
    fixture.componentInstance.voteChange.subscribe((v) => emitted.push(v));

    const buttons = fixture.nativeElement.querySelectorAll('button');
    (buttons[1] as HTMLButtonElement).click();

    expect(emitted).toEqual([-1]);
  });

  it('does not emit when disabled', () => {
    const fixture = createComponent();
    fixture.componentRef.setInput('upvotes', 0);
    fixture.componentRef.setInput('downvotes', 0);
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    const emitted: number[] = [];
    fixture.componentInstance.voteChange.subscribe((v) => emitted.push(v));

    fixture.componentInstance.toggle(1);

    expect(emitted).toEqual([]);
  });

  it('reflects myVote via aria-pressed', () => {
    const fixture = createComponent();
    fixture.componentRef.setInput('upvotes', 0);
    fixture.componentRef.setInput('downvotes', 0);
    fixture.componentRef.setInput('myVote', 1);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('button');
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
    expect(buttons[1].getAttribute('aria-pressed')).toBe('false');
  });
});
