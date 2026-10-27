export function markBrokenImages(root: Document): void {
  const mark = (broken: boolean) => (event: Event) => {
    const target = event.target;
    if (!(target instanceof HTMLImageElement)) return;
    if (broken) target.dataset['broken'] = '';
    else delete target.dataset['broken'];
  };
  root.addEventListener('error', mark(true), true);
  root.addEventListener('load', mark(false), true);
}
