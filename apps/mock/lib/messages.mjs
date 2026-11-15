// Message texts of the purchasing services (English / Chinese by Accept-Language), and helpers for
// `sap-messages` entries and OData error bodies (ADR-023).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STATUS } from './purchasing.mjs';

const csdlDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'Csdl');
const LABELS = Object.fromEntries(['en', 'zh'].map((l) => [l, JSON.parse(readFileSync(join(csdlDir, `labels.${l}.json`), 'utf8'))]));

const TEXTS = {
  en: {
    approved: 'Purchase order {0} approved.',
    rejected: 'Purchase order {0} rejected.',
    closed: 'Purchase order {0} closed.',
    cannotApprove: 'Purchase order {0} cannot be approved in status {1}.',
    cannotReject: 'Purchase order {0} cannot be rejected in status {1}.',
    cannotClose: 'Purchase order {0} cannot be closed in status {1}.',
    noDescription: 'The purchase order has no description.',
    mandatory: 'Enter a value for "{0}".',
    unknownValue: 'The value "{1}" does not exist for "{0}".',
    positive: '"{0}" must be greater than 0.',
    dateTooLate: 'The order date must not be after 2099-12-31.',
    orderInvalid: 'The purchase order contains errors.',
    itemInvalid: 'The item contains errors.',
    locked: 'Locked by {0}.',
    editDraft: 'Edit the draft to change this object: the active version cannot be changed directly.',
    draftOnly: 'This action is only available for a draft.',
    activeOnly: 'This action is only available for the active version.',
    immutable: '"{0}" cannot be changed after the object has been created.',
  },
  zh: {
    approved: '采购订单 {0} 已审批。',
    rejected: '采购订单 {0} 已拒绝。',
    closed: '采购订单 {0} 已关闭。',
    cannotApprove: '采购订单 {0} 的状态为"{1}"，不能审批。',
    cannotReject: '采购订单 {0} 的状态为"{1}"，不能拒绝。',
    cannotClose: '采购订单 {0} 的状态为"{1}"，不能关闭。',
    noDescription: '采购订单没有描述。',
    mandatory: '请输入"{0}"。',
    unknownValue: '"{0}"的值"{1}"不存在。',
    positive: '"{0}"必须大于 0。',
    dateTooLate: '订单日期不能晚于 2099-12-31。',
    orderInvalid: '采购订单有错误。',
    itemInvalid: '项目有错误。',
    locked: '已被 {0} 锁定。',
    editDraft: '请编辑草稿：活动版本不能直接修改。',
    draftOnly: '此操作只适用于草稿。',
    activeOnly: '此操作只适用于活动版本。',
    immutable: '"{0}"在创建后不能更改。',
  },
};

/** 'zh' for Accept-Language zh*, otherwise 'en'. */
export const langOf = (headers) => (/^\s*zh/i.test(headers?.['accept-language'] ?? '') ? 'zh' : 'en');

/** Message text with {0}, {1}, ... replaced. */
export const text = (lang, key, ...args) => TEXTS[lang][key].replace(/\{(\d)\}/g, (_, i) => String(args[i]));

/** Field label (Common.Label text of the service) for a label key, e.g. "F.Supplier". */
export const fieldLabel = (lang, key) => LABELS[lang][key] ?? key;

/** Status name in a language. */
export const statusName = (lang, code) => STATUS()[code]?.[lang] ?? code;

/** sap-messages severities. */
export const SEVERITY = { success: 1, info: 2, warning: 3, error: 4 };

/** OData JSON error body; details are { code, message, target }. */
export const errorBody = (code, message, details, target) => ({
  error: { code, message, ...(target ? { target } : {}), ...(details?.length ? { details } : {}) },
});
