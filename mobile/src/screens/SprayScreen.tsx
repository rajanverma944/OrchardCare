// Per-orchard spray calendar rendered from the backend plan (12 Shimla stages, elevation-
// shifted dates). Expand a stage for products/rates/bee-safety; mark-as-sprayed records it.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { request } from '../api';
import { kvGet, kvSet } from '../db';
import { Chip, palette, useUi } from '../ui';

interface Stage {
  taskId: string;
  key: string;
  kind: 'spray' | 'care';
  name: string;
  targets: string[];
  products: { name: string; rate: string; target: string; organic?: boolean }[];
  beeSafety: string | null;
  advice: string;
  plannedStart: string;
  plannedEnd: string;
  status: 'done' | 'skipped' | 'overdue' | 'in-window' | 'due-soon' | 'upcoming';
  productUsed: string | null;
}

const STATUS_META: Record<Stage['status'], { label: string; tone: 'green' | 'amber' | 'red' | 'grey' }> = {
  done: { label: 'Done', tone: 'green' },
  skipped: { label: 'Skipped', tone: 'grey' },
  overdue: { label: 'Overdue', tone: 'red' },
  'in-window': { label: 'In window now', tone: 'amber' },
  'due-soon': { label: 'Due within a week', tone: 'amber' },
  upcoming: { label: 'Upcoming', tone: 'grey' },
};

export default function SprayScreen() {
  const ui = useUi();
  const [orchards, setOrchards] = useState<{ id: string; name: string }[]>([]);
  const [orchardId, setOrchardId] = useState<string | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [busy, setBusy] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [product, setProduct] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await request('/api/orchards');
        const list = res.orchards.map((o: any) => ({ id: o.id, name: o.name }));
        setOrchards(list);
        if (list.length > 0) {
          const remembered = await kvGet('spray.orchardId');
          const pick = list.find((o: any) => o.id === remembered)?.id ?? list[0].id;
          setOrchardId(pick);
        }
      } catch {
        /* offline */
      }
      setBusy(false);
    })();
  }, []);

  useEffect(() => {
    if (!orchardId) return;
    kvSet('spray.orchardId', orchardId);
    setBusy(true);
    request(`/api/spray/orchards/${orchardId}/plan?season=${new Date().getFullYear()}`)
      .then((res) => setStages(res.stages))
      .catch(() => setStages([]))
      .finally(() => setBusy(false));
  }, [orchardId]);

  async function markDone(stage: Stage) {
    try {
      await request(`/api/spray/tasks/${stage.taskId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'done', productUsed: product.trim() || undefined }),
      });
      setProduct('');
      setStages((ss) => ss.map((s) => (s.taskId === stage.taskId ? { ...s, status: 'done' } : s)));
    } catch {
      /* keep UI optimistic-fail silent */
    }
  }

  if (busy && stages.length === 0) {
    return <View style={{ flex: 1, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={palette.green700} /></View>;
  }

  if (orchards.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center', padding: ui.pad }}>
        <Text style={{ color: palette.textDim, textAlign: 'center', fontSize: ui.font.body }}>
          Add an orchard first - the spray calendar is generated per orchard with elevation-based date shifts.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.bg }} contentContainerStyle={{ padding: ui.pad, gap: ui.gap, paddingBottom: 40 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {orchards.map((o) => (
          <Pressable key={o.id} onPress={() => setOrchardId(o.id)} style={{ backgroundColor: o.id === orchardId ? palette.green700 : '#fff', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.line }}>
            <Text style={{ color: o.id === orchardId ? '#fff' : palette.text, fontWeight: '600', fontSize: ui.font.small }}>{o.name}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {stages.map((s) => {
        const meta = STATUS_META[s.status];
        const open = expanded === s.taskId;
        return (
          <View key={s.taskId} style={card(ui)}>
            <Pressable onPress={() => setExpanded(open ? null : s.taskId)}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: ui.font.body, fontWeight: '700', color: palette.text }}>{s.name}</Text>
                  <Text style={{ color: palette.textDim, fontSize: ui.font.small, marginTop: 3 }}>
                    {fmt(s.plannedStart)} - {fmt(s.plannedEnd)}
                  </Text>
                </View>
                <Chip label={meta.label} tone={meta.tone} />
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {s.targets.map((t) => <Chip key={t} label={t} tone="grey" />)}
              </View>
            </Pressable>

            {open && (
              <View style={{ marginTop: 12, gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line, paddingTop: 10 }}>
                {s.products.map((p) => (
                  <View key={p.name}>
                    <Text style={{ fontSize: ui.font.small, fontWeight: '700', color: palette.text }}>
                      {p.name}{p.organic ? ' (organic option)' : ''}
                    </Text>
                    <Text style={{ color: palette.textDim, fontSize: ui.font.small }}>{p.rate} - {p.target}</Text>
                  </View>
                ))}
                <Text style={{ color: palette.text, fontSize: ui.font.small, lineHeight: 18 }}>{s.advice}</Text>
                {s.beeSafety && <Text style={{ color: palette.amber === '#d9a441' ? '#8a6414' : palette.amber, fontSize: ui.font.small }}>🐝 {s.beeSafety}</Text>}
                {s.status !== 'done' && s.kind === 'spray' && (
                  <View style={{ gap: 8, marginTop: 4 }}>
                    <TextInput
                      style={{ backgroundColor: palette.bg, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.line, paddingHorizontal: 12, paddingVertical: 9, fontSize: ui.font.small, color: palette.text }}
                      placeholder="Product actually used (optional)"
                      placeholderTextColor={palette.textDim}
                      value={product}
                      onChangeText={setProduct}
                    />
                    <Pressable onPress={() => markDone(s)} style={[btn(ui), { backgroundColor: palette.green700 }]}>
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: ui.font.button }}>Mark as sprayed</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}
          </View>
        );
      })}

      <Text style={{ color: palette.textDim, fontSize: ui.font.small, textAlign: 'center', paddingHorizontal: 12 }}>
        Dates shift with your orchard elevation. Always confirm products/rates with your Circle Horticulture Development Officer and the label.
      </Text>
    </ScrollView>
  );
}

function fmt(iso: string): string {
  const [y, m, d] = iso.split('-').map((x) => parseInt(x, 10));
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${months[m - 1]}`;
}

const card = (ui: ReturnType<typeof useUi>) => ({
  backgroundColor: '#fff',
  borderRadius: 14,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: palette.line,
  padding: ui.card,
});

const btn = (ui: ReturnType<typeof useUi>) => ({
  borderRadius: 12,
  alignItems: 'center' as const,
  paddingVertical: 11,
  paddingHorizontal: 16,
});
