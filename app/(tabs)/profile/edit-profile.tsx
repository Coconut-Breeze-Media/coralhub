// app/(tabs)/profile/edit-profile.tsx
/**
 * Edit My Profile Screen
 * Loads every BuddyPress extended-profile (xprofile) field group for the
 * current user and lets them edit their own values, mirroring the website's
 * "Profile Information Fields" form. Values are saved per field through
 * POST /buddypress/v1/xprofile/{field_id}/data/{user_id}.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from 'expo-router';
import { useCurrentMember, useUpdateXProfileField, useXProfileGroups } from '../../../hooks';
import { xprofileValueToString } from '../../../hooks/useMemberProfile';
import { ROUTES } from '../../../constants/navigation';
import { goBackOrFallback, type BackNavigation } from '../../../lib/tabNavigation';
import type { BPXProfileField } from '../../../types';

const PRIMARY = '#2563eb';

/** Field types whose value is a list of selected options. */
const MULTI_TYPES = new Set(['checkbox', 'multiselectbox']);
/** Field types whose value is one of a fixed list of options. */
const SINGLE_OPTION_TYPES = new Set(['selectbox', 'radio']);

type FieldValue = string | string[];

function decodeEntities(input: string): string {
  return input
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function plainText(value: unknown): string {
  if (typeof value === 'string') return decodeEntities(value.replace(/<[^>]*>/g, '')).trim();
  if (value && typeof value === 'object') {
    const o = value as { raw?: unknown; rendered?: unknown };
    return plainText(o.raw ?? o.rendered ?? '');
  }
  return '';
}

/** Parse a PHP-serialized string array (a:2:{i:0;s:3:"foo";...}). */
function parseSerializedArray(raw: string): string[] | null {
  if (!/^a:\d+:\{/.test(raw)) return null;
  const out: string[] = [];
  const re = /s:\d+:"(.*?)";/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw)) !== null) out.push(match[1]);
  return out;
}

function isMulti(field: BPXProfileField) {
  return MULTI_TYPES.has(field.type);
}

/** Read the user's saved value for a field into an editable form value. */
function initialValue(field: BPXProfileField): FieldValue {
  const value = field.data?.value;
  const obj = value && typeof value === 'object' ? value : null;
  const raw = typeof value === 'string' ? value : typeof obj?.raw === 'string' ? obj.raw : '';
  const unserialized = obj?.unserialized;

  if (isMulti(field)) {
    if (Array.isArray(unserialized)) {
      return unserialized.map((v) => decodeEntities(String(v))).filter(Boolean);
    }
    const parsed = raw ? parseSerializedArray(raw) : null;
    if (parsed) return parsed.map(decodeEntities);
    const text = raw || xprofileValueToString(value);
    return text ? text.split(/\s*,\s*/).map(decodeEntities).filter(Boolean) : [];
  }

  let single = raw;
  if (!single && Array.isArray(unserialized) && unserialized.length) single = String(unserialized[0]);
  if (!single) single = xprofileValueToString(value);
  const parsed = single ? parseSerializedArray(single) : null;
  if (parsed) single = parsed[0] ?? '';
  single = decodeEntities(single);

  if (field.type === 'datebox' && single) {
    // BuddyPress stores dates as "Y-m-d H:i:s"; edit the date part only.
    const iso = /^\d{4}-\d{2}-\d{2}/.exec(single);
    if (iso) return iso[0];
  }
  return single;
}

function serialize(field: BPXProfileField, value: FieldValue): string {
  if (Array.isArray(value)) return value.join(',');
  if (field.type === 'datebox' && value.trim()) return `${value.trim()} 00:00:00`;
  return value.trim();
}

function isEmpty(value: FieldValue) {
  return Array.isArray(value) ? value.length === 0 : value.trim() === '';
}

function sameValue(a: FieldValue, b: FieldValue) {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v) => b.includes(v));
  }
  return a === b;
}

function visibilityLabel(level?: string) {
  switch (level) {
    case 'public':
      return 'Everyone';
    case 'loggedin':
      return 'All Members';
    case 'friends':
      return 'My Connections';
    case 'adminsonly':
      return 'Only Me';
    default:
      return null;
  }
}

