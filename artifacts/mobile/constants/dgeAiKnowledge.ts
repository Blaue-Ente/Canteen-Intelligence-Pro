/**
 * DGE-AI knowledge blocks — injected into AI system prompts based on the
 * active dgeStandard. Each block is a compact, factual summary of the relevant
 * DGE-Qualitätsstandard so the assistant can give legally-grounded answers.
 *
 * Sources:
 *  - DGE-Qualitätsstandard für die Schulverpflegung, 7. Auflage 2022
 *  - DGE-Qualitätsstandard für die Verpflegung in KiTas, 7. Auflage 2022
 *  - DGE-Qualitätsstandard für die Verpflegung in Krankenhäusern, 2020
 *  - DGE-Qualitätsstandard für die Verpflegung in stationären
 *    Senioreneinrichtungen, 4. Auflage 2019
 *  - Lebensmittelinformations-Verordnung (LMIV) EU Nr. 1169/2011
 *  - Lebensmittelhygiene-Verordnung (LMHV) §4 / EU VO 852/2004
 */

import type { DgeStandard } from "@/types";

// ─── Knowledge blocks ────────────────────────────────────────────────────────

const SCHULE_KNOWLEDGE = `
DGE-QUALITÄTSSTANDARD SCHULVERPFLEGUNG (7. Auflage 2022) — aktiv

ENERGIEBEDARF (Mittagessen = 30 % des Tagesbedarfs):
• Grundschule (6–10 J.): 550–700 kcal / Portion
• SEK I (10–15 J.): 700–800 kcal / Portion
• SEK II (15–18 J.): 800–900 kcal / Portion

PFLICHT-FREQUENZEN (7-Tage-Speiseplan):
• Vollkornprodukte: ≥ 3× / Woche (Vollkornnudeln, Naturreis, Vollkornbrot)
• Gemüse oder Salat: täglich (mind. 5× / Woche)
• Rohkost oder frisches Obst: ≥ 3× / Woche
• Hülsenfrüchte: ≥ 1× / Woche
• Seefisch (nicht paniert/frittiert): ≥ 1× / Woche (MSC bevorzugt)
• Fleisch/Wurstwaren gesamt: max. 2× / Woche
• Rotes Fleisch (Rind, Schwein, Lamm): max. 1× / Woche
• Vegetarisches Hauptgericht: ≥ 2× / Woche (täglich anbieten empfohlen)
• Frittiertes/Paniertes: max. 1× / Woche

GETRÄNKE:
• Mind. 200 ml pro Kind kostenlos oder günstig anbieten
• Leitungswasser, ungesüßter Kräuter-/Früchtetee
• Keine Limonaden, Energydrinks, Eistee, gesüßter Saft

ALLERGENKENNZEICHNUNG:
• LMIV-Pflicht (14 Hauptallergene): Gluten, Krebstiere, Eier, Fisch, Erdnüsse,
  Soja, Milch, Schalenfrüchte, Sellerie, Senf, Sesam, Schwefeldioxid,
  Lupinen, Weichtiere — schriftlich am Ausgabepunkt oder auf Nachfrage
• Zusatzstoffe (E-Nummern, Farbstoffe) kennzeichnen

SONSTIGE ANFORDERUNGEN:
• Jodsalz verwenden (Jodmangel-Prävention)
• Bio-Lebensmittel: empfohlen (mind. 25 % Bio-Anteil für DGE-Zertifizierung)
• Saisonale und regionale Produkte bevorzugen
• Speiseplan: mind. 4 Wochen rotieren, kein Gericht häufiger als 1× / Woche
• Ausgabetemperatur: Warmgerichte ≥ 65 °C, Kaltes ≤ 7 °C (HACCP §4 LMHV)
• Allergiker-Sondermenü auf Anfrage anbieten

HÄUFIGE VERSTÖSSE (Kontrolle durch Schulbehörde / DGE-Zertifizierungsstelle):
• Zu viel rotes Fleisch, zu viel Frittiertes
• Fehlende vegetarische Option
• Unvollständige Allergenkennzeichnung
• Zuckerhaltige Getränke im Angebot
`.trim();

