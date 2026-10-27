import { ToastService } from './toast';

describe('ToastService', () => {
  it('runs a toast action once and closes the toast', () => {
    const service = new ToastService();
    const run = vi.fn();
    service.success('Removed', 5000, { label: 'Undo', run });
    const [toast] = service.toasts();

    service.act(toast.id);
    service.act(toast.id);

    expect(run).toHaveBeenCalledTimes(1);
    expect(service.toasts()).toEqual([]);
  });
});
