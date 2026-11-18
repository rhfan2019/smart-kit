/* global sap */
// Starts the component chosen in index.html (?app=purchasing | purchasing-draft | purchasing-chart | purchasing-views | purchasing-analytical).
sap.ui.define(['sap/ui/core/ComponentContainer'], function (ComponentContainer) {
  'use strict';
  var name = { 'purchasing-draft': 'fe.ref.purchasingdraft', 'purchasing-chart': 'fe.ref.purchasingchart', 'purchasing-views': 'fe.ref.purchasingviews', 'purchasing-analytical': 'fe.ref.purchasinganalytical' }[window.feReferenceApp] || 'fe.ref.purchasing';
  new ComponentContainer({
    id: 'container',
    name: name,
    async: true,
    manifest: true,
    height: '100%',
    settings: { id: name },
  }).placeAt('content');
});
