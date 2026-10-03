// Trees of one orchard. "Add tree" grabs GPS via expo-location and either POSTs directly
// or enqueues a tree.create sync op when offline. Tapping a tree opens the 360 capture.
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import * as Location from 'expo-location';
import { clientId } from '../sync';
import { request } from '../api';
import { cacheTrees, cachedTrees, enqueue, type CachedTree } from '../db';
import { Chip, palette, useUi } from '../ui';

const GRADE_TONE: Record<string, 'green' | 'amber' | 'red' | 'grey'> = {
  excellent: 'green', good: 'green', fair: 'amber', poor: 'red', critical: 'red',
};

export default function OrchardScreen() {
  const ui = useUi();
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const orchardId: string = route.params.id;
  const [trees, setTrees] = useState<CachedTree[]>([]);
  const [busy, setBusy] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [code, setCode] = useState('');
  const [variety, setVariety] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function loadFromCache() {
    setTrees(await cachedTrees(orchardId));
  }

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        setBusy(true);
        await loadFromCache();
        try {
          const res = await request(`/api/trees/orchards/${orchardId}/trees`);
          await cacheTrees(orchardId, res.trees);
          await loadFromCache();
        } catch {
          /* offline */
        }
        if (alive) setBusy(false);
      })();
      return () => { alive = false; };
    }, [orchardId]),
  );

  /**
   * Acquire a GPS fix, but never block the save: emulators and indoor orchard
   * edges often have no fix, so acquisition is raced against a timeout and
   * falls back to the orchard's recorded position.
   */
  async function acquirePosition(timeoutMs: number) {
    const race = <T,>(p: Promise<T>): Promise<T | null> =>
      Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), timeoutMs))]);
    try {
      const perm = await race(Location.requestForegroundPermissionsAsync());
      if (!perm || !perm.granted) return null;
      const last = await race(Location.getLastKnownPositionAsync());
      if (last?.coords) {
        return { latitude: last.coords.latitude, longitude: last.coords.longitude, accuracy: last.coords.accuracy ?? null };
      }
      const pos = await race(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      if (pos?.coords) {
        return { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy ?? null };
      }
      return null;
    } catch {
      return null;
    }
  }

  async function addTree() {
    if (saving) return;
    setError(null);
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        code: code.trim(),
        variety: variety.trim() || undefined,
        clientTreeId: clientId(),
      };
      const gps = await acquirePosition(8000);
      payload.latitude = gps?.latitude ?? (route.params?.latitude as number | undefined) ?? 31.21;
      payload.longitude = gps?.longitude ?? (route.params?.longitude as number | undefined) ?? 77.42;
      if (gps?.accuracy != null) payload.gpsAccuracyM = Math.round(gps.accuracy);

      try {
        await request(`/api/trees/orchards/${orchardId}/trees`, { method: 'POST', body: JSON.stringify(payload) });
      } catch {
        // Offline: queue the creation with the orchard id embedded for sync
        await enqueue({ clientId: payload.clientTreeId as string, op: 'tree.create', payload: { ...payload, orchardId } });
      }
      setCode(''); setVariety(''); setAdding(false);
      await loadFromCache();
      try {
        const res = await request(`/api/trees/orchards/${orchardId}/trees`);
        await cacheTrees(orchardId, res.trees);
        await loadFromCache();
      } catch {}
    } catch (e: any) {
      setError(e?.message ?? 'Could not add tree');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <FlatList
        data={trees}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ padding: ui.pad, gap: ui.gap, paddingBottom: ui.pad * 3 }}
        ListEmptyComponent={
          busy ? <ActivityIndicator color={palette.green700} style={{ marginVertical: 24 }} /> : (
            <Text style={{ color: palette.textDim, textAlign: 'center', fontSize: ui.font.body, marginTop: 24 }}>
              No trees yet. Add trees one by one in the field - GPS is recorded automatically.
            </Text>
          )
        }
        renderItem={({ item }) => (
          <Pressable style={({ pressed }) => [treeCard(ui), pressed && { opacity: 0.85 }]} onPress={() => nav.navigate('Tree', { id: item.id, code: item.code })}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: ui.gap }}>
              <View style={{ backgroundColor: palette.green100, borderRadius: 10, width: 46 * ui.gap * 0.7, height: 46 * ui.gap * 0.7, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: palette.green700, fontWeight: '800', fontSize: ui.font.body }}>{item.code.slice(0, 3)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: ui.font.body, fontWeight: '700', color: palette.text }}>
                  {item.code}{item.variety ? ` · ${item.variety}` : ''}
                </Text>
                <Text style={{ color: palette.textDim, fontSize: ui.font.small, marginTop: 2 }}>
                  {item.photoCount} photos{item.healthScore != null ? ` · health ${item.healthScore}` : ''}
                  {item.leafStrengthScore != null ? ` · leaf ${item.leafStrengthScore}` : ''}
                </Text>
              </View>
              {item.diseaseCode ? <Chip label={item.diseaseCode.replace(/-/g, ' ')} tone="red" /> : item.healthGrade ? <Chip label={item.healthGrade} tone={GRADE_TONE[item.healthGrade] ?? 'grey'} /> : null}
            </View>
          </Pressable>
        )}
        ListFooterComponent={
          !adding ? (
            <Pressable onPress={() => setAdding(true)} style={({ pressed }) => [btn(ui), { backgroundColor: pressed ? palette.green900 : palette.green700, alignSelf: 'center', minWidth: 180, marginTop: 4 }]}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: ui.font.button }}>+ Add tree</Text>
            </Pressable>
          ) : null
        }
      />
      {adding && (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: ui.pad, gap: ui.gap, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 12, elevation: 8 }}>
          <Text style={{ fontSize: ui.font.h2, fontWeight: '700', color: palette.text }}>Add tree</Text>
          <TextInput style={input(ui)} placeholder="Tree code e.g. A-017" placeholderTextColor={palette.textDim} value={code} onChangeText={setCode} autoCapitalize="characters" />
          <TextInput style={input(ui)} placeholder="Variety e.g. Royal Delicious (optional)" placeholderTextColor={palette.textDim} value={variety} onChangeText={setVariety} />
          <Text style={{ color: palette.textDim, fontSize: ui.font.small }}>Your GPS position will be attached automatically.</Text>
          {error && <Text style={{ color: palette.red, fontSize: ui.font.small }}>{error}</Text>}
          <View style={{ flexDirection: 'row', gap: ui.gap }}>
            <Pressable onPress={() => setAdding(false)} disabled={saving} style={[btn(ui), { backgroundColor: '#eceff0' }]}>
              <Text style={{ color: palette.text, fontWeight: '600', fontSize: ui.font.button }}>Cancel</Text>
            </Pressable>
            <Pressable onPress={addTree} disabled={!code.trim() || saving} style={[btn(ui), { backgroundColor: code.trim() && !saving ? palette.green700 : '#a9c5b3' }]}>
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: '#fff', fontWeight: '700', fontSize: ui.font.button }}>Save tree</Text>}
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const treeCard = (ui: ReturnType<typeof useUi>) => ({
  backgroundColor: '#fff',
  borderRadius: 14,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: palette.line,
  padding: ui.card,
});

const input = (ui: ReturnType<typeof useUi>) => ({
  backgroundColor: palette.bg,
  borderRadius: 12,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: palette.line,
  paddingHorizontal: 14,
  paddingVertical: 11,
  fontSize: ui.font.body,
  color: palette.text,
});

const btn = (ui: ReturnType<typeof useUi>) => ({
  borderRadius: 12,
  alignItems: 'center' as const,
  paddingVertical: 12,
  paddingHorizontal: 18,
});
