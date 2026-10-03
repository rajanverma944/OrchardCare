// Harvest survey runner: pick orchard -> start/open this season's survey -> record trees.
// Live pruning verdict is computed locally for instant feedback; server recomputes on save.
// Offline entries fall back to the sync queue.
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ApiError, request } from '../api';
import { clientId } from '../sync';
import { enqueue } from '../db';
import { Chip, palette, useUi } from '../ui';

interface TreeLite { id: string; code: string; variety: string | null }

export default function SurveyScreen() {
  const ui = useUi();
  const [orchards, setOrchards] = useState<{ id: string; name: string }[]>([]);
  const [orchardId, setOrchardId] = useState<string | null>(null);
  const [trees, setTrees] = useState<TreeLite[]>([]);
  const [surveyId, setSurveyId] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [selected, setSelected] = useState<TreeLite | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [status, setStatus] = useState<string | null>(null);

  // entry fields
  const [fruitCount, setFruitCount] = useState('');
  const [fruitWeight, setFruitWeight] = useState('150');
  const [canopy, setCanopy] = useState('50');
  const [bareWood, setBareWood] = useState('0');
  const [sprouts, setSprouts] = useState('0');

  useEffect(() => {
    (async () => {
      try {
        const res = await request('/api/orchards');
        const list = res.orchards.map((o: any) => ({ id: o.id, name: o.name }));
        setOrchards(list);
        if (list.length > 0) setOrchardId(list[0].id);
      } catch {}
      setBusy(false);
    })();
  }, []);

  useEffect(() => {
    if (!orchardId) return;
    (async () => {
      setBusy(true);
      setSurveyId(null);
      setSummary(null);
      try {
        const [treeRes, surveyRes] = await Promise.all([
          request(`/api/trees/orchards/${orchardId}/trees`),
          request(`/api/surveys/orchards/${orchardId}/surveys`),
        ]);
        setTrees(treeRes.trees.map((t: any) => ({ id: t.id, code: t.code, variety: t.variety })));
        const open = surveyRes.surveys.find((s: any) => s.type === 'harvest' && s.completedAt == null && s.season === String(new Date().getFullYear()));
        if (open) {
          setSurveyId(open.id);
          const detail = await request(`/api/surveys/${open.id}`);
          setSummary(detail.summary);
        }
      } catch {}
      setBusy(false);
    })();
  }, [orchardId]);

  async function startSurvey() {
    if (!orchardId) return;
    try {
      const res = await request(`/api/surveys/orchards/${orchardId}/surveys`, {
        method: 'POST',
        body: JSON.stringify({ type: 'harvest', season: String(new Date().getFullYear()) }),
      });
      setSurveyId(res.surveyId);
      setStatus('Survey started. Walk the rows and record each tree.');
    } catch (e: any) {
      setStatus(e.message);
    }
  }

  const verdict = useMemo(() => {
    const c = parseInt(canopy, 10);
    const b = parseInt(bareWood, 10);
    const sp = parseInt(sprouts, 10);
    if (b >= 45 || c <= 30) return { level: 'renewal', why: 'Severe bare wood / very sparse canopy - plan rejuvenation.' };
    if (b >= 30 || c <= 45) return { level: 'heavy', why: 'Open the tree with corrective thinning cuts.' };
    if (b >= 18 || sp >= 15) return { level: 'moderate', why: 'Regular sanitary + thinning prune this winter.' };
    if (sp >= 6 || c <= 60) return { level: 'light', why: 'Light maintenance prune.' };
    return { level: 'none', why: 'Balanced canopy - routine care only.' };
  }, [canopy, bareWood, sprouts]);

  async function saveEntry() {
    if (!surveyId || !selected) return;
    const payload: Record<string, unknown> = {
      treeId: selected.id,
      clientEntryId: clientId(),
      canopyDensity: clamp(parseInt(canopy, 10) || 0, 0, 100),
      bareWoodRatio: clamp(parseInt(bareWood, 10) || 0, 0, 100),
      waterSprouts: clamp(parseInt(sprouts, 10) || 0, 0, 500),
    };
    const fc = parseInt(fruitCount, 10);
    const fw = parseInt(fruitWeight, 10);
    if (!Number.isNaN(fc) && fc > 0) payload.fruitCountEst = fc;
    if (!Number.isNaN(fw) && fw >= 20) payload.avgFruitWeightG = fw;

    try {
      const res = await request(`/api/surveys/${surveyId}/entries`, { method: 'POST', body: JSON.stringify(payload) });
      const kg = res.estimatedYieldKg != null ? ` · ${res.estimatedYieldKg} kg` : '';
      setStatus(`${selected.code} saved (${res.computedPruning} pruning${kg}). Next tree!`);
      const detail = await request(`/api/surveys/${surveyId}`);
      setSummary(detail.summary);
    } catch (e: any) {
      if (e instanceof ApiError) {
        setStatus(`Could not save: ${e.message}`);
      } else {
        try {
          await enqueue({ clientId: payload.clientEntryId as string, op: 'survey.entry.create', payload: { ...payload, surveyId } });
          setStatus(`${selected.code} saved offline - will sync with signal.`);
        } catch {
          setStatus('Could not save entry.');
        }
      }
    }
    setSelected(null);
    setFruitCount('');
    setCanopy('50'); setBareWood('0'); setSprouts('0');
  }

  if (busy) {
    return <View style={{ flex: 1, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={palette.green700} /></View>;
  }
  if (orchards.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center', padding: ui.pad }}>
        <Text style={{ color: palette.textDim, textAlign: 'center', fontSize: ui.font.body }}>Add an orchard and trees first.</Text>
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

      {!surveyId ? (
        <Pressable onPress={startSurvey} style={[btn(ui), { backgroundColor: palette.green700 }]}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: ui.font.button }}>Start {new Date().getFullYear()} harvest survey</Text>
        </Pressable>
      ) : (
        <>
          {summary && (
            <View style={card(ui)}>
              <Text style={{ fontSize: ui.font.h2, fontWeight: '700', color: palette.text }}>Progress</Text>
              <Text style={{ color: palette.textDim, fontSize: ui.font.small, marginTop: 4 }}>
                {summary.surveyedCount} trees recorded · avg {summary.avgYieldKg ?? '-'} kg/tree · projected {summary.projectedOrchardKg ?? '-'} kg
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                <Chip label={`renewal: ${summary.pruningCounts.renewal ?? 0}`} tone="red" />
                <Chip label={`heavy: ${summary.pruningCounts.heavy ?? 0}`} tone="amber" />
                <Chip label={`moderate: ${summary.pruningCounts.moderate ?? 0}`} tone="amber" />
                <Chip label={`light: ${summary.pruningCounts.light ?? 0}`} tone="green" />
                <Chip label={`none: ${summary.pruningCounts.none ?? 0}`} tone="green" />
              </View>
            </View>
          )}

          <View style={card(ui)}>
            <Text style={{ fontSize: ui.font.h2, fontWeight: '700', color: palette.text }}>Record a tree</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {trees.map((t) => (
                <Pressable key={t.id} onPress={() => setSelected(t)} style={{ backgroundColor: selected?.id === t.id ? palette.green700 : '#eceff0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
                  <Text style={{ color: selected?.id === t.id ? '#fff' : palette.text, fontWeight: '600', fontSize: ui.font.small }}>{t.code}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {selected && (
            <View style={card(ui)}>
              <Text style={{ fontSize: ui.font.body, fontWeight: '700', color: palette.text }}>{selected.code} - harvest & canopy check</Text>
              <View style={{ flexDirection: 'row', gap: ui.gap, marginTop: 10 }}>
                <View style={{ flex: 1, gap: 10 }}>
                  {simpleField(ui, 'Fruit count (est.)', fruitCount, setFruitCount, 'e.g. 180')}
                  {simpleField(ui, 'Avg fruit weight (g)', fruitWeight, setFruitWeight, '150')}
                </View>
                <View style={{ flex: 1, gap: 10 }}>
                  {simpleField(ui, 'Canopy density %', canopy, setCanopy, 'foliage fullness')}
                  {simpleField(ui, 'Bare wood %', bareWood, setBareWood, 'dead/bare wood')}
                  {simpleField(ui, 'Water sprouts', sprouts, setSprouts, 'upright shoots')}
                </View>
              </View>
              <View style={{ backgroundColor: palette.green100, borderRadius: 10, padding: 10, marginTop: 10 }}>
                <Text style={{ color: palette.green700, fontWeight: '700', fontSize: ui.font.small }}>
                  Pruning verdict: {verdict.level.toUpperCase()}
                </Text>
                <Text style={{ color: palette.textDim, fontSize: ui.font.small, marginTop: 2 }}>{verdict.why}</Text>
              </View>
              <Pressable onPress={saveEntry} style={[btn(ui), { backgroundColor: palette.green700, marginTop: 10 }]}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: ui.font.button }}>Save entry</Text>
              </Pressable>
            </View>
          )}
        </>
      )}

      {status && <Text style={{ color: palette.green700, fontSize: ui.font.small, textAlign: 'center' }}>{status}</Text>}
    </ScrollView>
  );
}

function simpleField(ui: ReturnType<typeof useUi>, label: string, value: string, setter: (v: string) => void, hint: string) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ fontSize: ui.font.small, fontWeight: '600', color: palette.text }}>{label}</Text>
      <TextInput
        style={{ backgroundColor: palette.bg, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.line, paddingHorizontal: 12, paddingVertical: 9, fontSize: ui.font.body, color: palette.text }}
        placeholder={hint} placeholderTextColor={palette.textDim} value={value} onChangeText={setter} keyboardType="number-pad"
      />
    </View>
  );
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

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
