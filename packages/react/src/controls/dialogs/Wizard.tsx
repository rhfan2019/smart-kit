/**
 * Wizard and WizardStep (sap.m, docs/26 3.9): steps given as JSX children, a progress navigator on top and a next-step
 * button; Scroll mode stacks the reached steps, Page mode shows one. Branching follows `nextStep` / `subsequentSteps`.
 */
import { Button } from '@mantine/core';
import { Check } from 'lucide-react';
import { useEffect, useId, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from 'react';
import { useControlText } from '../context';
import { elementsOf } from '../types';
import { TEXTS } from './texts';

/** sap.m.WizardRenderMode */
export type WizardRenderMode = 'Scroll' | 'Page';
export const WizardRenderMode = { Scroll: 'Scroll', Page: 'Page' } as const;

/** sap.m.PageBackgroundDesign */
export type PageBackgroundDesign = 'List' | 'Solid' | 'Standard' | 'Transparent';
export const PageBackgroundDesign = { List: 'List', Solid: 'Solid', Standard: 'Standard', Transparent: 'Transparent' } as const;

/** sap.ui.core.TitleLevel (for `stepTitleLevel`). */
export type WizardTitleLevel = 'Auto' | 'H1' | 'H2' | 'H3' | 'H4' | 'H5' | 'H6';

export interface $WizardStepSettings {
  /** Step id (used by `nextStep`, `subsequentSteps`, `goToStep`); default: the React key, then the position. */
  id?: string;
  title?: string;
  icon?: ReactNode;
  /** (true) Whether the user may go on to the next step. */
  validated?: boolean;
  /** (false) Adds "(Optional)" to the title. */
  optional?: boolean;
  /** With `enableBranching`: the id of the next step (one of `subsequentSteps`). */
  nextStep?: string;
  /** With `enableBranching`: the ids of the steps that can follow. */
  subsequentSteps?: string[];
  /** Fired when the step becomes the progress step. */
  onActivate?(): void;
  /** Fired when the user goes on from this step. */
  onComplete?(): void;
  children?: ReactNode;
}

/** A step of a Wizard; rendered by the Wizard (alone it renders nothing). */
export function WizardStep(_p: $WizardStepSettings): null {
  return null;
}

/** What `getProgressStep()` returns. */
export interface WizardStepInfo {
  id: string;
  title: string | undefined;
  /** One-based position in the progress. */
  index: number;
}

export interface $WizardSettings {
  children?: ReactNode;
  /** ('Scroll') */
  renderMode?: WizardRenderMode;
  /** (true) */
  showNextButton?: boolean;
  /** ('Review') Text of the next button on the last step. */
  finishButtonText?: string;
  /** (false) */
  enableBranching?: boolean;
  /** The id of the step to show; steps up to it are reached when they are validated. */
  currentStep?: string;
  /** ('auto') CSS width. */
  width?: string;
  /** ('100%') CSS height (the steps scroll inside). */
  height?: string;
  /** ('Standard') */
  backgroundDesign?: PageBackgroundDesign;
  /** ('H3') Heading level of the step titles. */
  stepTitleLevel?: WizardTitleLevel;
  /** Fired when a step becomes the progress step; `index` is one-based. */
  onStepActivate?(e: { index: number }): void;
  /** Fired when the next button of the last step is pressed. */
  onComplete?(): void;
  /** Fired when the user goes to another reached step in the progress navigator. */
  onNavigationChange?(e: { step: WizardStepInfo }): void;
  ref?: Ref<Wizard>;
  'aria-label'?: string;
}

export interface Wizard {
  nextStep(): void;
  previousStep(): void;
  goToStep(stepId: string, focusFirstElement?: boolean): void;
  validateStep(stepId: string): void;
  invalidateStep(stepId: string): void;
  /**
   * Drops the progress after the step and makes it the progress step. With branching and without
   * `preserveNextStep`, the step's `nextStep` is ignored until the prop changes (the user chooses again).
   */
  discardProgress(stepId: string, preserveNextStep?: boolean): void;
  /** Number of reached steps. */
  getProgress(): number;
  getProgressStep(): WizardStepInfo | undefined;
  /** The id of the step shown (UI5 association `currentStep`). */
  getCurrentStep(): string | undefined;
}

interface Step extends $WizardStepSettings { id: string }

export function Wizard(p: $WizardSettings) {
  const t = useControlText(TEXTS);
  const steps: Step[] = elementsOf<$WizardStepSettings>(p.children, WizardStep).map((e, i) => ({ ...e.props, id: e.props.id ?? e.key ?? String(i) }));
  const byId = new Map(steps.map((s) => [s.id, s]));
  const mode = p.renderMode ?? 'Scroll';
  const uid = useId();
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [clearedNext, setClearedNext] = useState<Record<string, boolean>>({});
  const nextOf = (s: Step) => (clearedNext[s.id] ? undefined : s.nextStep);
  const validated = (id: string) => overrides[id] ?? byId.get(id)?.validated ?? true;

  /** The step after `id`: the branch target, or the next one in order. */
  /** With branching: the user still has to choose the next step (several subsequent steps, no `nextStep`). */
  const undecided = (id: string) => Boolean(p.enableBranching && byId.get(id) && !nextOf(byId.get(id)!) && (byId.get(id)!.subsequentSteps?.length ?? 0) > 1);
  const after = (id: string): string | undefined => {
    const s = byId.get(id);
    if (!s) return undefined;
    // With branching (as in UI5) a step without `nextStep` and `subsequentSteps` is the last one.
    if (p.enableBranching) return nextOf(s) ?? (s.subsequentSteps?.length === 1 ? s.subsequentSteps[0] : undefined);
    return steps[steps.indexOf(s) + 1]?.id;
  };
  const reach = (target: string | undefined): string[] => {
    const path = steps[0] ? [steps[0].id] : [];
    while (target && path.at(-1) !== target && validated(path.at(-1)!)) {
      const n = after(path.at(-1)!);
      if (!n || path.includes(n)) break;
      path.push(n);
    }
    return path;
  };
  const [path, setPath] = useState<string[]>(() => reach(p.currentStep));
  const [current, setCurrent] = useState<string | undefined>(() => path.at(-1));
  const sections = useRef(new Map<string, HTMLElement>());
  const progressId = path.at(-1);

  // Drop overrides when the step's own `validated` changes.
  const validatedKey = steps.map((s) => `${s.id}:${s.validated ?? true}`).join('|');
  const lastKey = useRef(validatedKey);
  useEffect(() => {
    if (lastKey.current !== validatedKey) { lastKey.current = validatedKey; setOverrides({}); }
  }, [validatedKey]);
  // ... and the cleared `nextStep` when the prop changes.
  const nextKey = steps.map((s) => `${s.id}:${s.nextStep ?? ''}`).join('|');
  const lastNext = useRef(nextKey);
  useEffect(() => {
    if (lastNext.current !== nextKey) { lastNext.current = nextKey; setClearedNext({}); }
  }, [nextKey]);

  const info = (id: string): WizardStepInfo => ({ id, title: byId.get(id)?.title, index: path.indexOf(id) + 1 });
  const show = (id: string, focus = true) => {
    setCurrent(id);
    if (mode === 'Scroll') requestAnimationFrame(() => {
      const el = sections.current.get(id);
      el?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      if (focus) el?.querySelector<HTMLElement>('input, select, textarea, button, [tabindex="0"]')?.focus();
    });
  };
  const next = () => {
    if (!progressId || !validated(progressId)) return;
    const n = after(progressId);
    byId.get(progressId)?.onComplete?.();
    if (!n) { if (!undecided(progressId)) p.onComplete?.(); return; }
    setPath([...path, n]);
    byId.get(n)?.onActivate?.();
    p.onStepActivate?.({ index: path.length + 1 });
    show(n);
  };
  const discard = (id: string, preserveNextStep = false) => {
    const i = path.indexOf(id);
    if (i < 0) return;
    setPath(path.slice(0, i + 1));
    setCurrent(id);
    if (p.enableBranching && !preserveNextStep) setClearedNext((c) => ({ ...c, [id]: true }));
  };
  const goTo = (id: string, focus?: boolean) => {
    if (path.includes(id)) { show(id, focus ?? true); return; }
    const reached = reach(id);
    if (reached.includes(id)) { setPath(reached); show(id, focus ?? true); }
  };

  useEffect(() => {
    if (p.currentStep && p.currentStep !== current) goTo(p.currentStep, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.currentStep]);

  useImperativeHandle(p.ref, () => ({
    nextStep: next,
    previousStep() { if (path.length > 1) discard(path[path.length - 2]!, true); },
    goToStep: goTo,
    validateStep(id) { setOverrides((o) => ({ ...o, [id]: true })); },
    invalidateStep(id) { setOverrides((o) => ({ ...o, [id]: false })); },
    discardProgress: discard,
    getProgress: () => path.length,
    getProgressStep: () => (progressId ? info(progressId) : undefined),
    getCurrentStep: () => current,
  }));

  // The navigator shows the reached steps and, while the way on is known, the steps still to come.
  const ahead: string[] = [];
  for (let n = progressId && after(progressId); n && !path.includes(n) && !ahead.includes(n); n = after(n)) ahead.push(n);
  const branchOpen = Boolean(progressId) && undecided((ahead.at(-1) ?? progressId)!);
  const nav = [...path, ...ahead];
  const currentIndex = nav.indexOf(current ?? '');
  const total = nav.length;

  const nextButton = (id: string) => {
    if (!(p.showNextButton ?? true)) return null;
    const isProgress = id === progressId;
    if (!isProgress && mode === 'Scroll') return null;
    if (!validated(id)) return null;
    const last = !after(id) && !undecided(id);
    const label = last ? p.finishButtonText ?? t('ctl.wizard.review') : t('ctl.wizard.step', { n: path.indexOf(id) + 2 });
    return (
      <Button className="sk-wizard__next" size="sm" data-sk-wizard-next disabled={isProgress && undecided(id)}
        onClick={() => (isProgress ? next() : (() => { const n = path[path.indexOf(id) + 1]!; show(n); p.onNavigationChange?.({ step: info(n) }); })())}>
        {label}
      </Button>
    );
  };
  const titleOf = (s: Step) => <>{s.title}{s.optional && <>{' '}<span className="sk-wizard__optional">{t('ctl.wizard.optional')}</span></>}</>;
  const level = p.stepTitleLevel && p.stepTitleLevel !== 'Auto' ? p.stepTitleLevel : 'H3';
  const Heading = level.toLowerCase() as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  const shown = mode === 'Page' ? path.filter((id) => id === current) : path;

  return (
    <div
      className={`sk-wizard sk-wizard--${mode.toLowerCase()} sk-wizard--bg-${(p.backgroundDesign ?? 'Standard').toLowerCase()}`}
      style={{ width: p.width ?? 'auto', height: p.height ?? '100%' }} aria-label={p['aria-label']} role="group"
    >
      <nav className="sk-wizard__nav" aria-label={t('ctl.wizard.progress')}>
        <ol className="sk-wizard__steps">
          {nav.map((id, i) => {
            const s = byId.get(id)!;
            const reached = i < path.length;
            const state = id === current ? 'current' : reached ? 'done' : 'upcoming';
            return (
              <li key={id} className={`sk-wizard__nav-step sk-wizard__nav-step--${state}`} aria-current={id === current ? 'step' : undefined}>
                <button type="button" className="sk-wizard__nav-button" disabled={!reached} title={s.title}
                  onClick={() => { show(id); if (id !== current) p.onNavigationChange?.({ step: info(id) }); }}>
                  <span className="sk-wizard__nav-dot" aria-hidden>{state === 'done' && id !== progressId ? <Check className="sk-icon" /> : s.icon ?? i + 1}</span>
                  <span className="sk-wizard__nav-title">{s.title}</span>
                </button>
              </li>
            );
          })}
          {branchOpen && <li className="sk-wizard__nav-step sk-wizard__nav-step--branch" aria-hidden />}
        </ol>
        <div className="sk-wizard__nav-summary" aria-live="polite">{t('ctl.wizard.stepOf', { n: currentIndex + 1, total })}</div>
      </nav>
      <div className="sk-wizard__content">
        {shown.map((id) => {
          const s = byId.get(id)!;
          return (
            <section key={id} ref={(el) => { if (el) sections.current.set(id, el); else sections.current.delete(id); }} className="sk-wizard__step" aria-labelledby={`${uid}-${id}`} data-sk-step={id}>
              <Heading className="sk-wizard__title" id={`${uid}-${id}`}>{path.indexOf(id) + 1}. {titleOf(s)}</Heading>
              <div className="sk-wizard__body">{s.children}</div>
              {nextButton(id)}
            </section>
          );
        })}
      </div>
    </div>
  );
}
