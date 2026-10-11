export const unitFactor = unit => ({mm:1000,cm:100,m:1}[unit]||100);
export const measurementKey = (scene,node,index) => `${scene.id}:node-${node.userData.sourceNodeIndex ?? index}`;
export function measurementLabel(draft,guide) {
 const axis=guide.axis||guide.label?.trim()[0],field={G:'width',D:'depth',Y:'height'}[axis],unit=draft.unit||'cm',factor=unitFactor(unit);
 const element=Number(draft.elementDimensions?.[guide.measurementKey||guide.part]?.[field]);
 const product=guide.part==='product'?Number(draft[field]):0;
 const value=element>0?element*factor:product>0?product:guide.value*factor;
 return `${axis} ${Number(value.toFixed(2))} ${unit}`;
}
