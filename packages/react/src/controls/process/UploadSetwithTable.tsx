/**
 * UploadSetwithTable + UploadItem (sap.m.plugins.UploadSetwithTable, sap.m.upload), docs/26 §3.7. In UI5 a plugin on
 * sap.m.Table whose rows come from a binding; here one control that renders its own file table from `items` (data
 * array instead of the row binding and `rowConfiguration`). Uploads use XMLHttpRequest (progress), files can be dropped
 * on the control, and every API outside the table is the UI5 one. The plugin lifecycle events onActivated /
 * onDeactivated and the cloud file picker are not offered.
 */
import { ActionIcon, Button, Modal, Progress, TextInput } from '@mantine/core';
import { ChevronLeft, ChevronRight, Download, File as FileGeneric, FileImage, FileSpreadsheet, FileText, Folder, Pencil, Trash2, Upload, X } from 'lucide-react';
import {
  createContext, useContext, useEffect, useImperativeHandle, useRef, useState, type DragEvent, type InputHTMLAttributes, type ReactNode, type Ref,
} from 'react';
import { IllustratedMessage } from '../display';
import { useControlLocale, useControlText } from '../context';
import { preventable, type PreventableEvent } from '../types';
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

/** sap.m.upload.UploaderTableItem: how the control uploads and downloads. */
export interface UploaderTableItem {
  uploadUrl?: string;
  downloadUrl?: string;
  /** Default 'Post'. */
  httpRequestMethod?: UploaderHttpRequestMethod;
  /** Sends the file as multipart/form-data (field "file") instead of the raw body (default false). */
  useMultipart?: boolean;
  onUploadStarted?: (e: { item: UploadItemInstance }) => void;
  onUploadProgressed?: (e: { item: UploadItemInstance; loaded: number; total: number }) => void;
  onUploadCompleted?: (e: { item: UploadItemInstance; responseXHR: XMLHttpRequest }) => void;
  onUploadTerminated?: (e: { item: UploadItemInstance }) => void;
}

/** Sends one file with XMLHttpRequest; resolves with the finished request (any status), rejects on a network error. */
function send(o: { file?: Blob | null; url: string; method?: UploaderHttpRequestMethod; headerFields?: UploadHeaderField[]; multipart?: boolean; onProgress?: (loaded: number, total: number) => void; onStart?: (xhr: XMLHttpRequest) => void }) {
  return new Promise<XMLHttpRequest>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(o.method === 'Put' ? 'PUT' : 'POST', o.url, true);
    for (const h of o.headerFields ?? []) xhr.setRequestHeader(h.name, h.value);
    if (xhr.upload && o.onProgress) xhr.upload.onprogress = (e) => o.onProgress?.(e.loaded, e.lengthComputable ? e.total : 0);
    xhr.onload = () => resolve(xhr);
    xhr.onerror = () => reject(xhr);
    xhr.onabort = () => reject(xhr);
    o.onStart?.(xhr);
    let body: Blob | FormData | null = o.file ?? null;
    if (o.multipart && o.file) {
      body = new FormData();
      body.append('file', o.file, o.file instanceof globalThis.File ? o.file.name : 'file');
    }
    xhr.send(body);
  });
}

/** Static methods of sap.m.upload.UploaderTableItem. */
export const UploaderTableItem = {
  /** Uploads a file to a URL (POST, raw body); resolves with the finished XMLHttpRequest. */
  uploadFile: (file: Blob, url: string, headerFields?: UploadHeaderField[]) => send({ file, url, headerFields }),
};

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
  oSource: UploadSetwithTableRef | null;
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

export interface UploadCompletedEvent {
  item: UploadItemInstance;
  response: string;
  readyState: number;
  status: number;
  responseXML: Document | null;
  responseText: string;
  headers: Record<string, string>;
}

type ItemEvent = { item: UploadItemInstance };

