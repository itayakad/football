import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

type ActionTone = 'neutral' | 'danger';

interface ProfileSheetAction {
  label:   string;
  tone?:   ActionTone;
  onPress: () => void;
}

interface ProfileSheetProps {
  visible:  boolean;
  onClose:  () => void;
  name:     string;
  subtitle: string;
  initials: string;
  action?:  ProfileSheetAction;
  children: React.ReactNode;
}

// Sliding bottom-sheet used for player + coach profile cards. Owns the modal
// chrome (backdrop, sheet, header avatar + title + action button); the caller
// fills the body via children.
export const ProfileSheet: React.FC<ProfileSheetProps> = ({
  visible,
  onClose,
  name,
  subtitle,
  initials,
  action,
  children,
}) => {
  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={styles.title}>
              <Text style={styles.name} numberOfLines={1}>{name}</Text>
              <Text style={typography.label}>{subtitle}</Text>
            </View>
            {action && (
              <Pressable
                onPress={action.onPress}
                style={action.tone === 'danger' ? styles.actionDanger : styles.actionNeutral}
              >
                <Text style={action.tone === 'danger' ? styles.actionDangerText : styles.actionNeutralText}>
                  {action.label}
                </Text>
              </Pressable>
            )}
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.bg.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bg.elevated,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.lg,
    maxHeight: '88%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.bg.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarText: {
    ...typography.heading,
    color: colors.text.secondary,
  },
  title: {
    flex: 1,
    gap: spacing.xs,
  },
  name: {
    ...typography.title,
    fontSize: 22,
  },
  actionNeutral: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bg.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionNeutralText: {
    ...typography.caption,
    color: colors.text.primary,
    fontWeight: '800',
  },
  actionDanger: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.danger,
    borderRadius: radius.sm,
  },
  actionDangerText: {
    ...typography.caption,
    color: colors.bg.elevated,
    fontWeight: '800',
  },
});
