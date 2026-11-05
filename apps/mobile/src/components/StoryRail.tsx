import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { memo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "../lib/api";
import type { Seller } from "../lib/types";
import { colors } from "../theme";

export const StoryRail = memo(function StoryRail({
  sellers,
}: {
  sellers: Seller[];
}) {
  const userIds = sellers
    .map((seller) => seller.userId)
    .filter(Boolean)
    .slice(0, 12);
  const stories = useQuery({
    queryKey: ["story-previews", userIds.join(",")],
    enabled: userIds.length > 0,
    queryFn: () => api.storyPreviews(userIds),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const live = sellers.filter((seller) =>
    Boolean(stories.data?.data[seller.userId]),
  );
  if (!live.length) return null;
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Stories</Text>
      <FlatList
        horizontal
        data={live}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(seller) => seller.userId}
        contentContainerStyle={styles.items}
        renderItem={({ item }) => {
          const story = stories.data?.data[item.userId];
          const video = story?.contentType?.startsWith("video/");
          return (
            <Pressable
              style={styles.item}
              accessibilityRole="button"
              accessibilityLabel={`View ${item.displayName}'s story`}
              onPress={() =>
                router.push({
                  pathname: "/story/[userId]",
                  params: { userId: item.userId, name: item.displayName },
                })
              }
            >
              <View style={styles.ring}>
                {story && !video ? (
                  <Image
                    source={{ uri: story.url }}
                    style={styles.photo}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <View style={styles.placeholder}>
                    <Ionicons name="play" color={colors.orange} size={20} />
                  </View>
                )}
              </View>
              <Text style={styles.name} numberOfLines={1}>
                {item.displayName}
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
});
const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    paddingTop: 10,
    paddingBottom: 14,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  heading: {
    fontWeight: "800",
    fontSize: 14,
    color: colors.ink,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  items: { gap: 12, paddingHorizontal: 16 },
  item: { width: 72, alignItems: "center", gap: 6, minHeight: 100 },
  ring: {
    borderColor: colors.orange,
    borderWidth: 2,
    borderRadius: 36,
    width: 68,
    height: 68,
    padding: 3,
  },
  photo: { width: "100%", height: "100%", borderRadius: 31 },
  placeholder: {
    flex: 1,
    borderRadius: 31,
    backgroundColor: colors.orangePale,
    justifyContent: "center",
    alignItems: "center",
  },
  name: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "600",
    maxWidth: 72,
    textAlign: "center",
  },
});
