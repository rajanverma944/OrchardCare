// Sign-in / sign-up. Tokens + user land in SecureStore; App.tsx switches to the main tabs.
import React, { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { login, register } from '../api';
import { useAuth } from '../../App';
import { palette, useUi } from '../ui';

export default function AuthScreen() {
  const ui = useUi();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const user =
        mode === 'login'
          ? await login(email.trim(), password)
          : await register(name.trim(), email.trim(), password);
      signIn(user);
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: ui.font.body,
    color: palette.text,
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: palette.green900 }} behavior={Platform.OS === 'android' ? undefined : 'padding'}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: ui.pad, paddingTop: insets.top + 24 }}>
        <Text style={{ color: '#fff', fontSize: ui.font.h1, fontWeight: '800' }}>OrchardCare</Text>
        <Text style={{ color: '#bcd9c6', fontSize: ui.font.body, marginTop: 6, marginBottom: ui.gap * 1.6 }}>
          Apple orchard management for the Shimla hills
        </Text>

        <View style={{ backgroundColor: palette.card, borderRadius: 18, padding: ui.card, gap: ui.gap }}>
          {mode === 'register' && (
            <TextInput style={inputStyle} placeholder="Your name" placeholderTextColor={palette.textDim} value={name} onChangeText={setName} autoCapitalize="words" />
          )}
          <TextInput style={inputStyle} placeholder="Email" placeholderTextColor={palette.textDim} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <TextInput style={inputStyle} placeholder="Password (8+ chars, letter + number)" placeholderTextColor={palette.textDim} value={password} onChangeText={setPassword} secureTextEntry />

          {error && <Text style={{ color: palette.red, fontSize: ui.font.small }}>{error}</Text>}

          <Pressable
            onPress={submit}
            disabled={busy || !email || !password || (mode === 'register' && !name)}
            style={({ pressed }) => ({
              backgroundColor: pressed || busy ? palette.green900 : palette.green700,
              borderRadius: 12, alignItems: 'center', paddingVertical: 13, opacity: busy ? 0.9 : 1,
            })}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700', fontSize: ui.font.button }}>{mode === 'login' ? 'Sign in' : 'Create account'}</Text>}
          </Pressable>

          <Pressable onPress={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }} hitSlop={8}>
            <Text style={{ textAlign: 'center', color: palette.green700, fontSize: ui.font.small }}>
              {mode === 'login' ? 'New here? Create an account' : 'Already registered? Sign in'}
            </Text>
          </Pressable>
        </View>

        <Text style={{ color: '#8fb89e', fontSize: ui.font.small, marginTop: ui.gap * 1.5, textAlign: 'center' }}>
          Works offline in the field - data syncs when you get signal.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
