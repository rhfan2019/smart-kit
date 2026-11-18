/**
 * UploadSetwithTable + UploadItem + UploaderTableItem (sap.m.plugins.UploadSetwithTable, sap.m.upload), docs/26 §3.7. In
 * UI5 a plugin on sap.m.Table whose rows come from a binding; here one control that renders its own file table from
 * `items` (data array instead of the row binding and `rowConfiguration`). Uploads go through the active uploader (the
 * `uploader` element or an implicit UploaderTableItem) with XMLHttpRequest (progress), files can be dropped on the
 * control, and every API outside the table is the UI5 one. The cloud file picker is not offered.
 */
import { ActionIcon, Button, Modal, Progress, TextInput } from '@mantine/core';
import { ChevronLeft, ChevronRight, Download, File as FileGeneric, FileImage, FileSpreadsheet, FileText, Folder, Pencil, Trash2, Upload, X } from 'lucide-react';
import {
  cloneElement, createContext, isValidElement, useCallback, useContext, useEffect, useImperativeHandle, useRef, useState,
  type DragEvent, type InputHTMLAttributes, type ReactElement, type ReactNode, type Ref,
} from 'react';
import { IllustratedMessage } from '../display';
import { useControlLocale, useControlText } from '../context';
import { preventable } from '../types';
import { cx } from './shared';
import { TEXTS } from './texts';

/** sap.m.UploadState */
export type UploadState = 'Ready' | 'Uploading' | 'Complete' | 'Error';
export const UploadState = { Ready: 'Ready', Uploading: 'Uploading', Complete: 'Complete', Error: 'Error' } as const;

/** sap.m.upload.UploaderHttpRequestMethod */
export type UploaderHttpRequestMethod = 'Post' | 'Put';
export const UploaderHttpRequestMethod = { Post: 'Post', Put: 'Put' } as const;

/** sap.m.UploadSetwithTableActionPlaceHolder (the deprecated variant / personalization placeholders are left out). */
export type UploadSetwithTableActionPlaceHolder = 'UploadButtonPlaceholder' | 'CloudFilePickerButtonPlaceholder';
export const UploadSetwithTableActionPlaceHolder = { UploadButtonPlaceholder: 'UploadButtonPlaceholder', CloudFilePickerButtonPlaceholder: 'CloudFilePickerButtonPlaceholder' } as const;

/** sap.ui.core.Item as used by `headerFields`: one request header. */
export interface UploadHeaderField { name: string; value: string }

/** sap.m.upload.UploadItem */
export interface UploadItem {
  /** Extension: identity of the row; default the index and file name. */
  id?: string;
  fileName?: string;
  mediaType?: string;
  /** Download and preview URL. */
  url?: string;
  /** Upload URL of this item (before the uploader's and the control's). */
  uploadUrl?: string;
  uploadState?: UploadState;
  /** Default true. */
  previewable?: boolean;
  /** Size in bytes (default 0). */
  fileSize?: number;
  /** The URL may be shown in the preview without sandboxing (default false). */
  isTrustedSource?: boolean;
  isDirectory?: boolean;
  headerFields?: UploadHeaderField[];
  /** Extension: the selected file of a new item. */
  file?: File;
  /** Extension: upload progress 0–100 while uploading. */
  progress?: number;
  onUploadProgress?: (e: { loaded: number; total: number }) => void;
  onUploadTerminated?: (e: { item: UploadItemInstance }) => void;
}

/** An UploadItem in event objects and ref methods, with the UploadItem methods. */
export type UploadItemInstance = UploadItem & {
  id: string;
  /** Downloads the file (`askForLocation`: a save dialog where the browser has one). */
  download(askForLocation?: boolean): void;
  /** The item fails `fileTypes`, `mediaTypes`, `maxFileNameLength` or `maxFileSize`. */
  isRestricted(): boolean;
  /** Aborts a running upload. */
  terminateUpload(): void;
};

/** The request of a finished upload (`responseXHR` of `uploadCompleted`, as in UI5). */
export interface UploaderResponseXHR {
  response: unknown;
  responseXML: Document | null;
  responseText: string;
  readyState: number;
  /** HTTP status; 0 for a network error. */
  status: number;
  /** The raw response headers (getAllResponseHeaders()). */
  headers: string;
}

export interface UploaderTableItem$UploadStartedEvent { item: UploadItemInstance }
export interface UploaderTableItem$UploadProgressedEvent { item: UploadItemInstance; loaded: number; total: number }
export interface UploaderTableItem$UploadCompletedEvent { item: UploadItemInstance; responseXHR: UploaderResponseXHR }
export interface UploaderTableItem$UploadTerminatedEvent { item: UploadItemInstance }

/** sap.m.upload.UploaderTableItem: how UploadSetwithTable uploads and downloads (`uploader={<UploaderTableItem … />}`). */
export interface $UploaderTableItemSettings {
  /** URL the files are sent to (an item's `uploadUrl` comes first). */
  uploadUrl?: string;
  /** URL of downloads instead of the item's `url`. */
  downloadUrl?: string;
  /** @defaultValue 'Post' */
  httpRequestMethod?: UploaderHttpRequestMethod;
  /** Sends the file as multipart/form-data (field named after the file, plus `_charset_`) instead of the raw body. @defaultValue false */
  useMultipart?: boolean;
  onUploadStarted?: (e: UploaderTableItem$UploadStartedEvent) => void;
  onUploadProgressed?: (e: UploaderTableItem$UploadProgressedEvent) => void;
  onUploadCompleted?: (e: UploaderTableItem$UploadCompletedEvent) => void;
  onUploadTerminated?: (e: UploaderTableItem$UploadTerminatedEvent) => void;
  ref?: Ref<UploaderTableItem>;
}

/** Instance methods of UploaderTableItem (via `ref`). */
export interface UploaderTableItem {
  /** Uploads the item's file (with XMLHttpRequest) and fires uploadStarted, uploadProgressed and uploadCompleted. */
  uploadItem(item: UploadItemInstance, headerFields?: UploadHeaderField[]): void;
  /** Aborts the running upload of the item; fires uploadTerminated. */
  terminateItem(item: UploadItemInstance): void;
  /** Downloads the item from `downloadUrl` or its `url` (`askForLocation`: a save dialog where the browser has one); false without a URL. */
  download(item: UploadItem, headerFields?: UploadHeaderField[], askForLocation?: boolean): boolean;
}

