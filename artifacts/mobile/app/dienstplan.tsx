import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { Badge, Button, Card, Chip, EmptyState, Field, SectionHeader } from "@/components/ui";
import { useApp, useT } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import type { Employee, ShiftEntry } from "@/types";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}
// Local YYYY-MM-DD (avoids UTC drift from toISOString in non-UTC timezones).
const dateKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
// ISO 8601 week number.
function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const diff = (t.getTime() - firstThursday.getTime()) / 86400000;
  return 1 + Math.round((diff - ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}

const ROLES: Employee["role"][] = ["chef", "cook", "service", "kitchen_help", "manager"];

export default function Dienstplan() {
  const { state, dispatch, newId } = useApp();
  const t = useT();
  const c = useColors();
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date()));
  const [shiftModal, setShiftModal] = useState<{ employeeId: string; date: string } | null>(null);
  const [empModal, setEmpModal] = useState<Employee | null>(null);

  const week = useMemo(
    () => DAYS.map((_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const weekKeys = useMemo(
    () => new Set(Array.from({ length: 7 }, (_, i) => dateKey(addDays(weekStart, i)))),
    [weekStart],
  );

  const totalsByEmployee = useMemo(() => {
    const m = new Map<string, number>();
    state.shifts.forEach((sh) => {
      if (!weekKeys.has(sh.date)) return;
      const [sh1, sm1] = sh.start.split(":").map(Number);
      const [sh2, sm2] = sh.end.split(":").map(Number);
      const minutes = (sh2! * 60 + sm2!) - (sh1! * 60 + sm1!);
      m.set(sh.employeeId, (m.get(sh.employeeId) ?? 0) + Math.max(0, minutes) / 60);
    });
    return m;
  }, [state.shifts, weekKeys]);

  const removeEmployee = (id: string) => {
    Alert.alert(t("delete"), "", [
      { text: t("cancel") },
      {
        text: t("delete"),
        style: "destructive",
        onPress: () => dispatch({ type: "removeEmployee", id }),
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 60 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Pressable
            onPress={() => setWeekStart(addDays(weekStart, -7))}
            style={({ pressed }) => [
              { padding: 10, borderRadius: 10, backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
              pressed && { opacity: 0.6 },
            ]}
          >
            <Feather name="chevron-left" size={16} color={c.foreground} />
          </Pressable>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15 }}>
              {weekStart.toLocaleDateString()} – {addDays(weekStart, 6).toLocaleDateString()}
            </Text>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 2 }}>
              KW {isoWeek(weekStart)}
            </Text>
          </View>
          <Pressable
            onPress={() => setWeekStart(addDays(weekStart, 7))}
            style={({ pressed }) => [
              { padding: 10, borderRadius: 10, backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
              pressed && { opacity: 0.6 },
            ]}
          >
            <Feather name="chevron-right" size={16} color={c.foreground} />
          </Pressable>
        </View>

        {state.employees.length === 0 ? (
          <Card>
            <EmptyState icon="users" title={state.locale === "de" ? "Keine Mitarbeiter" : "No employees"} />
            <View style={{ height: 12 }} />
            <Button
              label={t("addEmployee")}
              icon="user-plus"
              onPress={() =>
                setEmpModal({ id: newId(), name: "", role: "cook", weeklyHours: 30 })
              }
            />
          </Card>
        ) : (
          state.employees.map((emp) => {
            const planned = totalsByEmployee.get(emp.id) ?? 0;
            const target = emp.weeklyHours ?? 0;
            const overUnder = planned - target;
            return (
              <Card key={emp.id} style={{ padding: 0, overflow: "hidden" }}>
                <Pressable
                  onLongPress={() => removeEmployee(emp.id)}
                  onPress={() => setEmpModal(emp)}
                  style={({ pressed }) => [
                    { padding: 14, flexDirection: "row", alignItems: "center", gap: 10 },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: emp.color ?? c.primary,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 12 }}>
                      {emp.name.split(" ").map((p) => p[0]).slice(0, 2).join("") || "?"}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                      {emp.name || "—"}
                    </Text>
                    <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 2 }}>
                      {t(emp.role === "kitchen_help" ? "kitchenHelp" : emp.role)}
                      {target > 0 ? ` · ${target}h/Wo` : ""}
                    </Text>
                  </View>
                  <Badge
                    label={`${planned.toFixed(1)}h`}
                    tone={
                      target === 0
                        ? "default"
                        : Math.abs(overUnder) <= 2
                          ? "success"
                          : overUnder > 0
                            ? "warning"
                            : "destructive"
                    }
                  />
                </Pressable>
                <View style={{ flexDirection: "row", borderTopWidth: 1, borderColor: c.border }}>
                  {week.map((d, i) => {
                    const k = dateKey(d);
                    const dayShifts = state.shifts.filter((sh) => sh.employeeId === emp.id && sh.date === k);
                    return (
                      <Pressable
                        key={k}
                        onPress={() => setShiftModal({ employeeId: emp.id, date: k })}
                        style={({ pressed }) => [
                          {
                            flex: 1,
                            paddingVertical: 8,
                            alignItems: "center",
                            borderRightWidth: i < 6 ? 1 : 0,
                            borderColor: c.border,
                            backgroundColor: dayShifts.length > 0 ? c.warning + "1a" : "transparent",
                          },
                          pressed && { opacity: 0.6 },
                        ]}
                      >
                        <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 9, textTransform: "uppercase" }}>
                          {t(DAYS[i]!)}
                        </Text>
                        {dayShifts.length === 0 ? (
                          <Feather name="plus" size={12} color={c.mutedForeground} style={{ marginTop: 4 }} />
                        ) : (
                          dayShifts.slice(0, 2).map((sh) => (
                            <Text
                              key={sh.id}
                              style={{
                                color: c.foreground,
                                fontFamily: "Inter_600SemiBold",
                                fontSize: 9,
                                marginTop: 2,
                              }}
                            >
                              {sh.start}–{sh.end}
                            </Text>
                          ))
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </Card>
            );
          })
        )}

        <Button
          label={t("addEmployee")}
          icon="user-plus"
          variant="ghost"
          onPress={() => setEmpModal({ id: newId(), name: "", role: "cook", weeklyHours: 30 })}
        />
      </ScrollView>

      {shiftModal ? (
        <ShiftModal
          employeeId={shiftModal.employeeId}
          date={shiftModal.date}
          onClose={() => setShiftModal(null)}
        />
      ) : null}
      {empModal ? <EmployeeModal employee={empModal} onClose={() => setEmpModal(null)} /> : null}
    </View>
  );
}

function ShiftModal({ employeeId, date, onClose }: { employeeId: string; date: string; onClose: () => void }) {
  const { state, dispatch, newId } = useApp();
  const c = useColors();
  const t = useT();
  const existing = state.shifts.filter((sh) => sh.employeeId === employeeId && sh.date === date);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");

  const add = () => {
    const sh: ShiftEntry = { id: newId(), employeeId, date, start, end };
    dispatch({ type: "addShift", shift: sh });
    onClose();
  };
  const remove = (id: string) => dispatch({ type: "removeShift", id });

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,.45)", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: c.background, padding: 20, paddingBottom: Platform.OS === "ios" ? 36 : 24, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 12 }}>
          <SectionHeader title={`${date} · ${t("addShift")}`} />
          {existing.map((sh) => (
            <View key={sh.id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ flex: 1, color: c.foreground, fontFamily: "Inter_500Medium" }}>
                {sh.start} – {sh.end}
              </Text>
              <Pressable onPress={() => remove(sh.id)}>
                <Feather name="trash-2" size={16} color={c.destructive} />
              </Pressable>
            </View>
          ))}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label="Start" value={start} onChangeText={setStart} placeholder="09:00" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Ende" value={end} onChangeText={setEnd} placeholder="17:00" />
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button label={t("save")} icon="check" onPress={add} style={{ flex: 1 }} />
            <Button label={t("close")} variant="ghost" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function EmployeeModal({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const { state, dispatch } = useApp();
  const c = useColors();
  const t = useT();
  const [name, setName] = useState(employee.name);
  const [role, setRole] = useState<Employee["role"]>(employee.role);
  const [hours, setHours] = useState(String(employee.weeklyHours ?? 30));
  const [phone, setPhone] = useState(employee.phone ?? "");
  const isNew = !state.employees.find((e) => e.id === employee.id);

  const save = () => {
    if (!name.trim()) return;
    const e: Employee = {
      ...employee,
      name: name.trim(),
      role,
      weeklyHours: Number(hours) || undefined,
      phone: phone.trim() || undefined,
    };
    dispatch({ type: isNew ? "addEmployee" : "updateEmployee", employee: e });
    onClose();
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,.45)", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: c.background, padding: 20, paddingBottom: Platform.OS === "ios" ? 36 : 24, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 12 }}>
          <SectionHeader title={isNew ? t("addEmployee") : employee.name} />
          <Field label={t("name")} value={name} onChangeText={setName} placeholder="Max Mustermann" />
          <View>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12, marginBottom: 6 }}>
              {t("role")}
            </Text>
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              {ROLES.map((r) => (
                <Chip
                  key={r}
                  label={t(r === "kitchen_help" ? "kitchenHelp" : r)}
                  active={role === r}
                  onPress={() => setRole(r)}
                />
              ))}
            </View>
          </View>
          <Field label="Std/Woche" value={hours} onChangeText={setHours} keyboardType="numeric" />
          <Field label="Telefon" value={phone} onChangeText={setPhone} placeholder="+49 …" />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button label={t("save")} icon="check" onPress={save} style={{ flex: 1 }} />
            <Button label={t("close")} variant="ghost" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
