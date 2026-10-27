import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { VolumeControlComponent } from '@shared/ui/volume-control/volume-control';
import { ClipPlaybackService } from './clip-playback';

@Component({
  selector: 'shelfy-clip-volume',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [VolumeControlComponent],
  host: { class: 'pointer-coarse:hidden' },
  template: `
    <shelfy-volume-control
      [value]="playback.volume()"
      [muted]="playback.muted()"
      (valueChange)="playback.setVolume($event)"
      (mutedChange)="playback.setMuted($event)"
    />
  `,
})
export class ClipVolumeComponent {
  protected readonly playback = inject(ClipPlaybackService);
}
