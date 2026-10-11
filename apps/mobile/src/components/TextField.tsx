import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing, typography } from "../theme/tokens";

interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string | null;
  secureToggle?: boolean;
  leadingIcon?: keyof typeof Ionicons.glyphMap;
  // "filled" (default) matches the account forms (Login/Register/Change
  // Password); "outline" is a white-background bordered look for search-style
  // bars (Home's intent box, Activity's search) so every text input in the
  // app shares one component instead of each screen restyling a raw
  // TextInput.
  variant?: "filled" | "outline";
  // Shows an (x) to clear the field once it has text -- opt-in since forms
  // with a separate submit button don't need it, but any search-as-you-type
  // field should have it.
  clearable?: boolean;
  onClear?: () => void;
  // Shows a "123/500" counter under the field, right-aligned opposite the
  // error text. Pass alongside maxLength.
  showCount?: boolean;
}

export function TextField({
  label,
  error,
  secureToggle,
  leadingIcon,
  secureTextEntry,
  variant = "filled",
  clearable,
  onClear,
  showCount,
  maxLength,
  style,
  onFocus,
  onBlur,
  value,
  multiline,
  ...rest
}: TextFieldProps) {
  const [visible, setVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const isSecure = secureToggle ? !visible : secureTextEntry;
  const hasValue = Boolean(value && String(value).length > 0);

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.inputRow,
          variant === "outline" && styles.inputRowOutline,
          multiline && styles.inputRowMultiline,
          isFocused && styles.inputRowFocused,
          error ? styles.inputRowError : null,
        ]}
      >
        {leadingIcon ? (
          <Ionicons
            name={leadingIcon}
            size={18}
            color={isFocused ? colors.accentDark : colors.textFaint}
            style={[styles.leadingIcon, multiline && styles.sideIconMultiline]}
          />
        ) : null}
        <TextInput
          style={[styles.input, multiline && styles.inputMultiline, style]}
          placeholderTextColor={colors.textFaint}
          secureTextEntry={isSecure}
          value={value}
          multiline={multiline}
          maxLength={maxLength}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {clearable && hasValue ? (
          <Pressable onPress={onClear} hitSlop={8} style={[styles.trailingIcon, multiline && styles.sideIconMultiline]}>
            <Ionicons name="close-circle" size={18} color={colors.textFaint} />
          </Pressable>
        ) : null}
        {secureToggle ? (
          <Pressable
            onPress={() => setVisible((v) => !v)}
            hitSlop={8}
            style={[styles.trailingIcon, multiline && styles.sideIconMultiline]}
          >
            <Ionicons name={visible ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textFaint} />
          </Pressable>
        ) : null}
      </View>
      {error || (showCount && maxLength) ? (
        <View style={styles.footerRow}>
          <Text style={styles.error}>{error ?? ""}</Text>
          {showCount && maxLength ? (
            <Text style={styles.count}>
              {String(value ?? "").length}/{maxLength}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  label: { ...typography.caption, color: colors.textSecondary },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  inputRowOutline: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  inputRowMultiline: { alignItems: "flex-end", paddingVertical: spacing.sm },
  inputRowFocused: { borderColor: colors.accent },
  inputRowError: { borderColor: colors.danger },
  leadingIcon: { marginRight: spacing.sm },
  trailingIcon: { marginLeft: spacing.sm },
  sideIconMultiline: { marginBottom: spacing.sm },
  input: {
    flex: 1,
    paddingVertical: spacing.lg,
    fontSize: 14,
    fontFamily: typography.body.fontFamily,
    color: colors.textPrimary,
  },
  inputMultiline: { paddingVertical: spacing.sm, maxHeight: 120 },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  error: { ...typography.caption, color: colors.danger, flex: 1 },
  count: { ...typography.caption, color: colors.textFaint },
});
