// Orchard list: reads SQLite first (offline), refreshes from API, inline create form.
// HealthBar shows average tree health per orchard.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { request } from '../api';
import { cacheOrchards, cachedOrchards, type CachedOrchard } from '../db';
import { Chip, palette, useUi } from '../ui';

export default function OrchardsScreen() {
  const ui = useUi();
  const nav = useNavigation<any>();
  const [orchards, setOrchards] = useState<CachedOrchard[]>([]);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [village, setVillage] = useState('');
  const [elevation, setElevation] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function loadFromCache() {
    setOrchards(await cachedOrchards());
  }

  async function loadFromServer() {
    const res = await request('/api/orchards');
    await cacheOrchards(
      res.orchards.map((o: any) => ({
        id: o.id, name: o.name, village: o.village ?? null,
        latitude: o.latitude ?? null, longitude: o.longitude ?? null,
        elevationM: o.elevationM ?? null, treeCount: o.treeCount ?? 0, avgHealthScore: o.avgHealthScore ?? null,
      })),
    );
    await loadFromCache();
  }

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        setBusy(true);
        await loadFromCache();
        try {
          await loadFromServer();
        } catch {
          /* offline: cache already shown */
        }
        if (alive) setBusy(false);
      })();
      return () => { alive = false; };
    }, []),
  );

  async function create() {
    setError(null);
    try {
      await request('/api/orchards', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          village: village.trim() || undefined,
          elevationM: elevation ? Math.round(parseFloat(elevation)) : undefined,
        }),
      });
      setName(''); setVillage(''); setElevation(''); setCreating(false);
      await loadFromServer();
    } catch (e: any) {
      setError(e.message ?? 'Could not create orchard');
    }
  }

  const card = { backgroundColor: '#fff', borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.line, padding: ui.card };

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <FlatList
        data={orchards}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ padding: ui.pad, gap: ui.gap, paddingBottom: ui.pad * 3 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); try { await loadFromServer(); } catch {} setRefreshing(false); }} />}
        ListHeaderComponent={
          <>
            {busy && orchards.length === 0 ? <ActivityIndicator color={palette.green700} style={{ marginVertical: 24 }} /> : null}
            {!busy && orchards.length === 0 && (
              <View style={[card, { alignItems: 'center', paddingVertical: 28 }]}>
                <Text style={{ color: palette.textDim, fontSize: ui.font.body, textAlign: 'center' }}>
                  No orchards yet.{'\n'}Add your first orchard to start cataloging trees.
                </Text>
              </View>
            )}
            {creating && (
              <View style={[card, { gap: ui.gap }]}>
                <Text style={{ fontSize: ui.font.h2, fontWeight: '700', color: palette.text }}>New orchard</Text>
                <TextInput style={input(ui)} placeholder="Orchard name" placeholderTextColor={palette.textDim} value={name} onChangeText={setName} />
                <TextInput style={input(ui)} placeholder="Village (optional)" placeholderTextColor={palette.textDim} value={village} onChangeText={setVillage} />
                <TextInput style={input(ui)} placeholder="Elevation in metres e.g. 2100 (optional)" placeholderTextColor={palette.textDim} value={elevation} onChangeText={setElevation} keyboardType="number-pad" />
                {error && <Text style={{ color: palette.red, fontSize: ui.font.small }}>{error}</Text>}
                <View style={{ flexDirection: 'row', gap: ui.gap }}>
                  <Pressable onPress={() => setCreating(false)} style={[btn(ui), { backgroundColor: '#eceff0' }]}>
                    <Text style={{ color: palette.text, fontWeight: '600', fontSize: ui.font.button }}>Cancel</Text>
                  </Pressable>
                  <Pressable onPress={create} disabled={!name.trim()} style={[btn(ui), { backgroundColor: name.trim() ? palette.green700 : '#a9c5b3' }]}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: ui.font.button }}>Save</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => nav.navigate('Orchard', { id: item.id, name: item.name, elevationM: item.elevationM, latitude: item.latitude, longitude: item.longitude })}
            style={({ pressed }) => [card, pressed && { opacity: 0.85 }]}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: ui.font.h2, fontWeight: '700', color: palette.text }}>{item.name}</Text>
                {item.village ? <Text style={{ color: palette.textDim, fontSize: ui.font.small, marginTop: 2 }}>{item.village}{item.elevationM ? ` · ${item.elevationM} m` : ''}</Text> : null}
              </View>
              <Chip label={`${item.treeCount} trees`} tone="green" />
            </View>
            {item.avgHealthScore != null && (
              <View style={{ marginTop: 10 }}>
                <HealthBar score={item.avgHealthScore} />
              </View>
            )}
          </Pressable>
        )}
        ListFooterComponent={
          !creating ? (
            <Pressable onPress={() => setCreating(true)} style={({ pressed }) => [btn(ui), { backgroundColor: pressed ? palette.green900 : palette.green700, alignSelf: 'center', minWidth: 200, marginTop: 4 }]}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: ui.font.button }}>+ Add orchard</Text>
            </Pressable>
          ) : null
        }
      />
    </View>
  );
}

export function HealthBar({ score }: { score: number }) {
  const ui = useUi();
  const color = score >= 75 ? palette.green500 : score >= 50 ? palette.amber : palette.red;
  return (
    <View>
      <View style={{ height: 6 * ui.gap * 0.6, backgroundColor: '#eef2ef', borderRadius: 4, overflow: 'hidden' }}>
        <View style={{ width: `${score}%`, height: '100%', backgroundColor: color, borderRadius: 4 }} />
      </View>
      <Text style={{ color: palette.textDim, fontSize: ui.font.small, marginTop: 4 }}>Average health: {score}/100</Text>
    </View>
  );
}

const input = (ui: ReturnType<typeof useUi>) => ({
  backgroundColor: '#fff',
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
  flex: 1,
});
