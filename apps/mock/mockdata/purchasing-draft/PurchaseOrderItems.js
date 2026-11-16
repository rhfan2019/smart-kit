import { contributor } from '../../lib/datasets.mjs';
import { itemHooks } from '../../lib/rules.mjs';

export default contributor('purchasing-draft', 'PurchaseOrderItems', itemHooks());
