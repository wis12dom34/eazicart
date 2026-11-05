import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme";

export default function ReelsScreen() {
  return (
    <View style={styles.screen}>
      <Ionicons name="play-circle-outline" color={colors.orange} size={64} />
      <Text style={styles.title}>EaziCart Reels</Text>
      <Text style={styles.description}>
        Native video playback is scheduled for Phase 2. No web player or sample
        videos are substituted for real seller content.
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: 32,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
    gap: 14,
  },
  title: { fontWeight: "800", fontSize: 22, color: colors.ink },
  description: { textAlign: "center", color: colors.muted, lineHeight: 22 },
});
