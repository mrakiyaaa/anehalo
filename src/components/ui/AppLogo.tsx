import { Icon } from '@/components/ui/Icon';

const logos = import.meta.glob<string>('/src/assets/logo.png', {
  eager: true,
  query: '?url',
  import: 'default',
});
const logo = logos['/src/assets/logo.png'];

export function AppLogo() {
  return logo ? (
    <img className="brand-image" src={logo} alt="" draggable={false} data-tauri-drag-region />
  ) : (
    <Icon name="pen" />
  );
}