export interface UploadSetwithTableProps {
  items?: UploadItem[];
  /** Allowed extensions without dot, case-insensitive. */
  fileTypes?: string[];
  maxFileNameLength?: number;
  /** Maximum file size in MB. */
  maxFileSize?: number;
  /** Allowed media types ("image/png", also "image/*"). */
  mediaTypes?: string[];
  uploadUrl?: string;
  /** Default 'Post'. */
  httpRequestMethod?: UploaderHttpRequestMethod;
  /** Several files at once (default false). */
  multiple?: boolean;
  /** Hides the upload button (default false); drag and drop still works. */
  uploadButtonInvisible?: boolean;
  /** Default true. */
  uploadEnabled?: boolean;
  /** Called for each new item before its upload; resolve (with the item to upload) to go on, reject to skip it. */
  itemValidationHandler?: (info: UploadSetwithTableItemInfo) => Promise<UploadItem>;
  /** Selects folders instead of files (default false). */
  directory?: boolean;
  fileNameValidationConfig?: FilenameValidationConfig;
  uploader?: UploaderTableItem;
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
  onRemove?: (e: ItemEvent) => void;
  onItemRenamed?: (e: ItemEvent) => void;
  onItemRenameCanceled?: (e: ItemEvent) => void;
  onBeforeUploadStarts?: (e: PreventableEvent<ItemEvent>) => void;
  onUploadCompleted?: (e: UploadCompletedEvent) => void;
  onFileTypeMismatch?: (e: ItemEvent) => void;
  onFileNameLengthExceeded?: (e: ItemEvent) => void;
  onFileSizeExceeded?: (e: ItemEvent) => void;
  onMediaTypeMismatch?: (e: ItemEvent) => void;
  onBeforeInitiatingItemUpload?: (e: ItemEvent) => void;
  ref?: Ref<UploadSetwithTableRef>;
}

/** Instance methods of UploadSetwithTable (via `ref`). */
export interface UploadSetwithTableRef {
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
}

const UploadButtonContext = createContext<ReactNode>(null);

