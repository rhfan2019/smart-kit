/** English texts of the controls (docs/26), spread into messages.en.ts. One file per group in ./controls. */
import { dialogsEn } from './controls/dialogs.en';
import { displayEn } from './controls/display.en';
import { messagesEn } from './controls/messages.en';
import { processEn } from './controls/process.en';

export const controlsEn = { ...messagesEn, ...displayEn, ...processEn, ...dialogsEn };
