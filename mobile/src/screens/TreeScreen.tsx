// Tree detail: guided 360-degree capture ring (8 directions), photo thumbnails, and the
// aggregated photo insight (leaf strength / canopy density / disease risks) with recalculation.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { request, uploadPhoto } from '../api';
import { enqueuePhoto, kvGet } from '../db';
import { flushQueue } from '../sync';
import { Chip, palette, useUi } from '../ui';

const RING: { dir: string; label: string }[] = [
  { dir: 'N', label: 'North' }, { dir: 'NE', label: 'North-East' },
  { dir: 'E', label: 'East' }, { dir: 'SE', label: 'South-East' },
  { dir: 'S', label: 'South' }, { dir: 'SW', label: 'South-West' },
  { dir: 'W', label: 'West' }, { dir: 'NW', label: 'North-West' },
];

interface TreeDetail {
  tree: { id: string; code: string; variety: string | null; latitude: number; longitude: number; heightM: number | null; healthGrade: string | null; healthScore: number | null; leafStrengthScore: number | null; diseaseCode: string | null };
  photos: { id: string; direction: string; thumbUrl: string | null; analysis: any }[];
  photoInsight: { leafStrengthScore: number; canopyDensity: number; scabRisk: number; mildewRisk: number; chlorosisRisk: number; suggestedDiseases: { code: string; confidence: number }[]; confidence: string; note: string } | null;
}

