// One session-owned anchor. Never attach furniture to the viewer/camera space.
export class ARWorldAnchor {
  constructor(){this.anchor=null;this.pending=null;this.generation=0;this.mode='idle';}
  clear(){this.generation++;this.anchor?.delete();this.anchor=null;this.pending=null;this.mode='idle';}
  request(position,orientation){
    this.clear();this.pending={position:{x:position.x,y:position.y,z:position.z},orientation:{x:orientation.x,y:orientation.y,z:orientation.z,w:orientation.w}};this.mode='pending';
  }
  update(frame,reference){
    if(this.pending){
      const requested=this.pending;this.pending=null;const generation=this.generation;
      if(typeof frame.createAnchor!=='function'||typeof XRRigidTransform!=='function')this.mode='local';
      else try{
        const promise=frame.createAnchor(new XRRigidTransform(requested.position,requested.orientation),reference);
        Promise.resolve(promise).then(anchor=>{
          if(generation!==this.generation){anchor.delete();return;}
          this.anchor=anchor;this.mode='anchored';
        }).catch(()=>{if(generation===this.generation)this.mode='local';});
      }catch{this.mode='local';}
    }
    if(!this.anchor)return null;
    // Newly created anchors may not be materialized in the current XR frame.
    if(frame.trackedAnchors&&!frame.trackedAnchors.has(this.anchor))return null;
    try{return frame.getPose(this.anchor.anchorSpace,reference);}catch{return null;}
  }
}