const KITA_KNOWLEDGE = `
DGE-QUALITÄTSSTANDARD KITA-VERPFLEGUNG (7. Auflage 2022) — aktiv

MAHLZEITENSTRUKTUR (Tageseinrichtungen für Kinder):
• Frühstück + Mittagessen + Nachmittags-Vesper (Snack) — bei Ganztages-Kita
• Zusätzlich: Getränke ganztags frei verfügbar

ENERGIEBEDARF MITTAGESSEN (50 % des Tagesbedarfs bei Ganztagskita):
• Krippe / U3 (1–3 J.): 200–300 kcal / Portion, Portionsgröße 150–200 g
• Kindergarten / Ü3 (3–6 J.): 350–450 kcal / Portion, 200–250 g

PFLICHT-FREQUENZEN (5-Tage-Woche):
• Vollkornprodukte: täglich (Vollkornbrot, Naturreis, Vollkornnudeln)
• Gemüse: täglich, auch als Rohkost oder gedünstetes Gemüse
• Obst: täglich (frisch, mundgerecht geschnitten)
• Milch / Milchprodukt: täglich (Joghurt, Quark, Käse, Milch)
• Hülsenfrüchte: ≥ 1× / Woche
• Seefisch: 1–2× / Woche (ohne Gräten, Filet bevorzugt)
• Fleisch/Geflügel: max. 2–3× / Woche
• Frittiertes: vermeiden (max. 0× / Woche — kein frittiertes Essen für U3)

SICHERHEITSREGELN (Erstickungsschutz):
• Keine ganzen Nüsse, Trauben, Kirschen mit Stein unter 3 Jahren
• Kein Honig unter 1 Jahr (Botulismus-Risiko)
• Kein rohes Ei (Salmonellen), kein Rohmilch-Käse unter 3 Jahren
• Feste Lebensmittel in mundgerechte Stücke schneiden (< 1,5 cm)
• Finger food (gut greifbar, weich, nicht zu groß) für U3 bevorzugen

KONSISTENZ & ZUBEREITUNG:
• Püriert / breiförmig: U3 (unter 12 Monate)
• Weiches Stückessen: 12–24 Monate
• Normales Essen (gut gekaut): ab 2–3 Jahren
• Gemüse und Fleisch gut weich garen (kein al dente)
• Kein scharfes Gewürz (Chili, Meerrettich), wenig Salz und Zucker

GETRÄNKE:
• Leitungswasser / ungesüßter Tee ganztags frei zugänglich
• Keine Limonaden, Fruchtnektar, gesüßte Milchgetränke

JODSALZ & MIKRONÄHRSTOFFE:
• Jodsalz verwenden, Vitamin D nach ärztlicher Empfehlung
• Eisenreiche Lebensmittel kombinieren (Fleisch + Vitamin C = bessere Aufnahme)

ALLERGENKENNZEICHNUNG:
• LMIV-Pflicht — gleich wie Schulverpflegung
• Elterninformation bei Allergien und Unverträglichkeiten zwingend schriftlich
`.trim();

