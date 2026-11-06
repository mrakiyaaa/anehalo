import { success } from '@/features/storage/repository-result';
import type { TrayEvents, TrayService } from './TrayService';

export class FakeTrayService implements TrayService {
  events: TrayEvents | null = null;
  actions: string[] = [];
  autostart = false;
  observe(events: TrayEvents) {
    this.events = events;
    return Promise.resolve(
      success(() => {
        if (this.events === events) this.events = null;
      }),
    );
  }
  show() {
    this.actions.push('show');
    return Promise.resolve(success(undefined));
  }
  hide() {
    this.actions.push('hide');
    return Promise.resolve(success(undefined));
  }
  quit() {
    this.actions.push('quit');
    return Promise.resolve(success(undefined));
  }
  setAutostart(enabled: boolean) {
    this.autostart = enabled;
    return Promise.resolve(success(undefined));
  }
  focusEditor() {
    this.actions.push('focus-editor');
  }
}
