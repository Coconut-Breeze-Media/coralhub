// components/FilterDropdown.tsx
import React, { useState } from 'react';
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const PRIMARY = '#0077b6';

export type FilterOption = {
  key: string;
  label: string;
  avatarUrl?: string;
  initial?: string;
};

interface FilterDropdownProps {
  options: FilterOption[];
  selectedKey: string;
  onSelect: (key: string) => void;
  placeholder?: string;
  testID?: string;
}

/**
 * Compact single-select dropdown used for feed filters (friends / groups).
 * The menu renders inline below the button inside the same card so no
 * screen-level restructuring is required.
 */
export default function FilterDropdown({
  options,
  selectedKey,
  onSelect,
  placeholder = 'Select',
  testID,
}: FilterDropdownProps) {
  const [open, setOpen] = useState(false);

  const selected = options.find((o) => o.key === selectedKey);
  const label = selected?.label || placeholder;

  const handleSelect = (key: string) => {
    onSelect(key);
    setOpen(false);
  };

  return (
    <View style={styles.container} testID={testID}>
      <TouchableOpacity
        style={styles.button}
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={label}
      >
        <Text style={styles.buttonText} numberOfLines={1}>
          {label}
        </Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={16}
          color="#6b7280"
          style={styles.chevron}
        />
      </TouchableOpacity>

      {open ? (
        <View style={styles.menu}>
          <ScrollView style={styles.menuScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {options.map((option) => {
              const isActive = option.key === selectedKey;
              const hasAvatarSlot = !!(option.avatarUrl || option.initial);
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[styles.item, isActive && styles.itemActive]}
                  onPress={() => handleSelect(option.key)}
                  activeOpacity={0.7}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected: isActive }}
                >
                  {hasAvatarSlot ? (
                    option.avatarUrl ? (
                      <Image source={{ uri: option.avatarUrl }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, styles.avatarPlaceholder]}>
                        <Text style={styles.avatarText}>
                          {(option.initial || option.label.charAt(0)).toUpperCase()}
                        </Text>
                      </View>
                    )
                  ) : null}
                  <Text
                    style={[styles.itemText, isActive && styles.itemTextActive]}
                    numberOfLines={1}
                  >
                    {option.label}
                  </Text>
                  {isActive ? (
                    <Ionicons name="checkmark" size={16} color={PRIMARY} style={styles.checkmark} />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dbdbdb',
    alignSelf: 'flex-start',
    minWidth: 200,
    maxWidth: '60%',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  button: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
  },
  buttonText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#262626',
  },
  chevron: {
    marginLeft: 8,
  },
  menu: {
    borderTopWidth: 1,
    borderTopColor: '#efefef',
    maxHeight: 240,
  },
  menuScroll: {
    maxHeight: 240,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: '#efefef',
    gap: 10,
  },
  itemActive: {
    backgroundColor: '#f0f8ff',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
  },
  avatarPlaceholder: {
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  itemText: {
    flex: 1,
    fontSize: 14,
    color: '#262626',
  },
  itemTextActive: {
    fontWeight: '600',
    color: PRIMARY,
  },
  checkmark: {
    marginLeft: 8,
  },
});
