// Product-facing labels; extensions and loader identifiers remain internal.
export function is3DFile(asset){
  return /\.(?:glb|gltf|fbx|obj|mtl|max|blend|3ds|skp|usdz|dwg|dxf|zip|rar|7z)$/i.test(asset?.name||'');
}
export function fileLabel(name=''){
  return String(name).replace(/\.glb\b/gi,' — 3D File').replace(/\bGLB\b|\bglTF\b/gi,'3D File');
}
