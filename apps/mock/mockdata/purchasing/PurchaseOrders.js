import { contributor } from '../../lib/datasets.mjs';
import { orderHooks } from '../../lib/rules.mjs';

export default contributor('purchasing', 'PurchaseOrders', orderHooks('purchasing'));
