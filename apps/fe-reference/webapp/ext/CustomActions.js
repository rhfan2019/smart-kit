/* global sap */
// Custom actions of the FE reference apps:
// - table action "Copy Numbers" (smart-kit demo: Custom::Copy, requiresSelection);
// - object page: sub-section action "Supplier Info" (shows the side content of Custom::Timeline), header action "Remind"
//   and footer action "Check" (purchasing-op). In FE the handlers run with the ExtensionAPI as `this`.
sap.ui.define(['sap/m/MessageToast'], function (MessageToast) {
  'use strict';
  return {
    copy: function (_context, selected) {
      var ids = (selected || []).map(function (c) { return c.getProperty('PurchaseOrder'); });
      MessageToast.show('Copied: ' + ids.join(', '));
    },
    toggleSupplierInfo: function () {
      this.showSideContent('Custom::Timeline');
    },
    remind: function () {
      MessageToast.show('Reminder sent');
    },
    check: function () {
      MessageToast.show('Checked');
    },
  };
});