interface RequestOptions { file?: Blob | null; url: string; method?: UploaderHttpRequestMethod; headerFields?: UploadHeaderField[]; multipart?: boolean; onProgress?: (loaded: number, total: number) => void }

/** Sends one file with XMLHttpRequest; `onEnd` is called synchronously when it finishes, fails or is aborted. */
function request(o: RequestOptions, onEnd: (xhr: XMLHttpRequest, how: 'load' | 'error' | 'abort') => void): XMLHttpRequest {
  const xhr = new XMLHttpRequest();
  xhr.open(o.method === 'Put' ? 'PUT' : 'POST', o.url, true);
  for (const h of o.headerFields ?? []) xhr.setRequestHeader(h.name, h.value);
  if (xhr.upload && o.onProgress) xhr.upload.onprogress = (e) => o.onProgress?.(e.loaded, e.lengthComputable ? e.total : 0);
  xhr.onload = () => onEnd(xhr, 'load');
  xhr.onerror = () => onEnd(xhr, 'error');
  xhr.onabort = () => onEnd(xhr, 'abort');
  let body: Blob | FormData | null = o.file ?? null;
  if (o.multipart && o.file) {
    // as UI5: the form field is named after the file, plus _charset_
    const name = o.file instanceof globalThis.File ? o.file.name : 'file';
    body = new FormData();
    body.append(name, o.file, name);
    body.append('_charset_', 'UTF-8');
  }
  xhr.send(body);
  return xhr;
}

/** Sends one file; resolves with the finished request (any status), rejects on a network error or abort. */
function send(o: RequestOptions) {
  return new Promise<XMLHttpRequest>((resolve, reject) => {
    request(o, (xhr, how) => (how === 'load' ? resolve(xhr) : reject(xhr)));
  });
}

