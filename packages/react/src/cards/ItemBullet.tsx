/** Bullet micro chart of a list item (CD-17). Loaded lazily by ListContent: only lists that draw bullets ship the micro charts. */
import type { DataPointModel, Row } from '@rhfan2019/smart-kit-core';
import { dataPointCriticality } from '../chart/fromModel';
import { BulletMicroChart } from '../chart/microBullet';
import { resolveRef } from '../field/values';

const COLOR = { 0: 'Neutral', 1: 'Error', 2: 'Critical', 3: 'Good', 5: 'Neutral' } as const;

export default function ItemBullet({ dp, row, value, label }: { dp: DataPointModel; row: Row; value: number; label: string }) {
  const target = Number(resolveRef(row, dp.targetValue));
  const c = dataPointCriticality(dp, row, value);
  return <BulletMicroChart size="Responsive" aria-label={label} targetValue={Number.isFinite(target) ? target : undefined} actual={{ value, color: c === undefined ? undefined : COLOR[c] }} />;
}
