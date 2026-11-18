/* global sap */
// Starts the component chosen in index.html (?app=purchasing | purchasing-draft).
sap.ui.define(['sap/ui/core/ComponentContainer'], function (ComponentContainer) {
  'use strict';
  var name = window.feReferenceApp === 'purchasing-draft' ? 'fe.ref.purchasingdraft' : 'fe.ref.purchasing';
  new ComponentContainer({
    id: 'container',
    name: name,
    async: true,
    manifest: true,
    height: '100%',
    settings: { id: name },
  }).placeAt('content');
});
