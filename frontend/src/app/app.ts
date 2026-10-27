import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppUpdateService } from './core/services/app-update/app-update';

@Component({
  imports: [RouterOutlet],
  selector: 'shelfy-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('shelfy');

  constructor() {
    inject(AppUpdateService).watch(inject(DestroyRef));
  }
}
