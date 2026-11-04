import { APP_NAME } from '@/lib/constants';

export function TitleBar() {
  return (
    <header className="flex items-center border-b border-border bg-surface px-6">
      <h1 className="font-heading text-xl font-medium tracking-tight">{APP_NAME}</h1>
    </header>
  );
}