/** Saves a URL as a file: a save dialog with `askForLocation` where the browser has one, else a download link. */
function saveUrl(url: string, fileName: string | undefined, headerFields: UploadHeaderField[], askForLocation?: boolean) {
  const w = window as unknown as { showSaveFilePicker?: (o: { suggestedName?: string }) => Promise<{ createWritable(): Promise<{ write(b: Blob): Promise<void>; close(): Promise<void> }> }> };
  if (askForLocation && w.showSaveFilePicker) {
    void (async () => {
      const handle = await w.showSaveFilePicker!({ suggestedName: fileName });
      const blob = await (await fetch(url, { headers: headerFields.map((h) => [h.name, h.value] as [string, string]) })).blob();
      const out = await handle.createWritable();
      await out.write(blob);
      await out.close();
    })().catch(() => {});
    return;
  }
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName ?? '';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

type UploaderEvent =
  | ['started', UploaderTableItem$UploadStartedEvent] | ['progressed', UploaderTableItem$UploadProgressedEvent]
  | ['completed', UploaderTableItem$UploadCompletedEvent] | ['terminated', UploaderTableItem$UploadTerminatedEvent];
type UploaderListener = (...e: UploaderEvent) => void;
/** Listeners of UploadSetwithTable.registerUploaderEvents, and the abort-all of unmounting, per uploader instance. */
const uploaderListeners = new WeakMap<UploaderTableItem, Set<UploaderListener>>();
const uploaderAbortAll = new WeakMap<UploaderTableItem, () => void>();

function createUploader(settings: () => $UploaderTableItemSettings): UploaderTableItem {
  const running = new Map<string, { xhr?: XMLHttpRequest; aborted: boolean; silent?: boolean }>();
  const listeners = new Set<UploaderListener>();
  const emit = (...e: UploaderEvent) => {
    const s = settings();
    if (e[0] === 'started') s.onUploadStarted?.(e[1]);
    else if (e[0] === 'progressed') s.onUploadProgressed?.(e[1]);
    else if (e[0] === 'completed') s.onUploadCompleted?.(e[1]);
    else s.onUploadTerminated?.(e[1]);
    for (const l of [...listeners]) l(...e);
  };
  const self: UploaderTableItem = {
    uploadItem(item, headerFields) {
      const s = settings();
      const url = item.uploadUrl || s.uploadUrl;
      if (!url) return;
      const entry: { xhr?: XMLHttpRequest; aborted: boolean; silent?: boolean } = { aborted: false };
      running.set(item.id, entry);
      const done = (xhr: XMLHttpRequest) => {
        running.delete(item.id);
        if (entry.silent) return;
        if (entry.aborted) {
          emit('terminated', { item });
          return;
        }
        const responseXML = xhr.responseType === '' || xhr.responseType === 'document' ? xhr.responseXML : null;
        emit('completed', {
          item,
          responseXHR: { response: xhr.response ?? xhr.responseText, responseXML, responseText: xhr.responseText, readyState: xhr.readyState, status: xhr.status, headers: xhr.getAllResponseHeaders?.() ?? '' },
        });
      };
      entry.xhr = request({
        file: item.file, url, method: s.httpRequestMethod, multipart: s.useMultipart, headerFields,
        onProgress: (loaded, total) => emit('progressed', { item, loaded, total }),
      }, done);
      emit('started', { item });
    },
    terminateItem(item) {
      const entry = running.get(item.id);
      if (!entry?.xhr) return;
      entry.aborted = true;
      entry.xhr.abort();
    },
    download(item, headerFields = [], askForLocation) {
      const url = settings().downloadUrl || item.url || (item.file && typeof URL.createObjectURL === 'function' ? URL.createObjectURL(item.file) : undefined);
      if (!url) return false;
      saveUrl(url, item.fileName, headerFields, askForLocation);
      return true;
    },
  };
  uploaderListeners.set(self, listeners);
  uploaderAbortAll.set(self, () => {
    for (const entry of running.values()) {
      entry.silent = true;
      entry.xhr?.abort();
    }
    running.clear();
  });
  return self;
}

/** sap.m.upload.UploaderTableItem: renders nothing; UploadSetwithTable uses it through its `ref` (or an implicit one). */
function UploaderTableItemControl(p: $UploaderTableItemSettings): null {
  const props = useRef(p);
  useEffect(() => { props.current = p; });
  const [instance] = useState(() => createUploader(() => props.current));
  useImperativeHandle(p.ref, () => instance, [instance]);
  useEffect(() => () => uploaderAbortAll.get(instance)?.(), [instance]);
  return null;
}

/** sap.m.upload.UploaderTableItem, with the static `uploadFile`. */
export const UploaderTableItem = Object.assign(UploaderTableItemControl, {
  /** Uploads a file to a URL (POST, raw body); resolves with the finished XMLHttpRequest. */
  uploadFile: (file: Blob, url: string, headerFields?: UploadHeaderField[]) => send({ file, url, headerFields }),
});

/** sap.m.plugins.UploadSetwithTable.FilenameValidationConfig */
export interface FilenameValidationConfig {
  /** include: add `characters` to the default set; exclude: allow them; override: replace the set. */
  mode: 'include' | 'exclude' | 'override';
  characters?: string;
}
/** Characters not allowed in file names by default (UI5). */
export const RESTRICTED_FILE_NAME_CHARACTERS = '\\:/*?"<>|[]{}@#$';

/** sap.m.plugins.UploadSetwithTable.ItemInfo: argument of `itemValidationHandler`. */
export interface UploadSetwithTableItemInfo {
  oItem: UploadItemInstance;
  iTotalItemsForUpload: number;
  oSource: UploadSetwithTable | null;
}

/** sap.m.upload.FilePreviewDialog settings (association `previewDialog`). */
export interface FilePreviewDialog {
  /** Arrows to the previous / next previewable item (default true). */
  showCarouselArrows?: boolean;
  /** Larger files (MB) are not previewed. */
  maxFileSizeforPreview?: number;
  /** Own content for an item; return undefined for the standard preview. */
  customPageContentHandler?: (item: UploadItemInstance) => ReactNode;
  additionalFooterButtons?: ReactNode;
}

/** Extension: an additional column of the file table. */
export interface UploadSetwithTableColumn {
  key: string;
  header: ReactNode;
  cell: (item: UploadItemInstance) => ReactNode;
  /** CSS width. */
  width?: string;
}

/** Event object of `onUploadCompleted`. */
export interface UploadSetwithTable$UploadCompletedEvent {
  item: UploadItemInstance;
  response: string;
  readyState: number;
  status: number;
  /** Text content of the XML response (as in UI5), or null. */
  responseXML: string | null;
  responseText: string;
  /** The response headers, names in lower case. */
  headers: Record<string, string>;
}

export interface UploadSetwithTable$ItemRenamedEvent { item: UploadItemInstance }
export interface UploadSetwithTable$ItemRenameCanceledEvent { item: UploadItemInstance }
/** Preventable: `preventDefault()` keeps the item from being uploaded. */
export interface UploadSetwithTable$BeforeUploadStartsEvent { item: UploadItemInstance; preventDefault(): void }
export interface UploadSetwithTable$FileTypeMismatchEvent { item: UploadItemInstance }
export interface UploadSetwithTable$FileNameLengthExceededEvent { item: UploadItemInstance }
export interface UploadSetwithTable$FileSizeExceededEvent { item: UploadItemInstance }
export interface UploadSetwithTable$MediaTypeMismatchEvent { item: UploadItemInstance }
export interface UploadSetwithTable$BeforeInitiatingItemUploadEvent { item: UploadItemInstance }
/** UI5 event `onActivated`: the control is ready. */
export interface UploadSetwithTable$OnActivatedEvent { oPlugin: UploadSetwithTable }
/** UI5 event `onDeactivated`: the control is removed; `control` is its root element. */
export interface UploadSetwithTable$OnDeactivatedEvent { control: HTMLElement | null }
/** Extension: event object of `onRemove`. */
export interface UploadSetwithTableRemoveEvent { item: UploadItemInstance }

export interface $UploadSetwithTableSettings {
  items?: UploadItem[];
  /** Allowed extensions without dot, case-insensitive. */
  fileTypes?: string[];
  maxFileNameLength?: number;
  /** Maximum file size in MB. */
  maxFileSize?: number;
  /** Allowed media types ("image/png", also "image/*"). */
  mediaTypes?: string[];
  /** URL of the implicit uploader (without `uploader`). */
  uploadUrl?: string;
  /** Method of the implicit uploader (without `uploader`). @defaultValue 'Post' */
  httpRequestMethod?: UploaderHttpRequestMethod;
  /** Several files at once. @defaultValue false */
  multiple?: boolean;
  /** Hides the upload button; drag and drop still works. @defaultValue false */
  uploadButtonInvisible?: boolean;
  /** @defaultValue true */
  uploadEnabled?: boolean;
  /** Called for each new item before its upload; resolve (with the item to upload) to go on, reject to skip it. */
  itemValidationHandler?: (info: UploadSetwithTableItemInfo) => Promise<UploadItem>;
  /** Selects folders instead of files. @defaultValue false */
  directory?: boolean;
  fileNameValidationConfig?: FilenameValidationConfig;
  /** The uploader: an `<UploaderTableItem … />` element (default: an implicit one with `uploadUrl` and `httpRequestMethod`). */
  uploader?: ReactElement<$UploaderTableItemSettings>;
  headerFields?: UploadHeaderField[];
  /** Empty state; default an IllustratedMessage "UploadToCloud". */
  noDataIllustration?: ReactNode;
  /** Toolbar content; an `<ActionsPlaceholder placeholderFor="UploadButtonPlaceholder" />` places the upload button (default: at the end). */
  actions?: ReactNode;
  previewDialog?: FilePreviewDialog;
  /** Extension: title of the toolbar and the table. */
  title?: string;
  /** Extension: columns after the file name, size and status. */
  columns?: UploadSetwithTableColumn[];
  /** Extension: shows a remove button per row. */
  onRemove?: (e: UploadSetwithTableRemoveEvent) => void;
  onItemRenamed?: (e: UploadSetwithTable$ItemRenamedEvent) => void;
  onItemRenameCanceled?: (e: UploadSetwithTable$ItemRenameCanceledEvent) => void;
  onBeforeUploadStarts?: (e: UploadSetwithTable$BeforeUploadStartsEvent) => void;
  onUploadCompleted?: (e: UploadSetwithTable$UploadCompletedEvent) => void;
  onFileTypeMismatch?: (e: UploadSetwithTable$FileTypeMismatchEvent) => void;
  onFileNameLengthExceeded?: (e: UploadSetwithTable$FileNameLengthExceededEvent) => void;
  onFileSizeExceeded?: (e: UploadSetwithTable$FileSizeExceededEvent) => void;
  onMediaTypeMismatch?: (e: UploadSetwithTable$MediaTypeMismatchEvent) => void;
  onBeforeInitiatingItemUpload?: (e: UploadSetwithTable$BeforeInitiatingItemUploadEvent) => void;
  /** UI5 event `onActivated`: fired when the control is mounted. */
  onOnActivated?: (e: UploadSetwithTable$OnActivatedEvent) => void;
  /** UI5 event `onDeactivated`: fired when the control is unmounted. */
  onOnDeactivated?: (e: UploadSetwithTable$OnDeactivatedEvent) => void;
  ref?: Ref<UploadSetwithTable>;
}

/** Instance methods of UploadSetwithTable (via `ref`). */
export interface UploadSetwithTable {
  /** Opens the file selection dialog. */
  fileSelectionHandler(): void;
  download(item: UploadItem, askForLocation?: boolean): void;
  openFilePreview(item: UploadItem): void;
  /** Starts the inline rename of an item. */
  renameItem(item: UploadItem): void;
  /** Adds an item for a file at a URL; uploads it when `promise` resolves, drops it when it rejects. */
  uploadItemViaUrl(name: string, url: string, promise: Promise<unknown>): Promise<UploadItemInstance>;
  /** Adds an item without a file; `promise` resolves to its data (file name, URL…), then it is uploaded. */
  uploadItemWithoutFile(promise: Promise<Partial<UploadItem> | undefined>): Promise<UploadItemInstance>;
  /** Lets the control follow the uploads of an UploaderTableItem instance (the `uploader` and the implicit one are registered already). */
  registerUploaderEvents(uploader: UploaderTableItem): void;
}

const UploadButtonContext = createContext<ReactNode>(null);

export interface $ActionsPlaceholderSettings {
  /** Which button the placeholder stands for. */
  placeholderFor?: UploadSetwithTableActionPlaceHolder;
}

/** sap.m.upload.ActionsPlaceholder: where the upload button goes inside `actions`. */
export function ActionsPlaceholder({ placeholderFor }: $ActionsPlaceholderSettings) {
  const button = useContext(UploadButtonContext);
  return placeholderFor === 'UploadButtonPlaceholder' ? <>{button}</> : null;
}

const extensionOf = (name = '') => (name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '');
const baseName = (name = '') => (name.includes('.') ? name.slice(0, name.lastIndexOf('.')) : name);
const mediaMatches = (type: string, allowed: string[]) => allowed.some((a) => a.toLowerCase() === type.toLowerCase() || (a.endsWith('/*') && type.toLowerCase().startsWith(a.slice(0, -1).toLowerCase())));

/** The characters a file name must not contain (FilenameValidationConfig). */
export function restrictedCharacters(config?: FilenameValidationConfig): string {
  if (!config) return RESTRICTED_FILE_NAME_CHARACTERS;
  const chars = config.characters ?? '';
  if (config.mode === 'override') return chars;
  if (config.mode === 'exclude') return [...RESTRICTED_FILE_NAME_CHARACTERS].filter((c) => !chars.includes(c)).join('');
  return RESTRICTED_FILE_NAME_CHARACTERS + chars;
}

/** The first validation the item fails, in the UI5 order. */
export function validationFailure(item: UploadItem, p: Pick<$UploadSetwithTableSettings, 'fileTypes' | 'mediaTypes' | 'maxFileNameLength' | 'maxFileSize'>):
  'fileType' | 'mediaType' | 'fileNameLength' | 'fileSize' | undefined {
  if (p.fileTypes?.length && !p.fileTypes.map((x) => x.toLowerCase()).includes(extensionOf(item.fileName))) return 'fileType';
  if (p.mediaTypes?.length && !mediaMatches(item.mediaType ?? '', p.mediaTypes)) return 'mediaType';
  if (p.maxFileNameLength && (item.fileName ?? '').length > p.maxFileNameLength) return 'fileNameLength';
  if (p.maxFileSize && (item.fileSize ?? 0) > p.maxFileSize * 1024 * 1024) return 'fileSize';
  return undefined;
}

function FileIcon({ item }: { item: UploadItem }) {
  const type = item.mediaType ?? '';
  if (item.isDirectory) return <Folder aria-hidden="true" />;
  if (type.startsWith('image/')) return item.url ? <img className="sk-upload-table__thumbnail" src={item.url} alt="" /> : <FileImage aria-hidden="true" />;
  if (type === 'application/pdf' || type.startsWith('text/')) return <FileText aria-hidden="true" />;
  if (/sheet|excel|csv/.test(type)) return <FileSpreadsheet aria-hidden="true" />;
  return <FileGeneric aria-hidden="true" />;
}

function parseHeaders(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of raw.trim().split(/[\r\n]+/)) {
    const i = line.indexOf(':');
    if (i > 0) out[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
  }
  return out;
}

const signature = (items: UploadItem[] | undefined) => (items ?? []).map((i) => [i.id, i.fileName, i.url, i.uploadState, i.fileSize].join('\u0001')).join('\u0002');
let seq = 0;

/** The UI5 file size text: KB below 1 MB, MB below 1 GB, else GB, two decimals. */
function fileSizeWithUnits(iFileSize: number): string {
  const kb = 1024;
  const mb = kb * 1024;
  const gb = mb * 1024;
  if (typeof iFileSize !== 'number') return String(iFileSize);
  if (iFileSize < mb) return `${(iFileSize / kb).toFixed(2)} KB`;
  if (iFileSize < gb) return `${(iFileSize / mb).toFixed(2)} MB`;
  return `${(iFileSize / gb).toFixed(2)} GB`;
}

/** The icon of a file by media type, else by extension (a React element instead of the UI5 icon URI, ADR-032 rule 5). */
function iconForFileType(mediaType: string | undefined, fileName: string | undefined): ReactElement {
  const type = (mediaType ?? '').toLowerCase();
  const ext = extensionOf(fileName);
  if (type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp', 'tif', 'tiff'].includes(ext)) return <FileImage aria-hidden="true" />;
  if (type === 'application/pdf' || type.startsWith('text/') || ['pdf', 'txt', 'doc', 'docx', 'rtf'].includes(ext)) return <FileText aria-hidden="true" />;
  if (/sheet|excel|csv/.test(type) || ['xls', 'xlsx', 'xlsm', 'csv'].includes(ext)) return <FileSpreadsheet aria-hidden="true" />;
  return <FileGeneric aria-hidden="true" />;
}

/** Root elements of the mounted controls (static `findOn`). */
const mounted = new Map<Element, UploadSetwithTable>();

export function UploadSetwithTable(p: $UploadSetwithTableSettings) {
  const t = useControlText(TEXTS);
  const { intlLocale } = useControlLocale();
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const props = useRef(p);
  useEffect(() => { props.current = p; });
  // own items (selected files, uploads in progress); `items` come from the application
  const [own, setOwn] = useState<UploadItem[]>([]);
  const ownRef = useRef<UploadItem[]>([]);
  const commit = (next: UploadItem[]) => {
    ownRef.current = next;
    setOwn(next);
  };
  const [sig, setSig] = useState(() => signature(p.items));
  const nextSig = signature(p.items);
  if (nextSig !== sig) {
    // new application items: drop own items that finished uploading (the application lists them now)
    // (own items with an id in `items` are hidden below)
    setSig(nextSig);
    setOwn(own.filter((i) => i.uploadState !== 'Complete'));
  }
  useEffect(() => { ownRef.current = own; }, [own]);

  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const appItems = (p.items ?? []).map((it, i) => ({ ...it, id: it.id ?? `${i}:${it.fileName ?? ''}` }));
  // an own item whose id the application lists now is taken over by the application
  const appIds = new Set(appItems.map((i) => i.id));
  const all = [...appItems, ...own.filter((it) => !appIds.has(it.id!)).map((it) => ({ ...it, id: it.id! }))];

  const patch = (id: string, changes: Partial<UploadItem>) => {
    if (!ownRef.current.some((i) => i.id === id)) return undefined;
    const next = ownRef.current.map((i) => (i.id === id ? { ...i, ...changes } : i));
    commit(next);
    return next.find((i) => i.id === id);
  };
  const remove = (id: string) => commit(ownRef.current.filter((i) => i.id !== id));
  const find = (item: UploadItem) => {
    const list = [...(props.current.items ?? []).map((it, i) => ({ ...it, id: it.id ?? `${i}:${it.fileName ?? ''}` })), ...ownRef.current];
    return list.find((i) => i.id === item.id) ?? list.find((i) => i.fileName === item.fileName && i.url === item.url);
  };

  // the active uploader: the `uploader` element or the implicit one (UI5 _getActiveUploader)
  const uploaderRef = useRef<UploaderTableItem | null>(null);
  const registered = useRef(new Set<UploaderTableItem>());
  const pending = useRef(new Map<string, () => void>());
  const settle = (id: string) => {
    pending.current.get(id)?.();
    pending.current.delete(id);
  };
  const headers = (item?: UploadItem) => [...(props.current.headerFields ?? []), ...(item?.headerFields ?? [])];
  const onUploaderEvent: UploaderListener = (...e) => {
    const id = e[1].item.id;
    if (e[0] === 'started') patch(id, { uploadState: 'Uploading', progress: 0 });
    else if (e[0] === 'progressed') {
      const { loaded, total } = e[1];
      patch(id, { progress: total ? Math.round((loaded / total) * 100) : 0 })?.onUploadProgress?.({ loaded, total });
    } else if (e[0] === 'terminated') {
      const row = ownRef.current.find((i) => i.id === id);
      remove(id);
      row?.onUploadTerminated?.({ item: instance(row) });
      settle(id);
    } else {
      const x = e[1].responseXHR;
      const ok = x.status >= 200 && x.status < 300;
      const done = patch(id, { uploadState: ok ? 'Complete' : 'Error', progress: ok ? 100 : undefined });
      if (done) {
        props.current.onUploadCompleted?.({
          item: instance(done), response: typeof x.response === 'string' ? x.response : x.responseText, readyState: x.readyState, status: x.status,
          responseXML: x.responseXML?.documentElement?.textContent ?? null, responseText: x.responseText, headers: parseHeaders(x.headers),
        });
      }
      settle(id);
    }
  };
  const listener = useRef(onUploaderEvent);
  useEffect(() => { listener.current = onUploaderEvent; });
  const [stableListener] = useState<UploaderListener>(() => (...e: UploaderEvent) => listener.current(...e));
  const registerUploaderEvents = (u: UploaderTableItem) => {
    if (registered.current.has(u)) return;
    registered.current.add(u);
    uploaderListeners.get(u)?.add(stableListener);
  };
  useEffect(() => {
    const set = registered.current;
    return () => {
      for (const u of set) uploaderListeners.get(u)?.delete(stableListener);
      set.clear();
    };
  }, [stableListener]);
  const ownUploaderRef = p.uploader?.props.ref;
  const setUploader = useCallback((u: UploaderTableItem | null) => {
    uploaderRef.current = u;
    if (u) registerUploaderEvents(u);
    if (typeof ownUploaderRef === 'function') ownUploaderRef(u);
    else if (ownUploaderRef && typeof ownUploaderRef === 'object') (ownUploaderRef as { current: UploaderTableItem | null }).current = u;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- registerUploaderEvents only touches refs
  }, [ownUploaderRef]);
  const uploaderElement = p.uploader && isValidElement(p.uploader)
    ? cloneElement(p.uploader, { ref: setUploader })
    : <UploaderTableItem ref={setUploader} uploadUrl={p.uploadUrl} httpRequestMethod={p.httpRequestMethod} />;

  const download = (item: UploadItem, askForLocation?: boolean) => {
    uploaderRef.current?.download(item, headers(item), askForLocation);
  };
  const terminateUpload = (id: string) => {
    const row = ownRef.current.find((i) => i.id === id);
    if (row) uploaderRef.current?.terminateItem(instance(row));
  };
  const instance = (item: UploadItem): UploadItemInstance => {
    const id = item.id ?? '';
    return {
      ...item, id,
      download: (ask?: boolean) => download(item, ask),
      isRestricted: () => !!validationFailure(item, props.current) || [...restrictedCharacters(props.current.fileNameValidationConfig)].some((c) => (item.fileName ?? '').includes(c)),
      terminateUpload: () => terminateUpload(id),
    };
  };

  /** beforeInitiatingItemUpload → beforeUploadStarts (preventable) → the uploader's uploadItem; resolves when the upload ends. */
  const upload = (id: string) => new Promise<void>((resolve) => {
    const cur = ownRef.current.find((i) => i.id === id);
    const q = props.current;
    if (!cur) return resolve();
    q.onBeforeInitiatingItemUpload?.({ item: instance(cur) });
    const ev = preventable({ item: instance(cur) });
    q.onBeforeUploadStarts?.(ev);
    if (ev.defaultPrevented) return resolve();
    const url = cur.uploadUrl ?? (q.uploader ? q.uploader.props.uploadUrl : q.uploadUrl);
    const uploader = uploaderRef.current;
    if (!url || !uploader) return resolve();
    pending.current.set(id, resolve);
    uploader.uploadItem(instance(cur), headers(cur));
  });

  /** Validates new items, asks itemValidationHandler, then uploads them. */
  const addItems = async (items: UploadItem[]) => {
    const q = props.current;
    const restricted = restrictedCharacters(q.fileNameValidationConfig);
    const accepted: UploadItem[] = [];
    for (const it of items) {
      const failure = validationFailure(it, q);
      const item = instance(it);
      if (failure === 'fileType') { q.onFileTypeMismatch?.({ item }); continue; }
      if (failure === 'mediaType') { q.onMediaTypeMismatch?.({ item }); continue; }
      if (failure === 'fileNameLength') { q.onFileNameLengthExceeded?.({ item }); continue; }
      if (failure === 'fileSize') { q.onFileSizeExceeded?.({ item }); continue; }
      const bad = [...restricted].filter((c) => (it.fileName ?? '').includes(c));
      if (bad.length) {
        setNotice(t('ctl.uploadSet.restricted', { fileName: it.fileName ?? '', characters: bad.join(' ') }));
        continue;
      }
      accepted.push(it);
    }
    for (const it of accepted) {
      let item: UploadItem = it;
      if (q.itemValidationHandler) {
        try {
          item = { ...it, ...(await q.itemValidationHandler({ oItem: instance(it), iTotalItemsForUpload: accepted.length, oSource: api })), id: it.id };
        } catch {
          continue;
        }
      }
      commit([...ownRef.current, item]);
      void upload(item.id!);
    }
  };
  const addFiles = (files: File[]) => {
    if (!files.length || props.current.uploadEnabled === false) return;
    setNotice(null);
    const list = props.current.multiple ? files : files.slice(0, 1);
    void addItems(list.map((f) => ({ id: `sk-upload-${++seq}`, fileName: f.name, mediaType: f.type, fileSize: f.size, file: f, uploadState: 'Ready' as const })));
  };

  const api: UploadSetwithTable = {
    fileSelectionHandler: () => input.current?.click(),
    download: (item, ask) => download(find(item) ?? item, ask),
    openFilePreview: (item) => {
      const it = find(item);
      if (it?.id) setPreview(it.id);
    },
    renameItem: (item) => {
      const it = find(item);
      if (it?.id) setRenaming({ id: it.id, name: baseName(it.fileName) });
    },
    uploadItemViaUrl: async (name, url, promise) => {
      // as UI5: an empty file object with the given name
      const item: UploadItem = { id: `sk-upload-${++seq}`, fileName: name, url, file: new File([new Blob([])], name), uploadState: 'Ready' };
      commit([...ownRef.current, item]);
      try {
        await promise;
      } catch (e) {
        remove(item.id!);
        throw e;
      }
      await upload(item.id!);
      return instance(ownRef.current.find((i) => i.id === item.id) ?? item);
    },
    uploadItemWithoutFile: async (promise) => {
      const item: UploadItem = { id: `sk-upload-${++seq}`, fileName: '', uploadState: 'Ready' };
      commit([...ownRef.current, item]);
      let data: Partial<UploadItem> | undefined;
      try {
        data = await promise;
      } catch (e) {
        remove(item.id!);
        throw e;
      }
      patch(item.id!, { ...data, id: item.id });
      await upload(item.id!);
      return instance(ownRef.current.find((i) => i.id === item.id) ?? item);
    },
    registerUploaderEvents,
  };
  useImperativeHandle(p.ref, () => api);
  // a stable instance with the current methods (onActivated, findOn)
  const [handle] = useState(() => ({ ...api }));
  useEffect(() => { Object.assign(handle, api); });

  // UI5 plugin lifecycle: onActivated when the control is ready, onDeactivated when it is removed
  useEffect(() => {
    const el = root.current;
    if (el) mounted.set(el, handle);
    props.current.onOnActivated?.({ oPlugin: handle });
    return () => {
      if (el) mounted.delete(el);
      props.current.onOnDeactivated?.({ control: el });
    };
  }, [handle]);

  const finishRename = (ok: boolean) => {
    if (!renaming) return;
    const it = all.find((i) => i.id === renaming.id);
    setRenaming(null);
    if (!it) return;
    if (!ok) {
      p.onItemRenameCanceled?.({ item: instance(it) });
      return;
    }
    const ext = extensionOf(it.fileName);
    const fileName = ext ? `${renaming.name}.${ext}` : renaming.name;
    if (own.some((o) => o.id === it.id)) patch(it.id, { fileName });
    p.onItemRenamed?.({ item: instance({ ...it, fileName }) });
  };

  const enabled = p.uploadEnabled !== false;
  const uploadButton = p.uploadButtonInvisible ? null : (
    <Button className="sk-upload-table__upload" size="xs" variant="default" leftSection={<Upload className="sk-upload-table__icon" aria-hidden="true" />}
      disabled={!enabled} onClick={() => input.current?.click()}>{t('ctl.uploadSet.upload')}</Button>
  );
  const hasPlaceholder = containsPlaceholder(p.actions);
  const accept = [...(p.fileTypes ?? []).map((x) => `.${x}`), ...(p.mediaTypes ?? [])].join(',') || undefined;
  const dirAttrs = (p.directory ? { webkitdirectory: '', directory: '' } : {}) as InputHTMLAttributes<HTMLInputElement>;
  const size = (bytes?: number) => {
    if (!bytes) return '';
    const [unit, value] = bytes >= 1024 * 1024 ? ['megabyte', bytes / 1024 / 1024] as const : bytes >= 1024 ? ['kilobyte', bytes / 1024] as const : ['byte', bytes] as const;
    return new Intl.NumberFormat(intlLocale, { style: 'unit', unit, maximumFractionDigits: 1 }).format(value);
  };
  const onDrag = (e: DragEvent) => {
    if (!enabled || !e.dataTransfer?.types?.includes?.('Files')) return;
    e.preventDefault();
    setDrag(true);
  };
  const title = p.title ?? t('ctl.uploadSet.label');
  const previewItem = preview ? all.find((i) => i.id === preview) : undefined;

  return (
    <div
      ref={root}
      className={cx('sk-upload-table', drag && 'sk-upload-table--drag')}
      onDragEnter={onDrag}
      onDragOver={onDrag}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDrag(false); }}
      onDrop={(e) => {
        if (!enabled) return;
        e.preventDefault();
        setDrag(false);
        addFiles(Array.from(e.dataTransfer?.files ?? []));
      }}
    >
      <div className="sk-upload-table__toolbar" role="toolbar" aria-label={title}>
        <span className="sk-upload-table__title">{p.title ?? t('ctl.uploadSet.label')}{all.length ? ` (${all.length})` : ''}</span>
        <span className="sk-upload-table__spacer" />
        <UploadButtonContext.Provider value={uploadButton}>{p.actions}</UploadButtonContext.Provider>
        {!hasPlaceholder && uploadButton}
        {uploaderElement}
        <input ref={input} type="file" hidden multiple={p.multiple} accept={accept} {...dirAttrs} data-testid="sk-upload-input"
          onChange={(e) => { addFiles(Array.from(e.currentTarget.files ?? [])); e.currentTarget.value = ''; }} />
      </div>
      {notice && (
        <div className="sk-upload-table__notice" role="alert">
          <span>{notice}</span>
          <button type="button" className="sk-upload-table__notice-close" aria-label={t('ctl.uploadSet.close')} onClick={() => setNotice(null)}><X className="sk-upload-table__icon" aria-hidden="true" /></button>
        </div>
      )}
      {all.length === 0
        ? <div className="sk-upload-table__empty">{p.noDataIllustration ?? <IllustratedMessage illustrationType="UploadToCloud" illustrationSize="Small" />}</div>
        : (
          <table className="sk-upload-table__table" aria-label={title}>
            <thead>
              <tr>
                <th scope="col">{t('ctl.uploadSet.fileName')}</th>
                <th scope="col" className="sk-upload-table__num">{t('ctl.uploadSet.size')}</th>
                <th scope="col">{t('ctl.uploadSet.state')}</th>
                {p.columns?.map((c) => <th key={c.key} scope="col" style={c.width ? { inlineSize: c.width } : undefined}>{c.header}</th>)}
                <th scope="col"><span className="sk-visually-hidden">{t('ctl.uploadSet.actions')}</span></th>
              </tr>
            </thead>
            <tbody>
              {all.map((it) => {
                const item = instance(it);
                const state = it.uploadState ?? (it.url ? 'Complete' : 'Ready');
                const busy = state === 'Uploading';
                const isRenaming = renaming?.id === it.id;
                return (
                  <tr key={it.id} data-upload-state={state} className="sk-upload-table__row">
                    <td>
                      <div className="sk-upload-table__file">
                        <span className="sk-upload-table__file-icon"><FileIcon item={it} /></span>
                        {isRenaming ? (
                          <span className="sk-upload-table__rename">
                            <TextInput size="xs" autoFocus aria-label={t('ctl.uploadSet.fileName')} value={renaming.name}
                              rightSection={extensionOf(it.fileName) ? <span className="sk-upload-table__ext">.{extensionOf(it.fileName)}</span> : undefined}
                              onChange={(e) => setRenaming({ id: it.id, name: e.currentTarget.value })}
                              onKeyDown={(e) => { if (e.key === 'Enter') finishRename(true); if (e.key === 'Escape') finishRename(false); }} />
                            <Button size="xs" onClick={() => finishRename(true)} disabled={!renaming.name.trim()}>{t('ctl.uploadSet.ok')}</Button>
                            <Button size="xs" variant="subtle" onClick={() => finishRename(false)}>{t('ctl.uploadSet.cancel')}</Button>
                          </span>
                        ) : it.previewable !== false && (it.url || it.file) && !busy
                          ? <button type="button" className="sk-upload-table__name sk-upload-table__name--active" onClick={() => setPreview(it.id)}>{it.fileName}</button>
                          : <span className="sk-upload-table__name">{it.fileName}</span>}
                      </div>
                    </td>
                    <td className="sk-upload-table__num">{size(it.fileSize)}</td>
                    <td>
                      {busy ? (
                        <div className="sk-upload-table__progress" aria-live="polite">
                          <Progress size="sm" value={it.progress ?? 0} aria-label={t('ctl.uploadSet.uploading', { percent: it.progress ?? 0 })} />
                          <span className="sk-upload-table__progress-text">{t('ctl.uploadSet.uploading', { percent: it.progress ?? 0 })}</span>
                        </div>
                      ) : (
                        <span className={`sk-upload-table__state sk-status--${state === 'Complete' ? 'positive' : state === 'Error' ? 'negative' : 'neutral'}`} aria-live="polite">
                          {t(state === 'Complete' ? 'ctl.uploadSet.complete' : state === 'Error' ? 'ctl.uploadSet.error' : 'ctl.uploadSet.ready')}
                        </span>
                      )}
                    </td>
                    {p.columns?.map((c) => <td key={c.key}>{c.cell(item)}</td>)}
                    <td className="sk-upload-table__actions">
                      {busy ? (
                        <ActionIcon variant="subtle" aria-label={t('ctl.uploadSet.terminate')} onClick={() => terminateUpload(it.id)}><X className="sk-upload-table__icon" aria-hidden="true" /></ActionIcon>
                      ) : (
                        <>
                          {(it.url || it.file || p.uploader?.props.downloadUrl) && (
                            <ActionIcon variant="subtle" aria-label={t('ctl.uploadSet.download')} onClick={() => download(it)}><Download className="sk-upload-table__icon" aria-hidden="true" /></ActionIcon>
                          )}
                          <ActionIcon variant="subtle" aria-label={t('ctl.uploadSet.rename')} onClick={() => setRenaming({ id: it.id, name: baseName(it.fileName) })}><Pencil className="sk-upload-table__icon" aria-hidden="true" /></ActionIcon>
                          {p.onRemove && (
                            <ActionIcon variant="subtle" aria-label={t('ctl.uploadSet.remove')} onClick={() => {
                              if (own.some((o) => o.id === it.id)) remove(it.id);
                              p.onRemove?.({ item });
                            }}><Trash2 className="sk-upload-table__icon" aria-hidden="true" /></ActionIcon>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      {drag && <div className="sk-upload-table__drop" aria-hidden="true"><Upload className="sk-upload-table__drop-icon" />{t('ctl.uploadSet.dropHere')}</div>}
      {previewItem && (
        <FilePreview items={all} current={previewItem} settings={p.previewDialog} onChange={setPreview} onClose={() => setPreview(null)} onDownload={download} toInstance={instance} />
      )}
    </div>
  );
}

/** Static methods of sap.m.plugins.UploadSetwithTable. */
UploadSetwithTable.findOn = (element: Element | null | undefined): UploadSetwithTable | undefined => {
  if (!element) return undefined;
  const el = element.closest('.sk-upload-table') ?? element.querySelector('.sk-upload-table');
  return el ? mounted.get(el) : undefined;
};
/** File size with unit as UI5 formats it ("248.05 KB", "2.29 MB", "1.00 GB"). */
UploadSetwithTable.getFileSizeWithUnits = fileSizeWithUnits;
/** The file icon for a media type or file name (a React element). */
UploadSetwithTable.getIconForFileType = iconForFileType;

function containsPlaceholder(node: ReactNode): boolean {
  if (Array.isArray(node)) return node.some(containsPlaceholder);
  if (!node || typeof node !== 'object' || !('type' in node)) return false;
  const el = node as { type: unknown; props: { placeholderFor?: string; children?: ReactNode } };
  return (el.type === ActionsPlaceholder && el.props.placeholderFor === 'UploadButtonPlaceholder') || containsPlaceholder(el.props.children);
}

/** sap.m.upload.FilePreviewDialog: images and PDFs, arrows between previewable items. */
function FilePreview(p: {
  items: UploadItem[]; current: UploadItem; settings?: FilePreviewDialog; onChange: (id: string) => void; onClose: () => void;
  onDownload: (item: UploadItem) => void; toInstance: (item: UploadItem) => UploadItemInstance;
}) {
  const t = useControlText(TEXTS);
  const list = p.items.filter((i) => i.previewable !== false && (i.url || i.file));
  const index = Math.max(0, list.findIndex((i) => i.id === p.current.id));
  const item = list[index] ?? p.current;
  const [fileUrl, setFileUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!item.file || item.url || typeof URL.createObjectURL !== 'function') return;
    const u = URL.createObjectURL(item.file);
    const id = requestAnimationFrame(() => setFileUrl(u));
    return () => {
      cancelAnimationFrame(id);
      URL.revokeObjectURL(u);
    };
  }, [item.file, item.url]);
  const src = item.url ?? fileUrl;
  const max = p.settings?.maxFileSizeforPreview;
  const tooLarge = !!max && (item.fileSize ?? 0) > max * 1024 * 1024;
  const custom = p.settings?.customPageContentHandler?.(p.toInstance(item));
  const type = item.mediaType ?? '';
  const arrows = p.settings?.showCarouselArrows !== false && list.length > 1;
  const go = (d: number) => p.onChange(list[(index + d + list.length) % list.length]!.id!);
  let content: ReactNode;
  if (custom !== undefined) content = custom;
  else if (tooLarge) content = <p className="sk-upload-preview__message">{t('ctl.uploadSet.tooLarge')}</p>;
  else if (src && type.startsWith('image/')) content = <img className="sk-upload-preview__image" src={src} alt={item.fileName ?? ''} />;
  else if (src && type === 'application/pdf') content = <iframe className="sk-upload-preview__frame" src={src} title={item.fileName ?? ''} sandbox={item.isTrustedSource ? undefined : ''} />;
  else content = <p className="sk-upload-preview__message">{t('ctl.uploadSet.noPreview')}</p>;
  return (
    <Modal opened onClose={p.onClose} size="xl" title={item.fileName} closeButtonProps={{ 'aria-label': t('ctl.uploadSet.close') }}>
      <div className="sk-upload-preview">
        {arrows && <ActionIcon variant="default" aria-label={t('ctl.uploadSet.previous')} onClick={() => go(-1)}><ChevronLeft className="sk-upload-table__icon" aria-hidden="true" /></ActionIcon>}
        <div className="sk-upload-preview__page">{content}</div>
        {arrows && <ActionIcon variant="default" aria-label={t('ctl.uploadSet.next')} onClick={() => go(1)}><ChevronRight className="sk-upload-table__icon" aria-hidden="true" /></ActionIcon>}
      </div>
      <div className="sk-upload-preview__footer">
        {list.length > 1 && <span className="sk-upload-preview__position">{t('ctl.uploadSet.position', { index: index + 1, count: list.length })}</span>}
        <span className="sk-upload-table__spacer" />
        {p.settings?.additionalFooterButtons}
        <Button size="xs" variant="default" leftSection={<Download className="sk-upload-table__icon" aria-hidden="true" />} onClick={() => p.onDownload(item)}>{t('ctl.uploadSet.download')}</Button>
        <Button size="xs" onClick={p.onClose}>{t('ctl.uploadSet.close')}</Button>
      </div>
    </Modal>
  );
}
