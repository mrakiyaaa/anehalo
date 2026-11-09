import { failure } from '@/features/storage/repository-result';
import type { UpdateService } from './UpdateService';

const unavailable = () =>
  Promise.resolve(failure({ code: 'unavailable', message: 'Updates are not available here.' }));

/** Used where there is no desktop shell, such as the browser preview and most tests. */
export class DisabledUpdateService implements UpdateService {
  isSupported() {
    return Promise.resolve(false);
  }
  currentVersion() {
    return unavailable();
  }
  check() {
    return unavailable();
  }
  download() {
    return unavailable();
  }
  install() {
    return unavailable();
  }
  relaunch() {
    return unavailable();
  }
}
