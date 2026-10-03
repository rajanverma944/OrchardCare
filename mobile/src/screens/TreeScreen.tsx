// Tree detail: guided 360-degree capture ring (8 directions), photo thumbnails, and the
// aggregated photo insight (leaf strength / canopy density / disease risks) with recalculation.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { request, uploadPhoto } from '../api';
import { enqueuePhoto, kvGet } from '../db';
import { clientId, flushQueue } from '../sync';
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

      // Emulators have no compass and getHeadingAsync may hang forever - race it.
      let headingDeg: number | undefined;
      try {
        const heading = await Promise.race([
          Location.getHeadingAsync(),
          new Promise<null>((r) => setTimeout(() => r(null), 2500)),
        ]);
        if (heading?.trueHeading != null) headingDeg = Math.round(heading.trueHeading);
      } catch { /* no compass on this device */ }

      const clientPhotoId = clientId();
      try {
        await uploadPhoto(treeId, uri, { direction, headingDeg, clientPhotoId });
      } catch {
        await enqueuePhoto(treeId, uri, direction, headingDeg ?? null);
        setStatus('Saved offline - will upload when you have signal.');
      }
      const updated = new Set(capturedDirs).add(direction);
      setCapturedDirs(updated);
      if (RING.every((r) => updated.has(r.dir))) {
        setCapturing(false);
        setStatus('360° ring complete! Tap "Recalculate from photos" below.');
      }
      await load();
    } catch (e: any) {
      setStatus(e?.message ?? 'Could not take photo');
    }
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
  const nextDir = RING.find((r) => !capturedDirs.has(r.dir)) ?? null;

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
              Keep the trunk centred, stand about 2 m back, and walk clockwise. One photo per direction - the checklist tracks your progress.
            </Text>
            {!capturing ? (
              <Pressable onPress={() => setCapturing(true)} style={({ pressed }) => [btn(ui), { backgroundColor: pressed ? palette.green900 : palette.green700, marginTop: 12 }]}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: ui.font.button }}>Start 360° capture</Text>
              </Pressable>
            ) : (
              <View style={{ marginTop: 12, gap: ui.gap * 0.7 }}>
                <Text style={{ fontSize: ui.font.body, fontWeight: '700', color: palette.green700 }}>
                  {nextDir
                    ? `Next suggested: ${nextDir.label} (${capturedDirs.size}/8 captured)`
                    : 'All 8 directions captured!'}
                </Text>
                {nextDir && (
                  <Pressable onPress={() => takePhoto(nextDir.dir)} style={[btn(ui), { backgroundColor: palette.green500 }]}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: ui.font.button }}>Open camera</Text>
                  </Pressable>
                )}
                <Text style={{ color: palette.textDim, fontSize: ui.font.small }}>Or tap any direction to capture it in any order:</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {RING.map((r) => {
                    const done = capturedDirs.has(r.dir);
                    return (
                      <Pressable
                        key={r.dir}
                        onPress={() => takePhoto(r.dir)}
                        style={{ backgroundColor: done ? palette.green100 : '#eceff0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: r.dir === nextDir?.dir ? palette.green700 : 'transparent' }}
                      >
                        <Text style={{ color: done ? palette.green700 : palette.text, fontSize: ui.font.small, fontWeight: '600' }}>
                          {done ? `${r.dir} ✓` : r.dir}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
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

          <EvidenceMap photos={detail.photos} />
        </>
      )}
    </ScrollView>
  );
}

const DIRECTION_LABELS: Record<string, string> = {
  N: 'North', NE: 'North-East', E: 'East', SE: 'South-East',
  S: 'South', SW: 'South-West', W: 'West', NW: 'North-West',
  CLOSEUP: 'Close-up', CANOPY: 'Canopy top', TRUNK: 'Trunk', OTHER: 'Other angle',
};

/** Evidence map: suspicious areas located on the tree, each linked to its photo. */
function EvidenceMap({ photos }: { photos: { id: string; direction: string; thumbUrl: string | null; analysis: any }[] }) {
  const ui = useUi();
  const rows = photos
    .filter((p) => p.analysis?.regions?.length)
    .flatMap((p) => p.analysis.regions.slice(0, 4).map((r: any, i: number) => ({ key: `${p.id}-${i}`, photo: p, r })));
  if (rows.length === 0) return null;

  const band = (centerY: number) =>
    centerY < 0.33 ? 'upper canopy' : centerY < 0.66 ? 'mid canopy' : 'lower canopy / trunk';

  return (
    <View style={card(ui)}>
      <Text style={{ fontSize: ui.font.h2, fontWeight: '700', color: palette.text }}>Disease evidence</Text>
      <Text style={{ color: palette.textDim, fontSize: ui.font.small, marginTop: 4 }}>
        Suspicious areas detected in your photos, located by viewing direction and height band. Open the photo to inspect the exact spot.
      </Text>
      {rows.map(({ key, photo, r }) => {
        const centerY = r.y + r.h / 2;
        return (
          <View key={key} style={{ flexDirection: 'row', gap: 10, marginTop: 10, alignItems: 'center' }}>
            <Image source={{ uri: photo.thumbUrl ?? undefined }} style={{ width: 48, height: 48, borderRadius: 8, backgroundColor: '#e6ebe7' }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: ui.font.small, fontWeight: '700', color: palette.text }}>
                {DIRECTION_LABELS[photo.direction] ?? photo.direction} · {band(centerY)}
              </Text>
              <Text style={{ color: palette.textDim, fontSize: ui.font.small, marginTop: 2 }}>
                {r.cls === 'lesion' ? 'Lesion-like discolouration' : 'Whitish bloom'} · {Math.round(r.coverage * 100)}% of area
              </Text>
            </View>
            <Chip label={r.cls === 'lesion' ? 'lesion' : 'bloom'} tone={r.cls === 'lesion' ? 'red' : 'amber'} />
          </View>
        );
      })}
      <Text style={{ color: palette.textDim, fontSize: ui.font.small, marginTop: 10 }}>
        Colour-based detection (beta) - treat as hints for closer inspection, not a diagnosis.
      </Text>
    </View>
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