export default function EditProfileScreen() {
  const navigation = useNavigation<BackNavigation>();
  const { data: member } = useCurrentMember();
  const userId = member?.id ?? 0;
  const { data: groups, isLoading, error, refetch, isRefetching } = useXProfileGroups(userId);
  const updateField = useUpdateXProfileField();

  const [values, setValues] = useState<Record<number, FieldValue>>({});
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<number, string>>({});

  const fields = useMemo(
    () => (groups ?? []).flatMap((group) => group.fields ?? []),
    [groups]
  );

  const initialValues = useMemo(() => {
    const map: Record<number, FieldValue> = {};
    fields.forEach((field) => {
      map[field.id] = initialValue(field);
    });
    return map;
  }, [fields]);

  // Reset the form whenever fresh server values arrive.
  useEffect(() => {
    setValues(initialValues);
    setErrors({});
  }, [initialValues]);

  const changedFields = fields.filter(
    (field) => values[field.id] !== undefined && !sameValue(values[field.id], initialValues[field.id])
  );

  const setValue = (fieldId: number, value: FieldValue) => {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
    setErrors((prev) => {
      if (!prev[fieldId]) return prev;
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  };

  const handleSave = async () => {
    if (!userId || saving) return;

    const validation: Record<number, string> = {};
    fields.forEach((field) => {
      const value = values[field.id] ?? '';
      if (field.is_required && isEmpty(value)) {
        validation[field.id] = 'This field is required.';
      } else if (
        field.type === 'datebox' &&
        typeof value === 'string' &&
        value.trim() &&
        !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())
      ) {
        validation[field.id] = 'Use the format YYYY-MM-DD.';
      }
    });
    if (Object.keys(validation).length) {
      setErrors(validation);
      Alert.alert('Check your profile', 'Please fix the highlighted fields before saving.');
      return;
    }

    if (!changedFields.length) {
      Alert.alert('No changes', 'You have not changed any profile fields.');
      return;
    }

    setSaving(true);
    const failed: string[] = [];
    for (const field of changedFields) {
      try {
        await updateField.mutateAsync({
          fieldId: field.id,
          userId,
          payload: { value: serialize(field, values[field.id]) },
        });
      } catch (saveError: any) {
        failed.push(`${plainText(field.name)}: ${saveError?.message || 'Could not save'}`);
      }
    }
    setSaving(false);

    if (failed.length) {
      Alert.alert('Some fields were not saved', failed.join('\n'));
      refetch();
      return;
    }

    Alert.alert('Saved', 'Your profile has been updated.', [
      { text: 'OK', onPress: () => goBackOrFallback(navigation, ROUTES.PROFILE_SETTINGS) },
    ]);
  };

  if (!userId || isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
        <Text style={{ fontSize: 18, color: '#1f2937', marginTop: 16, textAlign: 'center' }}>
          Failed to load your profile fields
        </Text>
        <Text style={{ fontSize: 14, color: '#6b7280', marginTop: 8, textAlign: 'center' }}>
          {(error as Error).message}
        </Text>
        <Pressable
          onPress={() => refetch()}
          style={{ marginTop: 24, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: PRIMARY, borderRadius: 8 }}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  const renderInput = (field: BPXProfileField) => {
    const value = values[field.id] ?? (isMulti(field) ? [] : '');
    const options = (field.options ?? []).filter((option) => option && typeof option.name === 'string');
    const hasError = Boolean(errors[field.id]);
    const inputStyle = {
      borderWidth: 1,
      borderColor: hasError ? '#ef4444' : '#d1d5db',
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      color: '#1f2937',
      backgroundColor: '#fff',
    } as const;

    if ((SINGLE_OPTION_TYPES.has(field.type) || isMulti(field)) && options.length) {
      const multi = isMulti(field);
      const selected = Array.isArray(value) ? value : value ? [value] : [];
      return (
        <View style={{ gap: 8 }}>
          {options.map((option) => {
            const label = decodeEntities(option.name);
            const isSelected = selected.includes(label) || selected.includes(option.name);
            const toggle = () => {
              if (multi) {
                setValue(
                  field.id,
                  isSelected
                    ? selected.filter((v) => v !== label && v !== option.name)
                    : [...selected, label]
                );
              } else {
                // Selectboxes can be cleared unless required; radios behave like the website.
                setValue(field.id, isSelected && !field.is_required ? '' : label);
              }
            };
            const icon = multi
              ? isSelected ? 'checkbox' : 'square-outline'
              : isSelected ? 'radio-button-on' : 'radio-button-off';
            return (
              <Pressable
                key={option.id ?? label}
                onPress={toggle}
                accessibilityRole={multi ? 'checkbox' : 'radio'}
                accessibilityState={{ checked: isSelected }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: isSelected ? PRIMARY : hasError ? '#ef4444' : '#e5e7eb',
                  backgroundColor: isSelected ? '#eff6ff' : '#fff',
                }}
              >
                <Ionicons name={icon} size={20} color={isSelected ? PRIMARY : '#9ca3af'} />
                <Text style={{ flex: 1, fontSize: 15, color: '#1f2937' }}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      );
    }

    const text = Array.isArray(value) ? value.join(', ') : value;
    const onChangeText = (next: string) => {
      if (isMulti(field)) {
        // No option list available from the API: accept a comma-separated list.
        setValue(field.id, next.split(/\s*,\s*/).filter(Boolean));
      } else {
        setValue(field.id, next);
      }
    };

    switch (field.type) {
      case 'textarea':
        return (
          <TextInput
            value={text}
            onChangeText={onChangeText}
            multiline
            textAlignVertical="top"
            style={{ ...inputStyle, minHeight: 110 }}
          />
        );
      case 'url':
      case 'web':
        return (
          <TextInput
            value={text}
            onChangeText={onChangeText}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="https://"
            style={inputStyle}
          />
        );
      case 'number':
        return <TextInput value={text} onChangeText={onChangeText} keyboardType="numeric" style={inputStyle} />;
      case 'telephone':
        return <TextInput value={text} onChangeText={onChangeText} keyboardType="phone-pad" style={inputStyle} />;
      case 'datebox':
        return (
          <TextInput
            value={text}
            onChangeText={onChangeText}
            placeholder="YYYY-MM-DD"
            keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={10}
            style={inputStyle}
          />
        );
      default:
        return (
          <TextInput
            value={text}
            onChangeText={onChangeText}
            placeholder={isMulti(field) ? 'Separate values with commas' : undefined}
            style={inputStyle}
          />
        );
    }
  };

  const visibleGroups = (groups ?? []).filter((group) => (group.fields ?? []).length > 0);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#f9fafb' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
      >
        {visibleGroups.length === 0 ? (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <Text style={{ fontSize: 16, color: '#6b7280', textAlign: 'center' }}>
              There are no profile fields to edit.
            </Text>
          </View>
        ) : (
          visibleGroups.map((group) => {
            const groupDescription = plainText(group.description);
            return (
              <View key={group.id} style={{ backgroundColor: '#fff', padding: 16, marginBottom: 2 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#1f2937' }}>
                  {plainText(group.name)}
                </Text>
                {groupDescription ? (
                  <Text style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>{groupDescription}</Text>
                ) : null}
                <View style={{ gap: 18, marginTop: 14 }}>
                  {(group.fields ?? []).map((field) => {
                    const description = plainText(field.description);
                    const visibility = visibilityLabel(field.visibility_level);
                    return (
                      <View key={field.id}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#1f2937', marginBottom: 6 }}>
                          {plainText(field.name)}
                          {field.is_required ? <Text style={{ color: '#ef4444' }}> *</Text> : null}
                        </Text>
                        {description ? (
                          <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>{description}</Text>
                        ) : null}
                        {renderInput(field)}
                        {errors[field.id] ? (
                          <Text style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{errors[field.id]}</Text>
                        ) : null}
                        {visibility ? (
                          <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                            This field can be seen by: {visibility}
                          </Text>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })
        )}

        <View style={{ flexDirection: 'row', gap: 12, padding: 16 }}>
          <Pressable
            onPress={() => goBackOrFallback(navigation, ROUTES.PROFILE_SETTINGS)}
            disabled={saving}
            style={{
              flex: 1,
              paddingVertical: 12,
              backgroundColor: '#fff',
              borderWidth: 1,
              borderColor: '#d1d5db',
              borderRadius: 8,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#6b7280', fontSize: 15, fontWeight: '600' }}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleSave}
            disabled={saving || visibleGroups.length === 0}
            accessibilityRole="button"
            accessibilityLabel="Save profile changes"
            style={{
              flex: 1,
              paddingVertical: 12,
              backgroundColor: PRIMARY,
              borderRadius: 8,
              alignItems: 'center',
              opacity: saving || visibleGroups.length === 0 ? 0.7 : 1,
            }}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>
                Save Changes{changedFields.length ? ` (${changedFields.length})` : ''}
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
