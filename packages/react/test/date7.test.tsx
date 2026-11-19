/** Stage 7 (date7): date filter fields without Capabilities.FilterExpressionRestrictions offer no relative dates (FE getOperatorsForDateProperty). */
import ConditionInput from '@rhfan2019/smart-kit/kit/ConditionInput';
import type { Condition } from '@rhfan2019/smart-kit-core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { wrap } from './helpers';

function Field({ path, conditions = [] }: { path: string; conditions?: Condition[] }) {
  return <ConditionInput entitySet="Products" path={path} label={path} conditions={conditions} onChange={() => undefined} />;
}

describe('AL-11 date7 unrestricted date filter fields', () => {
  it('AL-11 an unrestricted Edm.DateTimeOffset field has no relative dates button', () => {
    render(wrap(<Field path="ChangedAt" />));
    expect(screen.queryByRole('button', { name: 'Relative dates' })).toBeNull();
    expect(document.querySelector('[data-sk-relative-dates]')).toBeNull();
  });

  it('AL-11 a SingleRange Edm.Date field keeps the relative dates button (FE semantic date range)', () => {
    render(wrap(<Field path="ReleaseDate" />));
    expect(screen.getByRole('button', { name: 'Relative dates' })).toBeInTheDocument();
  });
});
