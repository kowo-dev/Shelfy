import { TestBed } from '@angular/core/testing';
import type { CollectionVisibility } from '@app/core/services/auth/auth.model';
import { PublishDialogComponent } from './publish-dialog';

describe('PublishDialogComponent', () => {
  function open(current: CollectionVisibility, shared = false) {
    TestBed.overrideComponent(PublishDialogComponent, { set: { template: '', imports: [] } });
    const fixture = TestBed.createComponent(PublishDialogComponent);
    fixture.componentRef.setInput('current', current);
    fixture.componentRef.setInput('shared', shared);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('offers to publish a draft, starting on everyone', () => {
    const dialog = open('private');

    expect(dialog.choice()).toBe('public');
    expect(dialog.primaryKey()).toBe('studio.publish');
    dialog.choice.set('private');
    expect(dialog.primaryKey()).toBe('studio.keep_private');
  });

  it('reopens a published creation on its current visibility and saves the change', () => {
    const dialog = open('link');

    expect(dialog.choice()).toBe('link');
    expect(dialog.primaryKey()).toBe('studio.save_visibility');
  });

  it('says private means you and the co-authors once the creation is shared', () => {
    expect(open('private', true).keyFor('private')).toBe('private_shared');
  });

  it('says private means only me while nobody else is on the creation', () => {
    expect(open('private').keyFor('private')).toBe('private');
  });
});