const KRANKENHAUS_KNOWLEDGE = `
DGE-QUALITÄTSSTANDARD KRANKENHAUSVERPFLEGUNG (2020) — aktiv

KOSTFORMEN (Diätküche nach DGE / DGEM):
• Vollkost (VK): Standard für alle Patienten ohne Einschränkungen
• Leichte Vollkost (LVK): bei GI-Unverträglichkeiten — kein Kohl, keine
  Hülsenfrüchte, kein Frittiertes, keine rohen Zwiebeln
• Diabeteskost (DK): kohlenhydratkontrolliert, BE/KE-berechnet (12 g KH = 1 BE),
  glykämischer Index beachten, Zucker meiden
• Natriumarme Kost: max. 5–6 g NaCl/Tag (Hypertonie, Herzinsuffizienz, Ödeme)
• Kaliumarme Kost: < 2.000 mg K/Tag (chronische Nierenerkrankung)
• Purinarme Kost: < 500 mg Purine/Tag (Gicht) — kein Innereien, wenig Fleisch,
  kein Alkohol
• Cholesterinarme Kost: < 200 mg Cholesterin/Tag, wenig gesättigte Fette
• Proteinreduzierte Kost: bei schwerer Niereninsuffizienz (< 0,6 g/kg KG/Tag)
• Konsistenzmodifizierte Kost (IDDSI-Standard Level 3–7):
  Level 3 = liquidisiert, 4 = püriert, 5 = weich-stückig, 6 = weich,
  7 = normale Kost — bei Dysphagie-Patienten dokumentieren!
• Sondenernährung (EN) / Parenterale Ernährung (PE): Koordination mit
  Ernährungstherapeutin

MAKRONÄHRSTOFF-RICHTWERTE (Vollkost):
• Energie: 1800–2200 kcal/Tag (alters- und körpergewichtsabhängig)
• Protein: 0,8–1,0 g/kg KG/Tag (bei Wunden/OP: 1,2–1,5 g/kg)
• Fett: max. 30 % der Energie, davon < 10 % gesättigte Fettsäuren
• Kohlenhydrate: 50–55 % der Energie, bevorzugt Vollkorn

MAHLZEITENFREQUENZ:
• 3 Hauptmahlzeiten + 2 Zwischenmahlzeiten
• Frühstück 07:00–08:00, Mittagessen 11:30–13:00, Abendessen 17:30–18:30
• Nachtfasten < 11 Stunden (Malnutritions-Prävention)

HYGIENE & HACCP (besonders streng):
• Warmgerichte: Ausgabetemperatur ≥ 65 °C, max. 30 Min. Warmhaltung
• Kühlkost: ≤ 7 °C, Speisen innerhalb 2 h nach Ausgabe verbrauchen
• HACCP-Protokoll täglich für Temperaturkontrollen, Lieferkontrollen
• Kein Rohei, kein Rohmilch-Käse, kein Tartar, kein Räucherfisch für
  immunsupprimierte Patienten (Onkologie, Transplantation)

ALLERGENDOKUMENTATION:
• LMIV-Pflicht + klinikinterne Formulare (Patientenakte)
• Alle Allergien und Unverträglichkeiten vom ärztlichen Dienst übermitteln lassen
• Testergebnisse (RAST, Pricktest) beachten

MALNUTRITIONS-SCREENING:
• NRS-2002 oder MNA bei Aufnahme (Kurzform: Gewichtsverlust? BMI < 20.5?)
• Ernährungstherapeutin bei Score ≥ 3 einschalten
• Trinknahrung (ONS) bei unzureichender oraler Zufuhr
`.trim();

