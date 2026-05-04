/**
 * T013a — Subscription helpers.
 *
 * Thin selectors on top of AppContext so call sites don't have to remember
 * the shape of the subscription object. Mostly used by `<RequiresAddon>`.
 */

import { useApp } from "@/contexts/AppContext";
import type { Subscription, SubscriptionAddons, SubscriptionTier } from "@/types";

export interface UseSubscriptionResult {
  subscription: Subscription;
  tier: SubscriptionTier;
  addons: SubscriptionAddons;
  hasAddon: (name: keyof SubscriptionAddons) => boolean;
  toggleAddon: (name: keyof SubscriptionAddons, on: boolean) => void;
  setTier: (tier: SubscriptionTier) => void;
}

export function useSubscription(): UseSubscriptionResult {
  const { state, dispatch } = useApp();
  const subscription = state.subscription;
  return {
    subscription,
    tier: subscription.tier,
    addons: subscription.addons,
    hasAddon: (name) => subscription.addons[name] === true,
    toggleAddon: (name, on) => {
      dispatch({
        type: "setSubscription",
        subscription: { ...subscription, addons: { ...subscription.addons, [name]: on } },
      });
    },
    setTier: (tier) => {
      dispatch({ type: "setSubscription", subscription: { ...subscription, tier } });
    },
  };
}
