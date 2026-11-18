/* global sap */
// Custom table action "Copy Numbers" (smart-kit demo: tableExtend Custom::Copy, requiresSelection).
sap.ui.define(['sap/m/MessageToast'], function (MessageToast) {
  'use strict';
  return {
    copy: function (_context, selected) {
      var ids = (selected || []).map(function (c) { return c.getProperty('PurchaseOrder'); });
      MessageToast.show('Copied: ' + ids.join(', '));
    },
  };
});
