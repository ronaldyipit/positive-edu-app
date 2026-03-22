import React from "react";
import { Modal, Text, TouchableOpacity, View, StyleSheet, StyleProp, TextStyle } from "react-native";

export const definitionModalTextStyles = StyleSheet.create({
  body: { fontSize: 14, color: "#374151", lineHeight: 22 },
  bodyBold: { fontWeight: "700" as const, color: "#1e40af" }
});

type DefinitionInfoModalProps = {
  visible: boolean;
  onRequestClose: () => void;
  title: string;
  /** APA-style or plain citation line (shown after 「出處：」) */
  citation?: string;
  /** Plain definition text; use `children` instead when nesting Text (e.g. bold spans). */
  bodyText?: string;
  children?: React.ReactNode;
  bodyTextStyle?: StyleProp<TextStyle>;
};

/**
 * Shared layout for 「甚麼是…？」info popups: centered title, body, optional 出處, centered 關閉.
 */
export function DefinitionInfoModal({
  visible,
  onRequestClose,
  title,
  citation,
  bodyText,
  children,
  bodyTextStyle
}: DefinitionInfoModalProps) {
  const bodyContent =
    children ??
    (bodyText != null && bodyText.length > 0 ? (
      <Text style={[definitionModalTextStyles.body, bodyTextStyle]}>{bodyText}</Text>
    ) : null);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onRequestClose}>
        <TouchableOpacity style={styles.card} activeOpacity={1} onPress={() => {}}>
          <Text style={styles.title}>{title}</Text>
          {bodyContent ? <View style={styles.bodyWrap}>{bodyContent}</View> : null}
          {citation ? <Text style={styles.citation}>出處：{citation}</Text> : null}
          <TouchableOpacity style={styles.closeBtn} onPress={onRequestClose} accessibilityRole="button">
            <Text style={styles.closeBtnText}>關閉</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 24
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    maxWidth: 400,
    alignSelf: "center",
    width: "100%"
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
    textAlign: "center"
  },
  bodyWrap: {
    width: "100%"
  },
  citation: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 10,
    fontStyle: "italic",
    lineHeight: 16
  },
  closeBtn: {
    marginTop: 16,
    alignSelf: "center",
    backgroundColor: "#d56c2f",
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 999,
    minWidth: 120,
    alignItems: "center",
    justifyContent: "center"
  },
  closeBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
    textAlign: "center"
  }
});
