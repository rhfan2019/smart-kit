/** Chinese texts of the controls (docs/26), spread into messages.zh.ts. */
import { dialogsZh } from './controls/dialogs.zh';
import { displayZh } from './controls/display.zh';
import { messagesZh } from './controls/messages.zh';
import { p13nZh } from './controls/p13n.zh';
import { processZh } from './controls/process.zh';
import type { controlsEn } from './messages.controls.en';

export const controlsZh = { ...messagesZh, ...displayZh, ...processZh, ...dialogsZh, ...p13nZh } as unknown as typeof controlsEn;
