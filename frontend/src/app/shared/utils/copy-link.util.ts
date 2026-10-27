import type { ToastService } from '@app/core/services/toast/toast';
import type { TranslateService } from '@app/core/services/translate/translate';

export async function copyPageLink(
  toast: ToastService,
  translate: TranslateService,
): Promise<void> {
  try {
    await navigator.clipboard.writeText(location.href);
    toast.success(translate.get('creation.link_copied'));
  } catch {
    toast.error(translate.get('creation.link_copy_failed'));
  }
}
