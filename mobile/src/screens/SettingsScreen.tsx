// Settings: account, offline-queue status with manual "Sync now", and the server address
// (SecureStore) pointing the app at the PC running the backend.
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../../App';
import { DEFAULT_BASE, getServerBase, logout, setServerBase } from '../api';
import { pendingCounts } from '../db';
import { flushQueue } from '../sync';
import { palette, useUi } from '../ui';

export default function SettingsScreen() {
  const ui = useUi();
  const { user, signOut } = useAuth();
  const [base, setBase] = useState(DEFAULT_BASE);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState<{ changes: number; photos: number } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  async function load() {
    setBase(await getServerBase());
    setPending(await pendingCounts());
  }
  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      await setServerBase(base.trim());
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  async function sync() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const r = await flushQueue();
      setSyncMsg(`Synced ${r.synced} changes + ${r.photosSynced} photos` +
        (r.failed + r.photosFailed > 0 ? ` · ${r.failed + r.photosFailed} pending (offline?)` : ''));
      setPending(await pendingCounts());
    } finally {
      setSyncing(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.bg }} contentContainerStyle={{ padding: ui.pad, gap: ui.gap, paddingBottom: 40 }}>
      <View style={card(ui)}>
        <Text style={{ fontSize: ui.font.h2, fontWeight: '700', color: palette.text }}>Account</Text>
        <Text style={{ color: palette.textDim, fontSize: ui.font.body, marginTop: 4 }}>
          {user?.name} · {user?.email}
        </Text>
        <Pressable onPress={async () => { await logout(); await signOut(); }} style={[btn(ui), { backgroundColor: '#fbe4e0', marginTop: 12 }]}>
          <Text style={{ color: palette.red, fontWeight: '700', fontSize: ui.font.button }}>Sign out</Text>
        </Pressable>
      </View>

      <View style={card(ui)}>
        <Text style={{ fontSize: ui.font.h2, fontWeight: '700', color: palette.text }}>Offline queue</Text>
        <Text style={{ color: palette.textDim, fontSize: ui.font.body, marginTop: 4 }}>
          {pending ? `${pending.changes} changes · ${pending.photos} photos waiting to sync` : 'Checking…'}
        </Text>
        <Pressable onPress={sync} disabled={syncing} style={[btn(ui), { backgroundColor: palette.green700, marginTop: 12 }]}>
          {syncing ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700', fontSize: ui.font.button }}>Sync now</Text>}
        </Pressable>
        {syncMsg && <Text style={{ color: palette.green700, fontSize: ui.font.small, marginTop: 6 }}>{syncMsg}</Text>}
      </View>

      <View style={card(ui)}>
        <Text style={{ fontSize: ui.font.h2, fontWeight: '700', color: palette.text }}>Server address</Text>
        <Text style={{ color: palette.textDim, fontSize: ui.font.small, marginTop: 4 }}>
          The API running on your PC, reachable over Wi-Fi. Default: {DEFAULT_BASE}
        </Text>
        <TextInput
          style={{ backgroundColor: palette.bg, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.line, paddingHorizontal: 12, paddingVertical: 10, fontSize: ui.font.body, color: palette.text, marginTop: 10 }}
          value={base} onChangeText={setBase} autoCapitalize="none" keyboardType="url"
          placeholder="http://192.168.1.7:5092" placeholderTextColor={palette.textDim}
        />
        <Pressable onPress={save} disabled={saving || !base.trim()} style={[btn(ui), { backgroundColor: base.trim() ? palette.green700 : '#a9c5b3', marginTop: 10 }]}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700', fontSize: ui.font.button }}>Save address</Text>}
        </Pressable>
        {saved && <Text style={{ color: palette.green700, fontSize: ui.font.small, marginTop: 6 }}>Saved.</Text>}
      </View>

      <Text style={{ color: palette.textDim, fontSize: ui.font.small, textAlign: 'center' }}>
        OrchardCare v1.0 · Guidance follows HP Horticulture extension practice - confirm with your horticulture officer.
      </Text>
    </ScrollView>
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
  paddingVertical: 11,
  paddingHorizontal: 16,
});