/** sap.m.upload.ActionsPlaceholder: where the upload button goes inside `actions`. */
export function ActionsPlaceholder({ placeholderFor }: { placeholderFor?: UploadSetwithTableActionPlaceHolder }) {
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
export function validationFailure(item: UploadItem, p: Pick<UploadSetwithTableProps, 'fileTypes' | 'mediaTypes' | 'maxFileNameLength' | 'maxFileSize'>):
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

export function UploadSetwithTable(p: UploadSetwithTableProps) {
  const t = useControlText(TEXTS);
  const { intlLocale } = useControlLocale();
  const input = useRef<HTMLInputElement>(null);
  const props = useRef(p);
  useEffect(() => { props.current = p; });
  const xhrs = useRef(new Map<string, XMLHttpRequest>());
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
  useEffect(() => () => xhrs.current.forEach((x) => x.abort()), []);

  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const appItems = (p.items ?? []).map((it, i) => ({ ...it, id: it.id ?? `${i}:${it.fileName ?? ''}` }));
  // an own item whose id the application lists now is taken over by the application
  const appIds = new Set(appItems.map((i) => i.id));
  const all = [...appItems, ...own.filter((it) => !appIds.has(it.id!)).map((it) => ({ ...it, id: it.id! }))];

  const patch = (id: string, changes: Partial<UploadItem>) => {
    const next = ownRef.current.map((i) => (i.id === id ? { ...i, ...changes } : i));
    commit(next);
    return next.find((i) => i.id === id);
  };
  const remove = (id: string) => commit(ownRef.current.filter((i) => i.id !== id));
  const find = (item: UploadItem) => {
    const list = [...(props.current.items ?? []).map((it, i) => ({ ...it, id: it.id ?? `${i}:${it.fileName ?? ''}` })), ...ownRef.current];
    return list.find((i) => i.id === item.id) ?? list.find((i) => i.fileName === item.fileName && i.url === item.url);
  };

  const download = (item: UploadItem, askForLocation?: boolean) => {
    const url = props.current.uploader?.downloadUrl ?? item.url ?? (item.file && typeof URL.createObjectURL === 'function' ? URL.createObjectURL(item.file) : undefined);
    if (!url) return;
    const w = window as unknown as { showSaveFilePicker?: (o: { suggestedName?: string }) => Promise<{ createWritable(): Promise<{ write(b: Blob): Promise<void>; close(): Promise<void> }> }> };
    if (askForLocation && w.showSaveFilePicker) {
      void (async () => {
        const handle = await w.showSaveFilePicker!({ suggestedName: item.fileName });
        const blob = await (await fetch(url)).blob();
        const out = await handle.createWritable();
        await out.write(blob);
        await out.close();
      })().catch(() => {});
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = item.fileName ?? '';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  const aborted = useRef(new Set<string>());
  const terminateUpload = (id: string) => {
    if (!xhrs.current.has(id)) return;
    aborted.current.add(id);
    xhrs.current.get(id)?.abort();
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

  /** beforeInitiatingItemUpload → beforeUploadStarts (preventable) → XMLHttpRequest with progress → uploadCompleted. */
  const upload = async (id: string) => {
    const cur = ownRef.current.find((i) => i.id === id);
    const q = props.current;
    if (!cur) return;
    q.onBeforeInitiatingItemUpload?.({ item: instance(cur) });
    const ev = preventable({ item: instance(cur) });
    q.onBeforeUploadStarts?.(ev);
    if (ev.defaultPrevented) return;
    const url = cur.uploadUrl ?? q.uploader?.uploadUrl ?? q.uploadUrl;
    if (!url) return;
    const started = patch(id, { uploadState: 'Uploading', progress: 0 });
    if (started) q.uploader?.onUploadStarted?.({ item: instance(started) });
    try {
      const xhr = await send({
        file: cur.file, url, method: q.uploader?.httpRequestMethod ?? q.httpRequestMethod, multipart: q.uploader?.useMultipart,
        headerFields: [...(q.headerFields ?? []), ...(cur.headerFields ?? [])],
        onStart: (x) => xhrs.current.set(id, x),
        onProgress: (loaded, total) => {
          const it = patch(id, { progress: total ? Math.round((loaded / total) * 100) : 0 });
          if (!it) return;
          it.onUploadProgress?.({ loaded, total });
          props.current.uploader?.onUploadProgressed?.({ item: instance(it), loaded, total });
        },
      });
      xhrs.current.delete(id);
      const ok = xhr.status >= 200 && xhr.status < 300;
      const done = patch(id, { uploadState: ok ? 'Complete' : 'Error', progress: ok ? 100 : undefined });
      if (!done) return;
      const item = instance(done);
      props.current.uploader?.onUploadCompleted?.({ item, responseXHR: xhr });
      props.current.onUploadCompleted?.({
        item, response: xhr.responseText, readyState: xhr.readyState, status: xhr.status,
        responseXML: (xhr.responseType === '' || xhr.responseType === 'document') ? xhr.responseXML : null, responseText: xhr.responseText, headers: parseHeaders(xhr.getAllResponseHeaders()),
      });
    } catch {
      xhrs.current.delete(id);
      const cur2 = ownRef.current.find((i) => i.id === id);
      if (!cur2) return;
      if (aborted.current.has(id)) {
        aborted.current.delete(id);
        remove(id);
        const item = instance(cur2);
        cur2.onUploadTerminated?.({ item });
        props.current.uploader?.onUploadTerminated?.({ item });
        return;
      }
      patch(id, { uploadState: 'Error', progress: undefined });
    }
  };

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

  const api: UploadSetwithTableRef = {
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
      const item: UploadItem = { id: `sk-upload-${++seq}`, fileName: name, url, uploadState: 'Ready' };
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
  };
  useImperativeHandle(p.ref, () => api);

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
                          {(it.url || it.file || p.uploader?.downloadUrl) && (
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
