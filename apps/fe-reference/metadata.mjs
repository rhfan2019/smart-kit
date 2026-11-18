// $metadata adjustments the FE reference app needs from the test service (see addSiblingEntity).

/**
 * sap.fe needs the draft navigation property `SiblingEntity` on every draft-enabled entity type (it selects
 * `SiblingEntity/IsActiveEntity` for the editing status); the test service does not declare it yet, and without it
 * the draft list report never sends its data request. Add it to each entity type that has `DraftAdministrativeData`
 * (only when missing, so this becomes a no-op once apps/mock declares it). @sap-ux/fe-mockserver-core already
 * evaluates SiblingEntity paths.
 */
export function addSiblingEntity(xml) {
  return xml.replace(/<EntityType Name="(\w+)"[^>]*>[\s\S]*?<\/EntityType>/g, (block, name) => {
    if (!block.includes('<NavigationProperty Name="DraftAdministrativeData"') || block.includes('Name="SiblingEntity"')) return block;
    const ns = /Type="([\w.]+)\.DraftAdministrativeData"/.exec(block)?.[1];
    if (!ns) return block;
    return block.replace('</EntityType>', `  <NavigationProperty Name="SiblingEntity" Type="${ns}.${name}"/>\n      </EntityType>`);
  });
}
