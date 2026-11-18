/* global sap */
// Fiori elements V4 application component (sap.fe.core.AppComponent); everything else is in manifest.json.
sap.ui.define(['sap/fe/core/AppComponent'], function (AppComponent) {
  'use strict';
  return AppComponent.extend('fe.ref.purchasingparams.Component', { metadata: { manifest: 'json' } });
});
