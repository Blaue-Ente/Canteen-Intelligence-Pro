/**
 * T013a — Gate any feature behind a paid subscription add-on.
 *
 *   <RequiresAddon name="bleThermometers" priceLabel="+€19/Monat">
 *     <BleSection />
 *   </RequiresAddon>
 *
 * If the add-on is active → renders children.
 * If not → renders a card explaining the feature and a CTA to enable it
 * (one-tap from inside the card; routing to a real Stripe page is left
 * to a future task).
 */

import { Feather } from "@expo/vector-icons";
import React from "react";
import { Text, View } from "react-native";

import { Button, Card } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { useSubscription } from "@/hooks/useSubscription";
import type { SubscriptionAddons } from "@/types";

interface Props {
  name: keyof SubscriptionAddons;
  /** Display title shown in the locked card, e.g. "Bluetooth-Thermometer". */
  title: string;
  /** Short DE description shown in the locked card. */
  description: string;
  /** Pricing badge, e.g. "+€19/Monat". */
  priceLabel: string;
  children: React.ReactNode;
}

export function RequiresAddon({ name, title, description, priceLabel, children }: Props): React.ReactElement {
  const c = useColors();
  const { hasAddon, toggleAddon } = useSubscription();
  if (hasAddon(name)) return <>{children}</>;

  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View
          style={{
            width: 40, height: 40, borderRadius: 10,
            backgroundColor: c.accent, alignItems: "center", justifyContent: "center",
          }}
        >
          <Feather name="lock" size={18} color={c.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 14 }}>
              {title}
            </Text>
            <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: c.primary }}>
              <Text style={{ color: c.primaryForeground, fontFamily: "Inter_600SemiBold", fontSize: 11 }}>
                {priceLabel}
              </Text>
            </View>
          </View>
          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 4 }}>
            {description}
          </Text>
        </View>
      </View>
      <View style={{ height: 12 }} />
      <Button label="Jetzt aktivieren" icon="zap" onPress={() => toggleAddon(name, true)} />
    </Card>
  );
}