const SENIOREN_KNOWLEDGE = `
DGE-QUALITÄTSSTANDARD SENIORENEINRICHTUNGEN (4. Auflage 2019) — aktiv

ERNÄHRUNGSPHYSIOLOGISCHE BESONDERHEITEN (> 65 Jahre):
• Energiebedarf SINKT (weniger Bewegung, weniger Muskelmasse):
  Männer: 1.700–2.100 kcal/Tag; Frauen: 1.500–1.900 kcal/Tag
• Nährstoffdichte STEIGT — gleiche Vitamine/Mineralien trotz weniger Kalorien
• Protein: 1,0–1,2 g/kg KG/Tag (höher als Erwachsene!) — Sarkopenie-Prävention
  Bei Dekubitus, Wunden, Mangelernährung: bis 1,5 g/kg KG/Tag
• Calcium: 1.000 mg/Tag (Osteoporose-Prävention)
• Vitamin D: 800 IU/Tag — Supplement oft nötig (wenig Sonnenexposition)
• Vitamin B12: Supplementierung empfohlen (Resorption nimmt ab)
• Flüssigkeit: mind. 1,5 L/Tag — Durstgefühl nimmt im Alter ab!
  Trinkprotokoll führen (Ziel 6–8 Gläser/Tag dokumentieren)

MAHLZEITENSTRUKTUR:
• 3 Hauptmahlzeiten + 2 Zwischenmahlzeiten (besonders wichtig!)
• Frühstück, Mittagessen (Hauptmahlzeit warm), Abendbrot
• Morgen-Snack (10:00), Nachmittags-Snack (15:00)
• Nachtfasten < 11 Stunden — Eiweißabbau und Sturz-Risiko vermeiden

KONSISTENZ & DYSPHAGIE (IDDSI-Standard):
• Level 7: Normale Kost — für fitte Senioren
• Level 6: Weiche Kost — leicht zerkaubar (kein zähes Fleisch, kein hartes Brot)
• Level 5: Gehackte und feuchte Kost — in < 1,5 cm Stücke geschnitten
• Level 4: Pürierte Kost — glatt, klumpenlos (für starke Dysphagie)
• Level 3: Liquidisierte Kost — trinkbar, Konsistenz wie Joghurt
• Schluckdiagnose vom Logopäden: IDDSI-Level schriftlich in Akte

DEMENZ-GERECHTE ERNÄHRUNG:
• Finger food bevorzugen (selbstständiges Essen stärken)
• Kontrastreiche Teller (weißes Essen auf weißem Teller vermeiden)
• Ruhige Atmosphäre, ausreichend Zeit (mind. 30 Min. Mittagessen)
• Lieblingsspeisen der Biografiearbeit nutzen
• Aromaintensive Speisen (Kräuter, Gewürze) — Riech-/Geschmackssinn nimmt ab

PFLICHT-FREQUENZEN (7-Tage-Speiseplan):
• Gemüse / Salat: täglich
• Obst: täglich
• Vollkornprodukte: ≥ 3× / Woche
• Fisch: 1–2× / Woche (Omega-3-Fettsäuren)
• Fleisch: max. 3× / Woche, bevorzugt mageres Geflügel
• Hülsenfrüchte: ≥ 1× / Woche (Protein + Ballaststoffe)
• Milch/Milchprodukt: täglich (Calcium-Versorgung)

HÄUFIGE PROBLEME:
• Mangelernährung (MNA-SF < 8 Punkte): sofort Ernährungstherapeutin
• Gewichtsverlust > 5 % in 3 Monaten oder > 10 % in 6 Monaten: kritisch!
• Dehydratation: Trinkprotokoll, Getränke gut sichtbar platzieren
• Obstipation: Ballaststoffe + Flüssigkeit + Bewegung
• Schluckstörungen: Logopädie + IDDSI-Anpassung

ALLERGENKENNZEICHNUNG & DOKUMENTATION:
• LMIV-Pflicht (14 Allergene)
• Individuelle Verträglichkeitslisten in der Bewohnerakte
• Wechselkost-Plan bei Unverträglichkeiten (kein Einheitsbrei)
`.trim();

// ─── Gemeinsames Basiswissen (immer aktiv) ───────────────────────────────────

export const DGE_COMMON_KNOWLEDGE = `
DEUTSCHES LEBENSMITTELRECHT (immer gültig):
• LMIV (EU 1169/2011): 14 kennzeichnungspflichtige Allergene immer ausweisen
• LMHV §4 / EU 852/2004: HACCP-Grundsätze — Gefahrenanalyse, Kritische Kontrollpunkte,
  Monitoring, Korrekturmaßnahmen, Verifikation, Dokumentation
• Warmgerichte: Ausgabetemperatur ≥ 65 °C; Kühlkost ≤ 7 °C
• Rückverfolgbarkeit: Lieferscheine 5 Jahre aufbewahren (§ 17 LFGB)
• Jodsalz: nationale Empfehlung zur Jodmangel-Prävention
`.trim();

// ─── Lookup map ──────────────────────────────────────────────────────────────

const KNOWLEDGE_MAP: Record<DgeStandard, string> = {
  schule: SCHULE_KNOWLEDGE,
  kita: KITA_KNOWLEDGE,
  krankenhaus: KRANKENHAUS_KNOWLEDGE,
  senioren: SENIOREN_KNOWLEDGE,
};

/**
 * Returns the full DGE knowledge block to inject into the AI system prompt.
 * Pass undefined to get only the common food-law baseline.
 */
export function getDgeKnowledge(standard: DgeStandard | undefined): string {
  const specific = standard ? KNOWLEDGE_MAP[standard] : "";
  return [specific, DGE_COMMON_KNOWLEDGE].filter(Boolean).join("\n\n");
}

/** Short label for the active standard (for use in prompts). */
export function getDgeLabel(standard: DgeStandard | undefined): string {
  if (!standard) return "";
  const labels: Record<DgeStandard, string> = {
    schule: "Schulverpflegung",
    kita: "Kita-Verpflegung",
    krankenhaus: "Krankenhausverpflegung",
    senioren: "Senioreneinrichtung",
  };
  return labels[standard];
}
