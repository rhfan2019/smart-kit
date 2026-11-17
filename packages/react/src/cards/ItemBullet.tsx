/** Bullet micro chart of a list item (CD-17). Loaded lazily by ListContent: only lists that draw bullets ship the micro charts. */
import type { DataPointModel, Row } from '@rhfan2019/smart-kit-core';
import { dataPointCriticality } from '../chart/fromModel';
import { MicroChart } from '../chart/MicroChart';
import { resolveRef } from '../field/values';

export default function ItemBullet({ dp, row, value, label }: { dp: DataPointModel; row: Row; value: number; label: string }) {
  return <MicroChart kind="bullet" label={label} value={value} target={Number(resolveRef(row, dp.targetValue))} criticality={dataPointCriticality(dp, row, value)} />;
}
