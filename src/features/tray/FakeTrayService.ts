import { success } from '@/features/storage/repository-result';
import type { TrayEvents, TrayService, WindowState } from './TrayService';

export class FakeTrayService implements TrayService {
  events: TrayEvents | null = null;
  actions: string[] = [];
  autostart = false;
  visibility: WindowState = { visible: true, minimized: false, focused: true };
  launchArguments: readonly string[] = [];
  pendingArguments: readonly string[][] = [];
  async observe(events: TrayEvents) {
    this.events = events;
    if (events.arguments) {
      const pending = this.pendingArguments;
      this.pendingArguments = [];
      for (const launchArguments of pending) {
        const handled = await events.arguments(launchArguments);
        if (!handled.ok) events.error(handled.error);
      }
    }
    return Promise.resolve(
      success(() => {
        if (this.events === events) this.events = null;
      }),
    );
  }
  show() {
    this.actions.push('show');
    this.visibility = { visible: true, minimized: false, focused: true };
    return Promise.resolve(success(undefined));
  }
  hide() {
    this.actions.push('hide');
    this.visibility.visible = false;
    this.visibility.focused = false;
    return Promise.resolve(success(undefined));
  }
  minimize() {
    this.actions.push('minimize');
    this.visibility.minimized = true;
    this.visibility.focused = false;
    return Promise.resolve(success(undefined));
  }
  windowState() {
    return Promise.resolve(success({ ...this.visibility }));
  }
  initialArguments() {
    return Promise.resolve(success(this.launchArguments));
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
