import React from "react";
import { View, Text } from "react-native";
import Svg, { Rect, Text as SvgText, Line } from "react-native-svg";

import { useColors } from "@/hooks/useColors";

export interface BarDatum {
  label: string;
  value: number;
  altValue?: number;
  color?: string;
}

export function BarChart({
  data,
  height = 180,
  showAlt,
}: {
  data: BarDatum[];
  height?: number;
  showAlt?: boolean;
}) {
  const c = useColors();
  const max = Math.max(1, ...data.map((d) => Math.max(d.value, d.altValue ?? 0)));
  const padding = 28;
  const w = 320;
  const innerW = w - padding * 2;
  const innerH = height - padding;
  const slotW = data.length > 0 ? innerW / data.length : 0;
  const barW = Math.max(8, slotW * 0.5);

  return (
    <View style={{ alignItems: "center" }}>
      <Svg width={w} height={height}>
        <Line
          x1={padding}
          x2={w - padding}
          y1={height - padding + 0.5}
          y2={height - padding + 0.5}
          stroke={c.border}
          strokeWidth={1}
        />
        {data.map((d, i) => {
          const x = padding + slotW * i + slotW / 2;
          const h1 = (d.value / max) * innerH;
          const h2 = ((d.altValue ?? 0) / max) * innerH;
          const x1 = showAlt ? x - barW * 0.55 : x - barW / 2;
          const x2 = x + barW * 0.05;
          return (
            <React.Fragment key={d.label + i}>
              <Rect
                x={x1}
                y={height - padding - h1}
                width={showAlt ? barW * 0.5 : barW}
                height={h1}
                rx={3}
                fill={d.color ?? c.chartA}
              />
              {showAlt ? (
                <Rect
                  x={x2}
                  y={height - padding - h2}
                  width={barW * 0.5}
                  height={h2}
                  rx={3}
                  fill={c.chartD}
                />
              ) : null}
              <SvgText
                x={x}
                y={height - padding + 14}
                fill={c.mutedForeground}
                fontSize={9}
                textAnchor="middle"
                fontFamily="Inter_500Medium"
              >
                {d.label}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

export function PieLegend({
  segments,
}: {
  segments: { label: string; value: number; color: string }[];
}) {
  const c = useColors();
  const total = Math.max(1, segments.reduce((s, x) => s + x.value, 0));
  return (
    <View style={{ gap: 8, marginTop: 8 }}>
      {segments.map((s) => {
        const pct = Math.round((s.value / total) * 100);
        return (
          <View
            key={s.label}
            style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
          >
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                backgroundColor: s.color,
              }}
            />
            <Text
              style={{
                color: c.foreground,
                fontFamily: "Inter_500Medium",
                fontSize: 13,
                flex: 1,
              }}
            >
              {s.label}
            </Text>
            <Text
              style={{
                color: c.mutedForeground,
                fontFamily: "Inter_600SemiBold",
                fontSize: 13,
              }}
            >
              {pct}%
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function HBar({
  label,
  value,
  max,
  color,
  suffix,
}: {
  label: string;
  value: number;
  max: number;
  color?: string;
  suffix?: string;
}) {
  const c = useColors();
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <View style={{ marginBottom: 10 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <Text
          style={{
            color: c.foreground,
            fontFamily: "Inter_500Medium",
            fontSize: 12,
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            color: c.mutedForeground,
            fontFamily: "Inter_500Medium",
            fontSize: 12,
          }}
        >
          {value.toFixed(0)}
          {suffix ?? ""}
        </Text>
      </View>
      <View
        style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: c.muted,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${pct * 100}%`,
            height: "100%",
            backgroundColor: color ?? c.primary,
            borderRadius: 3,
          }}
        />
      </View>
    </View>
  );
}
