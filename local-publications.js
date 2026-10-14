// Earlier imported catalogue snapshots are not client-demo publications.
export const LOCAL_PUBLICATION_SCOPE='client-demo-v1';
export function isLocalPublication(record){return !!record?.published&&record.localPublication===LOCAL_PUBLICATION_SCOPE;}
export function publishLocal(record,draft,now=new Date().toISOString()){
  record.published=structuredClone(draft);record.publishedAt=now;record.localPublication=LOCAL_PUBLICATION_SCOPE;
}
export function asLocalDraft(record){
  record.published=null;delete record.publishedAt;delete record.localPublication;return record;
}
