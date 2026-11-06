import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  type AuditClaim,
  type AuditProbe,
  type AuditReport,
  type AuditState,
  currentAuditPreviewBase,
  makeAuditPreviewClient,
} from "../lib/admin-audit-preview";
import { colors } from "../theme";

type Filter = AuditState | "ALL";

/**
 * Disabled completely in production bundles. A separate ephemeral staging
 * ADMIN token must be explicitly entered; never use the user's production
 * EaziCart authentication token, and never save this credential to disk.
 */
export default function AdminAuditPreviewScreen() {
  const base = currentAuditPreviewBase();
  const [draftToken, setDraftToken] = useState("");
  const [stagingToken, setStagingToken] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [claims, setClaims] = useState<AuditClaim[]>([]);
  const [probe, setProbe] = useState<AuditProbe | null>(null);
  const [csvCursor, setCsvCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const client = useMemo(
    () =>
      base && stagingToken ? makeAuditPreviewClient(base, stagingToken) : null,
    [base, stagingToken],
  );

  useEffect(() => {
    if (!client) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    Promise.all([
      client.report(controller.signal),
      client.list(filter === "ALL" ? undefined : filter, controller.signal),
    ])
      .then(([summary, items]) => {
        if (controller.signal.aborted) return;
        setReport(summary);
        setClaims(items);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setReport(null);
        setClaims([]);
        setError(
          reason instanceof Error ? reason.message : "Audit unavailable",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [client, filter, version]);

  if (!base)
    return (
      <View style={styles.center}>
        <Ionicons name="lock-closed-outline" size={52} color={colors.orange} />
        <Text style={styles.title}>Admin preview disabled</Text>
        <Text style={styles.description}>
          This feature runs only in a developer build with an explicitly
          configured isolated staging API. It cannot connect to the live
          EaziCart checkout.
        </Text>
      </View>
    );

  if (!stagingToken)
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Finance audit preview</Text>
        <Text style={styles.description}>
          Restricted to development. Enter a separate disposable staging
          administrator token. Do not enter a live EaziCart or KoraPay
          credential.
        </Text>
        <Text style={styles.label}>Staging administrator token</Text>
        <TextInput
          accessibilityLabel="Disposable staging administrator token"
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          value={draftToken}
          onChangeText={setDraftToken}
          placeholder="Paste your staging-only token"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          disabled={draftToken.trim().length < 12}
          style={[
            styles.primary,
            draftToken.trim().length < 12 && styles.disabled,
          ]}
          onPress={() => {
            setStagingToken(draftToken.trim());
            setDraftToken("");
          }}
        >
          <Text style={styles.primaryText}>Open read-only audit</Text>
        </Pressable>
        <Text style={styles.footnote}>
          Session stays in memory only. The staging API must independently
          verify your ADMIN role on every request. No payment action is
          available.
        </Text>
      </ScrollView>
    );

  const observe = async (paymentId: string) => {
    if (!client || busyId) return;
    setBusyId(paymentId);
    setProbe(null);
    try {
      setProbe(await client.probe(paymentId));
    } catch (reason) {
      Alert.alert(
        "Read-only check unavailable",
        reason instanceof Error ? reason.message : "Try again.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const shareCsvPage = async () => {
    if (!client || exporting) return;
    setExporting(true);
    try {
      const page = await client.csvPage(
        filter === "ALL" ? undefined : filter,
        csvCursor ?? undefined,
      );
      // React Native core Share shares CSV TEXT, not a downloaded .csv file.
      // Explicit interaction only: never auto-share sensitive audit references.
      await Share.share({
        title: "Isolated EaziCart admin audit (CSV text)",
        message: page.csv,
      });
      setCsvCursor(page.nextCursor);
      if (page.hasMore) {
        Alert.alert(
          "More records available",
          "Select Share next CSV page for the next 100 records.",
        );
      }
    } catch (reason) {
      Alert.alert(
        "Export unavailable",
        reason instanceof Error ? reason.message : "Try again.",
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.head}>
        <Text style={styles.title}>KoraPay audit</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setStagingToken("");
            setReport(null);
            setClaims([]);
            setProbe(null);
            setCsvCursor(null);
            setError(null);
          }}
          style={styles.signout}
        >
          <Text style={styles.signoutText}>Exit staging</Text>
        </Pressable>
      </View>
      <View style={styles.notice}>
        <Ionicons
          name="shield-checkmark-outline"
          color={colors.orange}
          size={24}
        />
        <Text style={styles.noticeText}>
          Read-only development preview. Provider observations are not payment
          confirmations. No charge, settlement, or refund action is available.
        </Text>
      </View>

      {loading ? <ActivityIndicator color={colors.orange} /> : null}
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.error}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setVersion((v) => v + 1)}
            style={styles.retry}
          >
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {report && !error ? (
        <View style={styles.metricContainer}>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{report.uncertainTotal}</Text>
            <Text style={styles.metricLabel}>Need review</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{report.counts.UNKNOWN}</Text>
            <Text style={styles.metricLabel}>Unknown</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{report.counts.INITIATING}</Text>
            <Text style={styles.metricLabel}>Initiating</Text>
          </View>
        </View>
      ) : null}

      {report && !error ? (
        <>
          <Text style={styles.sectionTitle}>Uncertain checkout attempts</Text>
          <View style={styles.filters}>
            {(["ALL", "UNKNOWN", "INITIATING"] as const).map((value) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: filter === value }}
                onPress={() => {
                  setFilter(value);
                  setCsvCursor(null);
                  setProbe(null);
                }}
                style={[styles.filter, filter === value && styles.activeFilter]}
              >
                <Text
                  style={[
                    styles.filterText,
                    filter === value && styles.activeFilterText,
                  ]}
                >
                  {value === "ALL"
                    ? "All"
                    : value === "UNKNOWN"
                      ? "Unknown"
                      : "Initiating"}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={loading}
            onPress={() => setVersion((v) => v + 1)}
            style={styles.refresh}
          >
            <Ionicons name="refresh" size={17} color={colors.orange} />
            <Text style={styles.refreshText}>Refresh report</Text>
          </Pressable>
          {claims.length === 0 && !loading ? (
            <Text style={styles.description}>
              No uncertain payment attempts in this filter.
            </Text>
          ) : null}
          {claims.map((claim) => (
            <View key={claim.paymentId} style={styles.claim}>
              <Text numberOfLines={1} style={styles.reference}>
                {claim.reference}
              </Text>
              <Text style={styles.detail}>
                State: {claim.state} · Local: {claim.paymentStatus}
              </Text>
              <Text style={styles.detail} numberOfLines={1}>
                Order: {claim.orderId}
              </Text>
              <Text style={styles.detail}>
                Reference matches:{" "}
                {claim.referenceMatches ? "Yes" : "NO — investigate"}
              </Text>
              <Text style={styles.detail}>
                Created: {new Date(claim.createdAt).toLocaleString("en-NG")}
              </Text>
              <Pressable
                accessibilityRole="button"
                disabled={busyId !== null}
                onPress={() => {
                  void observe(claim.paymentId);
                }}
                style={styles.outlineButton}
              >
                <Ionicons name="eye-outline" color={colors.orange} size={18} />
                <Text style={styles.outlineText}>
                  {busyId === claim.paymentId
                    ? "Checking…"
                    : "Inspect provider evidence"}
                </Text>
              </Pressable>
            </View>
          ))}
          {probe ? (
            <View style={styles.probe}>
              <Text style={styles.sectionTitle}>Provider observation only</Text>
              <Text style={styles.detail}>Reference: {probe.reference}</Text>
              <Text style={styles.detail}>
                Provider check: {probe.providerCheck}
              </Text>
              <Text style={styles.detail}>
                Local status: {probe.localStatus}
              </Text>
              <Text style={styles.strongWarning}>
                Manual review required. This observation cannot confirm or
                release funds.
              </Text>
            </View>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={exporting}
            onPress={() => {
              void shareCsvPage();
            }}
            style={styles.primary}
          >
            <Text style={styles.primaryText}>
              {exporting
                ? "Preparing…"
                : csvCursor
                  ? "Share next CSV page (text)"
                  : "Share first CSV page (text)"}
            </Text>
          </Pressable>
          <Text style={styles.footnote}>
            Export shares audit text explicitly through the device share sheet,
            not a saved CSV file. Up to 100 records per page. Do not send these
            internal references to untrusted recipients.
          </Text>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 15, paddingBottom: 42 },
  center: {
    flex: 1,
    padding: 28,
    justifyContent: "center",
    alignItems: "center",
    gap: 14,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  },
  title: { fontWeight: "800", fontSize: 24, color: colors.ink, flexShrink: 1 },
  description: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  label: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  input: {
    minHeight: 54,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    color: colors.ink,
  },
  primary: {
    minHeight: 50,
    backgroundColor: colors.orange,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  primaryText: { fontWeight: "800", fontSize: 14, color: "white" },
  disabled: { opacity: 0.4 },
  footnote: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  signout: { paddingHorizontal: 10, minHeight: 44, justifyContent: "center" },
  signoutText: { color: colors.orange, fontWeight: "700" },
  notice: {
    flexDirection: "row",
    gap: 10,
    borderRadius: 12,
    padding: 14,
    backgroundColor: colors.orangePale,
  },
  noticeText: { flex: 1, color: colors.ink, fontSize: 12, lineHeight: 18 },
  metricContainer: { flexDirection: "row", gap: 8 },
  metric: {
    flex: 1,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 7,
  },
  metricValue: { color: colors.orange, fontSize: 23, fontWeight: "800" },
  metricLabel: { color: colors.muted, fontSize: 11 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: colors.ink },
  filters: { flexDirection: "row", gap: 8 },
  filter: {
    minHeight: 42,
    borderRadius: 22,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: 13,
    justifyContent: "center",
  },
  activeFilter: {
    borderColor: colors.orange,
    backgroundColor: colors.orangePale,
  },
  filterText: { fontSize: 12, color: colors.ink },
  activeFilterText: { color: colors.orange, fontWeight: "800" },
  refresh: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    minHeight: 44,
  },
  refreshText: { color: colors.orange, fontWeight: "700" },
  claim: {
    padding: 16,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    gap: 7,
  },
  reference: { color: colors.ink, fontWeight: "800" },
  detail: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  outlineButton: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    gap: 7,
  },
  outlineText: { color: colors.orange, fontSize: 12, fontWeight: "700" },
  probe: {
    backgroundColor: colors.orangePale,
    padding: 16,
    borderRadius: 13,
    gap: 9,
  },
  strongWarning: {
    color: colors.red,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 19,
  },
  errorBox: {
    padding: 15,
    borderWidth: 1,
    borderColor: colors.red,
    borderRadius: 12,
    gap: 8,
  },
  error: { color: colors.red, fontSize: 13 },
  retry: { minHeight: 44, alignSelf: "flex-start", justifyContent: "center" },
  retryText: { color: colors.orange, fontWeight: "700" },
});
