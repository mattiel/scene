/**
 * @scene/a11y - Accessibility layer for Scene
 *
 * Provides DOM mirrors, focus synchronization, and ARIA announcements
 * for Canvas-Interactive mode (Mode B).
 */

export { LiveAnnouncer } from './LiveAnnouncer';
export type { Politeness, LiveAnnouncerConfig } from './LiveAnnouncer';

export { DOMMirror } from './DOMMirror';
export type { MirrorConfig, DOMMirrorConfig } from './DOMMirror';

export { FocusSync } from './FocusSync';
export type { FocusSyncConfig, NavigationAxis } from './FocusSync';

export { A11yManager } from './A11yManager';
export type { A11yManagerConfig } from './A11yManager';
