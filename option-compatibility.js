// Product-authored, ID-based compatibility. Missing rules preserve legacy behavior.
export function orderedGroups(draft) {
  const groups = draft.componentGroups || [], result = [], visiting = new Set(), visited = new Set();
  function visit(group) {
    if (visited.has(group.id) || visiting.has(group.id)) return;
    visiting.add(group.id);
    const parent = groups.find(g => g.id === group.compatibility?.sourceGroupId);
    if (parent) visit(parent);
    visiting.delete(group.id); visited.add(group.id); result.push(group);
  }
  groups.forEach(visit);
  return result;
}

export function allowedOptions(group, selection) {
  if (!group.compatibility) return group.options;
  const rule = group.compatibility.choices?.[selection.get(group.compatibility.sourceGroupId)];
  return group.options.filter(o => rule?.allowedIds?.includes(o.id));
}

export function resolveCompatibility(draft, selection = new Map()) {
  const changes = [];
  for (const group of orderedGroups(draft)) {
    const previous = selection.get(group.id) || group.defaultId;
    const allowed = allowedOptions(group, selection);
    const rule = group.compatibility?.choices?.[selection.get(group.compatibility.sourceGroupId)];
    const preferred = group.compatibility ? rule?.defaultId : group.defaultId;
    const next = allowed.some(o => o.id === previous) ? previous : allowed.find(o => o.id === preferred)?.id || null;
    selection.set(group.id, next);
    if (next !== previous) changes.push({ groupId: group.id, previous, next });
  }
  return changes;
}

export function compatibilityErrors(draft) {
  const groups = draft.componentGroups || [], errors = [];
  for (const group of groups) {
    const config = group.compatibility;
    if (!config) continue;
    const parent = groups.find(g => g.id === config.sourceGroupId);
    if (!parent || parent.id === group.id) { errors.push(`${group.name}: geçerli bir kaynak grubu seçin.`); continue; }
    const seen = new Set([group.id]); let cursor = parent;
    while (cursor) {
      if (seen.has(cursor.id)) { errors.push(`${group.name}: döngüsel uyumluluk bağlantısı.`); break; }
      seen.add(cursor.id); cursor = groups.find(g => g.id === cursor.compatibility?.sourceGroupId);
    }
    for (const source of parent.options) {
      const rule = config.choices?.[source.id];
      if (!rule?.allowedIds?.length || rule.allowedIds.some(id => !group.options.some(o => o.id === id)) || !rule.allowedIds.includes(rule.defaultId))
        errors.push(`${group.name} / ${source.label}: uyumlu seçenekler ve geçerli varsayılan seçim gerekli.`);
    }
    if (Object.keys(config.choices || {}).some(id => !parent.options.some(o => o.id === id))) errors.push(`${group.name}: kaldırılmış kaynak seçeneğinin kuralını düzenleyin.`);
  }
  return [...new Set(errors)];
}
