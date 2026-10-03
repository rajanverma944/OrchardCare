// Advice handbook: month-by-month care calendar + disease/pest encyclopedia.
// Fetched once and cached in SQLite (kv) - fully readable offline.
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { request } from '../api';
import { kvGet, kvSet } from '../db';
import { Chip, palette, useUi } from '../ui';

interface Article { id: string; month: number; category: string; title: string; body: string }
interface Disease { code: string; name: string; category: string; signs: string; window: string; organic: string[]; chemical: string[] }

const MONTHS = ['All year', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function AdviceScreen() {
  const ui = useUi();
  const [tab, setTab] = useState<'calendar' | 'diseases'>('calendar');
  const [articles, setArticles] = useState<Article[]>([]);
  const [diseases, setDiseases] = useState<Disease[]>([]);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [open, setOpen] = useState<string | null>(null);
  const [cached, setCached] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await request('/api/advice/handbook');
        setArticles(res.articles);
        setDiseases(res.diseases);
        await kvSet('advice.handbook', JSON.stringify({ articles: res.articles, diseases: res.diseases }));
        setCached(false);
      } catch {
        const raw = await kvGet('advice.handbook');
        if (raw) {
          const saved = JSON.parse(raw);
          setArticles(saved.articles);
          setDiseases(saved.diseases);
          setCached(true);
        }
      }
    })();
  }, []);

  const filtered = useMemo(() => articles.filter((a) => a.month === month || a.month === 0), [articles, month]);
  const now = new Date().getMonth() + 1;

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <View style={{ flexDirection: 'row', gap: 8, padding: ui.pad, paddingBottom: 0 }}>
        {(['calendar', 'diseases'] as const).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={{ flex: 1, backgroundColor: tab === t ? palette.green700 : '#fff', borderRadius: 10, paddingVertical: 8, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: palette.line }}>
            <Text style={{ color: tab === t ? '#fff' : palette.text, fontWeight: '700', fontSize: ui.font.small }}>
              {t === 'calendar' ? 'Care calendar' : 'Diseases & pests'}
            </Text>
          </Pressable>
        ))}
      </View>

      {cached && (
        <Text style={{ color: palette.amber === '#d9a441' ? '#8a6414' : palette.amber, fontSize: ui.font.small, paddingHorizontal: ui.pad, paddingTop: 8 }}>
          Showing the saved offline copy (no connection).
        </Text>
      )}

      {tab === 'calendar' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }} contentContainerStyle={{ paddingHorizontal: ui.pad, gap: 6 }}>
          {MONTHS.map((m, idx) => (
            <Pressable key={m} onPress={() => setMonth(idx)} style={{ backgroundColor: month === idx ? palette.green500 : '#fff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.line }}>
              <Text style={{ color: month === idx ? '#fff' : palette.text, fontWeight: '600', fontSize: ui.font.small }}>{m}{idx === now && idx !== 0 ? ' •' : ''}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <ScrollView contentContainerStyle={{ padding: ui.pad, gap: ui.gap, paddingBottom: 40 }}>
        {tab === 'calendar' && filtered.map((a) => {
          const isOpen = open === a.id;
          return (
            <Pressable key={a.id} onPress={() => setOpen(isOpen ? null : a.id)} style={card(ui)}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: ui.font.body, fontWeight: '700', color: palette.text, flex: 1 }}>{a.title}</Text>
                <Chip label={a.category} tone="green" />
              </View>
              {isOpen && <Text style={{ color: palette.text, fontSize: ui.font.small, lineHeight: 19, marginTop: 8 }}>{a.body}</Text>}
            </Pressable>
          );
        })}

        {tab === 'diseases' && diseases.map((d) => {
          const isOpen = open === d.code;
          return (
            <Pressable key={d.code} onPress={() => setOpen(isOpen ? null : d.code)} style={card(ui)}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: ui.font.body, fontWeight: '700', color: palette.text, flex: 1 }}>{d.name}</Text>
                <Chip label={d.category} tone="grey" />
              </View>
              <Text style={{ color: palette.textDim, fontSize: ui.font.small, marginTop: 4 }} numberOfLines={isOpen ? undefined : 2}>{d.signs}</Text>
              {isOpen && (
                <View style={{ marginTop: 8, gap: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line, paddingTop: 8 }}>
                  <Text style={{ color: palette.text, fontSize: ui.font.small }}>Season: {d.window}</Text>
                  {d.organic.length > 0 && (
                    <Text style={{ color: palette.green700, fontSize: ui.font.small, lineHeight: 18 }}>
                      Organic: {d.organic.join(' · ')}
                    </Text>
                  )}
                  {d.chemical.length > 0 && (
                    <Text style={{ color: palette.text, fontSize: ui.font.small, lineHeight: 18 }}>
                      Chemical: {d.chemical.join(' · ')}
                    </Text>
                  )}
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
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