export default function TreeScreen() {
  const ui = useUi();
  const route = useRoute<any>();
  const treeId: string = route.params.id;
  const [detail, setDetail] = useState<TreeDetail | null>(null);
  const [busy, setBusy] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [ringStep, setRingStep] = useState(0);
  const [capturedDirs, setCapturedDirs] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    try {
      const res = await request(`/api/trees/${treeId}`);
      setDetail(res);
      setCapturedDirs(new Set(res.photos.map((p: any) => p.direction)));
    } catch {
      /* offline */
    }
    setBusy(false);
  }

  useFocusEffect(useCallback(() => { load(); }, [treeId]));

  async function takePhoto(direction: string) {
    setStatus(null);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setStatus('Camera permission is needed for the 360° survey.');
        return;
      }
      const shot = await ImagePicker.launchCameraAsync({ quality: 0.8, exif: true });
      if (shot.canceled || shot.assets.length === 0) return;
      const uri = shot.assets[0].uri;

      let headingDeg: number | undefined;
      try {
        const heading = await Location.getHeadingAsync();
        if (heading?.trueHeading != null) headingDeg = Math.round(heading.trueHeading);
      } catch { /* heading not available */ }

      const clientPhotoId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      try {
        await uploadPhoto(treeId, uri, { direction, headingDeg, clientPhotoId });
      } catch {
        await enqueuePhoto(treeId, uri, direction, headingDeg ?? null);
        setStatus('Saved offline - will upload when you have signal.');
      }
      setCapturedDirs((s) => new Set(s).add(direction));
      if (direction === RING[rngIdx(ringStep)]?.dir) advanceRing();
      await load();
    } catch (e: any) {
      setStatus(e.message ?? 'Could not take photo');
    }
  }

  function rngIdx(step: number) { return step % RING.length; }
  function advanceRing() {
    setRingStep((s) => s + 1);
    if (ringStep + 1 >= RING.length) setCapturing(false);
  }

  async function recalculate() {
    setStatus(null);
    try {
      const res = await request(`/api/trees/${treeId}/recalculate`, { method: 'POST' });
      setStatus(`Analysis updated: health ${res.insight.leafStrengthScore}/100 (${res.insight.confidence} confidence)`);
      await load();
    } catch (e: any) {
      setStatus(e.message);
    }
  }

  const insight = detail?.photoInsight;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.bg }} contentContainerStyle={{ padding: ui.pad, gap: ui.gap, paddingBottom: 40 }}>
      {busy && !detail ? <ActivityIndicator color={palette.green700} style={{ marginTop: 24 }} /> : null}

      {detail && (
        <>
          <View style={card(ui)}>
            <Text style={{ fontSize: ui.font.h2, fontWeight: '800', color: palette.text }}>
              {detail.tree.code}{detail.tree.variety ? ` · ${detail.tree.variety}` : ''}
            </Text>
            <View style={{ flexDirection: 'row', gap: ui.gap * 0.6, marginTop: 8, flexWrap: 'wrap' }}>
              {detail.tree.healthScore != null && <Chip label={`Health ${detail.tree.healthScore}/100`} tone={detail.tree.healthScore >= 70 ? 'green' : detail.tree.healthScore >= 50 ? 'amber' : 'red'} />}
              {detail.tree.leafStrengthScore != null && <Chip label={`Leaf strength ${detail.tree.leafStrengthScore}`} tone="grey" />}
              {detail.tree.heightM != null && <Chip label={`${detail.tree.heightM} m tall`} tone="grey" />}
              {detail.tree.diseaseCode && <Chip label={detail.tree.diseaseCode.replace(/-/g, ' ')} tone="red" />}
            </View>
          </View>

          <View style={card(ui)}>
            <Text style={{ fontSize: ui.font.h2, fontWeight: '700', color: palette.text }}>360° photo survey</Text>
            <Text style={{ color: palette.textDim, fontSize: ui.font.small, marginTop: 4 }}>
              Walk slowly around the tree and capture one photo facing each direction. More angles = better analysis.
            </Text>
            {!capturing ? (
              <Pressable onPress={() => { setCapturing(true); setRingStep(0); }} style={({ pressed }) => [btn(ui), { backgroundColor: pressed ? palette.green900 : palette.green700, marginTop: 12 }]}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: ui.font.button }}>Start 360° capture</Text>
              </Pressable>
            ) : (
              <View style={{ marginTop: 12, gap: ui.gap * 0.7 }}>
                <Text style={{ fontSize: ui.font.body, fontWeight: '700', color: palette.green700 }}>
                  Now photograph: {RING[rngIdx(ringStep)].label} ({rngIdx(ringStep) + 1}/8)
                </Text>
                <Pressable onPress={() => takePhoto(RING[rngIdx(ringStep)].dir)} style={[btn(ui), { backgroundColor: palette.green500 }]}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: ui.font.button }}>Open camera</Text>
                </Pressable>
                <Pressable onPress={() => setCapturing(false)} hitSlop={8}>
                  <Text style={{ color: palette.textDim, textAlign: 'center', fontSize: ui.font.small }}>Finish capture</Text>
                </Pressable>
              </View>
            )}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
              {RING.map((r) => (
                <View key={r.dir} style={{ backgroundColor: capturedDirs.has(r.dir) ? palette.green100 : '#eceff0', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ color: capturedDirs.has(r.dir) ? palette.green700 : palette.textDim, fontSize: ui.font.small, fontWeight: '600' }}>{r.dir}</Text>
                </View>
              ))}
            </View>
            {detail.photos.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {detail.photos.slice(0, 8).map((p) => (
                  <Image key={p.id} source={{ uri: p.thumbUrl ?? undefined }} style={{ width: 72, height: 72, borderRadius: 10, backgroundColor: '#e6ebe7' }} />
                ))}
              </View>
            )}
          </View>

          {insight && (
            <View style={card(ui)}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: ui.font.h2, fontWeight: '700', color: palette.text }}>Photo analysis</Text>
                <Chip label={`${insight.confidence} confidence`} tone={insight.confidence === 'full' ? 'green' : insight.confidence === 'partial' ? 'amber' : 'grey'} />
              </View>
              <Metric label="Leaf strength" value={insight.leafStrengthScore} />
              <Metric label="Canopy density" value={insight.canopyDensity} />
              <Metric label="Scab risk" value={insight.scabRisk} inverse />
              <Metric label="Mildew risk" value={insight.mildewRisk} inverse />
              {insight.suggestedDiseases.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {insight.suggestedDiseases.map((d) => (
                    <Chip key={d.code} label={`possible: ${d.code.replace(/-/g, ' ')}`} tone="amber" />
                  ))}
                </View>
              )}
              <Text style={{ color: palette.textDim, fontSize: ui.font.small, marginTop: 10 }}>{insight.note}</Text>
              <Pressable onPress={recalculate} style={[btn(ui), { backgroundColor: '#eceff0', marginTop: 12 }]}>
                <Text style={{ color: palette.text, fontWeight: '600', fontSize: ui.font.button }}>Recalculate from photos</Text>
              </Pressable>
            </View>
          )}

          {status && <Text style={{ color: palette.green700, fontSize: ui.font.small }}>{status}</Text>}
        </>
      )}
    </ScrollView>
  );
}

function Metric({ label, value, inverse }: { label: string; value: number; inverse?: boolean }) {
  const ui = useUi();
  const good = inverse ? value < 40 : value >= 70;
  const warn = inverse ? value < 60 : value >= 50;
  const color = good ? palette.green500 : warn ? palette.amber : palette.red;
  return (
    <View style={{ marginTop: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: palette.textDim, fontSize: ui.font.small }}>{label}</Text>
        <Text style={{ color, fontWeight: '700', fontSize: ui.font.small }}>{value}</Text>
      </View>
      <View style={{ height: 5, backgroundColor: '#eef2ef', borderRadius: 3, marginTop: 4, overflow: 'hidden' }}>
        <View style={{ width: `${Math.min(100, value)}%`, height: '100%', backgroundColor: color }} />
      </View>
    </View>
  );
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
  paddingVertical: 12,
  paddingHorizontal: 18,
});
