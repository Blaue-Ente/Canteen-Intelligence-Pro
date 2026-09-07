/**
 * Offline knowledge base — pre-written answers for common DGE, HACCP,
 * allergen and kitchen questions. Works without internet access.
 *
 * Used as fallback when:
 *  - The AI API is unreachable (offline mode)
 *  - Kios cannot answer a question via the AI round-trip
 *
 * Matching is keyword-based: the first entry whose ANY keyword matches
 * (case-insensitive substring) is returned.
 */

export interface OfflineEntry {
  /** Keywords that trigger this entry (case-insensitive substring match). */
  keywords: string[];
  /** Short answer suitable for Kios voice (≤ 20 words). */
  answerShort: string;
  /** Full answer for the chat assistant (markdown allowed). */
  answerFull: string;
  /** Optional DGE source citation. */
  source?: string;
}

export const OFFLINE_KNOWLEDGE: OfflineEntry[] = [
  // ── DGE Schulverpflegung ───────────────────────────────────────────────
  {
    keywords: ["schule kcal", "schulkind kalorie", "grundschule kcal", "energiebedarf schule", "sek i kcal"],
    answerShort: "Grundschule: 550–700 kcal, SEK I: 700–800 kcal pro Mittagessen.",
    answerFull: `**Energiebedarf Schulverpflegung** (DGE 7. Aufl. 2022)\n\nDas Mittagessen deckt **30 % des Tagesbedarfs**:\n- **Grundschule** (6–10 J.): 550–700 kcal\n- **SEK I** (10–15 J.): 700–800 kcal\n- **SEK II** (15–18 J.): 800–900 kcal`,
    source: "DGE-Qualitätsstandard Schulverpflegung, 7. Auflage 2022",
  },
  {
    keywords: ["schule fleisch", "schule rotes fleisch", "schulverpflegung fleisch", "fleisch häufigkeit schule"],
    answerShort: "Rotes Fleisch maximal 1× pro Woche, Fleisch gesamt max. 2× pro Woche.",
    answerFull: `**Fleisch in der Schulverpflegung** (DGE 7. Aufl. 2022)\n\n- **Fleisch/Wurstwaren gesamt:** max. **2×/Woche**\n- **Rotes Fleisch** (Rind, Schwein, Lamm): max. **1×/Woche**\n- **Geflügel** zählt nicht als rotes Fleisch\n- Frittiertes/Paniertes: max. **1×/Woche**\n- Seefisch: min. **1×/Woche** (MSC bevorzugt)`,
    source: "DGE-Qualitätsstandard Schulverpflegung, 7. Auflage 2022",
  },
  {
    keywords: ["schule vollkorn", "vollkorn frequenz schule", "schulverpflegung vollkorn"],
    answerShort: "Vollkornprodukte mindestens 3× pro Woche — Pflicht im DGE-Standard.",
    answerFull: `**Vollkornpflicht Schulverpflegung**\n\n≥ **3×/Woche** Vollkornprodukte:\n- Vollkornnudeln, Naturreis, Vollkornbrot, Dinkel, Hirse\n- Auch Vollkorntoast und -brötchen zählen\n\nEbenfalls Pflicht:\n- Gemüse/Salat: täglich (≥ 5×/Woche)\n- Hülsenfrüchte: ≥ 1×/Woche\n- Rohkost oder frisches Obst: ≥ 3×/Woche`,
    source: "DGE-Qualitätsstandard Schulverpflegung, 7. Auflage 2022",
  },
  {
    keywords: ["schule getränk", "schulverpflegung getränk", "schule wasser", "schule saft"],
    answerShort: "Mindestens 200 ml Wasser kostenlos pro Kind täglich — keine Limonaden.",
    answerFull: `**Getränke in der Schulverpflegung**\n\n✅ **Erlaubt:** Leitungswasser, stilles Mineralwasser, ungesüßter Kräuter-/Früchtetee\n\n❌ **Verboten:** Limonaden, Eistee, Energydrinks, gesüßte Fruchtsäfte, Nektare\n\n**Pflicht:** Mindestens **200 ml** pro Kind und Tag, kostenlos oder günstig anbieten.`,
    source: "DGE-Qualitätsstandard Schulverpflegung, 7. Auflage 2022",
  },

  // ── DGE Kita-Verpflegung ────────────────────────────────────────────────
  {
    keywords: ["kita kcal", "kita kalorie", "kita portion", "kindergarten energie", "u3 portion", "ü3 portion"],
    answerShort: "Kita Ü3: 350–450 kcal Mittagessen, Portion 200–250 g. U3: 200–300 kcal, 150–200 g.",
    answerFull: `**Energiebedarf Kita-Verpflegung** (DGE 7. Aufl. 2022)\n\n| Gruppe | Alter | Kcal | Portion |\n|--------|-------|------|---------|\n| **U3** | 1–3 J. | 200–300 kcal | 150–200 g |\n| **Ü3** | 3–6 J. | 350–450 kcal | 200–250 g |\n\n*Mittagessen = 50 % des Tagesbedarfs bei Ganztagskita*\n\n3 Mahlzeiten täglich: Frühstück + Mittagessen + Nachmittags-Vesper`,
    source: "DGE-Qualitätsstandard Kita-Verpflegung, 7. Auflage 2022",
  },
  {
    keywords: ["kita honig", "kleinkind honig", "baby honig", "botulismus kita"],
    answerShort: "Kein Honig unter 1 Jahr — Botulismus-Risiko! Ab 1 Jahr in kleinen Mengen erlaubt.",
    answerFull: `**Honig in der Kita** ⚠️\n\n**Kein Honig für Kinder unter 1 Jahr!**\n\nGrund: Clostridium botulinum Sporen können im unreifen Verdauungssystem Säuglingsbotulismus auslösen — lebensbedrohlich.\n\nAb 1 Jahr: Honig in kleinen Mengen erlaubt. Dennoch sparsam verwenden (Zucker).\n\nWeitere Sicherheitsregeln:\n- Keine ganzen Nüsse/Trauben/Kirschen unter 3 Jahren (Erstickungsgefahr)\n- Kein rohes Ei (Salmonellen)\n- Lebensmittel in Stücke < 1,5 cm schneiden`,
    source: "DGE-Qualitätsstandard Kita-Verpflegung, 7. Auflage 2022",
  },
  {
    keywords: ["kita konsistenz", "kita texture", "u3 brei", "kleinkind essen konsistenz", "fingerfood kita"],
    answerShort: "U3 unter 12 Monate püriert, 12–24 Monate weiches Stückessen, ab 2–3 Jahren normal.",
    answerFull: `**Konsistenz in der Kita** (IDDSI-angelehnt)\n\n| Alter | Konsistenz |\n|-------|------------|\n| < 12 Monate | Püriert / breiförmig |\n| 12–24 Monate | Weiches Stückessen (< 1,5 cm) |\n| 2–3 Jahre | Gut kaubares normales Essen |\n| Ab 3 Jahre | Normalkost (gut mundgerecht) |\n\n**Fingerfood** für U3: greifbar, weich, keine kleinen runden Stücke.\n\nGemüse und Fleisch immer **sehr weich** garen — kein al dente.`,
    source: "DGE-Qualitätsstandard Kita-Verpflegung, 7. Auflage 2022",
  },

  // ── DGE Senioreneinrichtungen ───────────────────────────────────────────
  {
    keywords: ["senioren protein", "ältere protein", "seniorenheim eiweiß", "sarkopenie"],
    answerShort: "Senioren brauchen 1,0–1,2 g Protein pro kg Körpergewicht täglich — mehr als Erwachsene.",
    answerFull: `**Proteinbedarf Senioren** (DGE 4. Aufl. 2019)\n\n- **Normal:** 1,0–1,2 g/kg Körpergewicht/Tag\n- **Erkrankt / Wunden / Dekubitus:** bis 1,5 g/kg/Tag\n- Zum Vergleich: Erwachsene nur 0,8 g/kg/Tag\n\n**Gute Proteinquellen:**\n- Fisch, mageres Geflügel, Hülsenfrüchte, Quark, Joghurt, Eier\n- Täglich Milchprodukt (auch Calcium!)\n\nBei Mangelernährung (MNA-SF < 8): sofort Ernährungstherapeutin hinzuziehen.`,
    source: "DGE-Qualitätsstandard Senioreneinrichtungen, 4. Auflage 2019",
  },
  {
    keywords: ["iddsi", "dysphagie", "schluckstörung", "püriert", "konsistenz senioren", "konsistenz krankenhaus"],
    answerShort: "IDDSI Level 4 püriert, 5 weich-stückig, 6 weich, 7 Normalkost — für Dysphagie dokumentieren.",
    answerFull: `**IDDSI-Konsistenzlevels** (International Dysphagia Diet Standardisation Initiative)\n\n| Level | Name | Beschreibung |\n|-------|------|--------------|\n| 3 | Liquidisiert | Trinkbar, Joghurt-Konsistenz |\n| 4 | Püriert | Glatt, löffelbar, hält Form |\n| 5 | Weich-stückig | Stücke < 1,5 cm, sehr weich |\n| 6 | Weich | Leicht zerkaubar, kein zähes Fleisch |\n| 7 | Normal | Alle Texturen |\n\n**Wichtig:** IDDSI-Level vom Logopäden diagnostizieren lassen und in der Bewohnerakte dokumentieren!`,
    source: "IDDSI Framework 2017 / DGE-Qualitätsstandard Senioreneinrichtungen 2019",
  },
  {
    keywords: ["senioren flüssigkeit", "trinkprotokoll", "dehydratation senioren", "senioren trinken"],
    answerShort: "Senioren brauchen mindestens 1,5 Liter täglich — Durstgefühl nimmt im Alter ab.",
    answerFull: `**Flüssigkeitszufuhr Senioren**\n\n- **Mindest:** 1,5 L/Tag (6–8 Gläser)\n- Durstgefühl lässt mit dem Alter nach → aktiv anbieten!\n- **Trinkprotokoll** führen (täglich dokumentieren)\n- Getränke gut sichtbar und erreichbar platzieren\n- Auch Suppen, Joghurt usw. zählen zur Flüssigkeitszufuhr\n\n**Zeichen der Dehydratation:** konzentrierter Urin, Verwirrtheit, Schwindel → sofort reagieren!`,
    source: "DGE-Qualitätsstandard Senioreneinrichtungen, 4. Auflage 2019",
  },
  {
    keywords: ["senioren calcium", "osteoporose", "vitamin d senioren", "knochen senioren"],
    answerShort: "Senioren brauchen 1.000 mg Calcium und 800 IU Vitamin D täglich.",
    answerFull: `**Calcium & Vitamin D bei Senioren**\n\n| Nährstoff | Zufuhr | Quellen |\n|-----------|--------|---------|\n| **Calcium** | 1.000 mg/Tag | Milch, Joghurt, Käse, grünes Gemüse |\n| **Vitamin D** | 800 IU/Tag | Supplement empfohlen (wenig Sonne) |\n\nVitamin D wird bei Senioren oft nicht ausreichend durch die Haut gebildet → ärztlich verordnetes Supplement.\n\n**Calcium-Tipp:** 200 ml Milch = ca. 240 mg Calcium → täglich 4–5 Portionen Milchprodukte!`,
    source: "DGE-Qualitätsstandard Senioreneinrichtungen, 4. Auflage 2019",
  },

  // ── DGE Krankenhausverpflegung ──────────────────────────────────────────
  {
    keywords: ["kostform", "vollkost", "leichte vollkost", "lkv", "krankenhausdiät", "krankenkost"],
    answerShort: "Vollkost für alle Patienten, Leichte Vollkost bei GI-Unverträglichkeiten, kein Kohl/Hülsenfrüchte.",
    answerFull: `**Kostformen im Krankenhaus** (DGE 2020)\n\n| Kostform | Indikation | Besonderheit |\n|----------|------------|---------------|\n| **Vollkost (VK)** | Alle Patienten ohne Einschränkung | Standard |\n| **Leichte Vollkost (LVK)** | GI-Unverträglichkeiten | Kein Kohl, keine Hülsenfrüchte, kein Frittiertes |\n| **Diabeteskost (DK)** | Diabetes mellitus | BE-berechnet, kein Zucker |\n| **Natriumarm** | Hypertonie, Herzinsuffizienz | Max. 5–6 g NaCl/Tag |\n| **Kaliumarm** | Nierenerkrankung | < 2.000 mg K/Tag |\n| **Purinarme Kost** | Gicht | < 500 mg Purine/Tag |\n| **IDDSI Level 3–7** | Dysphagie | Logopädin bestimmt Level |`,
    source: "DGE-Qualitätsstandard Krankenhausverpflegung, 2020",
  },
  {
    keywords: ["be rechnung", "broteinheit", "kohlenhydrat diabetiker", "ke einheit"],
    answerShort: "1 BE = 12 g Kohlenhydrate. 55 g KH in einer Portion = ca. 4,6 BE.",
    answerFull: `**BE-Berechnung (Broteinheiten)**\n\n**1 BE = 12 g Kohlenhydrate**\n\nBerechnung: KH in g ÷ 12 = BE\n\nBeispiele:\n- 200 g Kartoffeln (18 g KH / 100 g) = 36 g KH = **3 BE**\n- 80 g Vollkornnudeln trocken (57 g KH) = **4,75 BE**\n- 150 g Naturreis gekocht (25 g KH / 100 g) = 37,5 g KH = **3,1 BE**\n\nDiabeteskost: **kein Zucker**, keine Weißmehlprodukte, kein Alkohol.\nBE auf Patientenblatt dokumentieren und mit dem Arzt / DT abstimmen.`,
    source: "DGE-Qualitätsstandard Krankenhausverpflegung, 2020",
  },

  // ── HACCP & Lebensmittelrecht ─────────────────────────────────────────────
  {
    keywords: ["haccp", "§4 lmhv", "hygienekontrollpunkt", "kritischer kontrollpunkt", "ccp"],
    answerShort: "HACCP: 7 Grundsätze — Gefahrenanalyse, CCPs, Grenzwerte, Monitoring, Korrekturen, Verifikation, Dokumentation.",
    answerFull: `**HACCP-Grundsätze** (§4 LMHV / EU VO 852/2004)\n\n1. **Gefahrenanalyse** — biologische, chemische, physikalische Gefahren\n2. **Kritische Kontrollpunkte (CCPs)** identifizieren\n3. **Grenzwerte** festlegen (z.B. Kerntemperatur ≥ 72 °C)\n4. **Monitoring** — regelmäßige Überwachung der CCPs\n5. **Korrekturmaßnahmen** bei Abweichungen\n6. **Verifikation** — Überprüfung des Systems\n7. **Dokumentation** — lückenlos, 5 Jahre aufbewahren\n\n**Temperaturen:**\n- Warmgerichte Ausgabe: ≥ 65 °C\n- Kühlkost: ≤ 7 °C\n- Tiefkühlkost: ≤ -18 °C\n- Kerntemperatur Geflügel: ≥ 75 °C`,
    source: "LMHV §4 / EU Verordnung 852/2004",
  },
  {
    keywords: ["ausgabetemperatur", "warmhalten", "mindesttemperatur", "kühlkost temperatur"],
    answerShort: "Warmgerichte mindestens 65 °C bei der Ausgabe, Kühlkost maximal 7 °C.",
    answerFull: `**HACCP-Temperaturgrenzen**\n\n| Lebensmittel | Temperatur |\n|---|---|\n| Warmgerichte (Ausgabe) | **≥ 65 °C** |\n| Warmhaltedauer (max.) | **30 Minuten** |\n| Kühlkost | **≤ 7 °C** |\n| Tiefkühlkost | **≤ −18 °C** |\n| Geflügel Kerntemperatur | **≥ 75 °C** |\n| Hackfleisch Kerntemperatur | **≥ 72 °C** |\n| Fisch Kerntemperatur | **≥ 65 °C** |\n\nTemperaturen täglich im HACCP-Protokoll erfassen!`,
    source: "LMHV §4 / EU 852/2004 Anhang II",
  },
  {
    keywords: ["allergen", "lmiv", "14 allergene", "kennzeichnungspflicht", "hauptallergene"],
    answerShort: "14 LMIV-Allergene: Gluten, Krebstiere, Eier, Fisch, Erdnüsse, Soja, Milch, Schalenfrüchte, Sellerie, Senf, Sesam, Schwefeldioxid, Lupinen, Weichtiere.",
    answerFull: `**14 LMIV-Allergene** (EU VO 1169/2011)\n\n| # | Allergen | Beispiele |\n|---|----------|-----------|\n| A | Gluten | Weizen, Roggen, Gerste, Hafer |\n| B | Krebstiere | Garnelen, Krabben, Hummer |\n| C | Eier | Mayonnaise, Nudeln, Gebäck |\n| D | Fisch | Alle Fischarten |\n| E | Erdnüsse | Erdnussbutter, Saucen |\n| F | Soja | Tofu, Sojasoße, Sojaöl |\n| G | Milch | Käse, Butter, Sahne, Joghurt |\n| H | Schalenfrüchte | Nüsse (Mandeln, Walnüsse, Cashews…) |\n| L | Sellerie | Suppen, Salate, Gewürzmischungen |\n| M | Senf | Senf, manche Soßen |\n| N | Sesam | Tahini, asiatische Gerichte |\n| O | Schwefeldioxid | Wein, Trockenfrüchte |\n| P | Lupinen | Lupinenmehl, manche Backwaren |\n| R | Weichtiere | Tintenfisch, Muscheln, Schnecken |\n\n**Pflicht:** Schriftliche Kennzeichnung am Ausgabepunkt oder auf Nachfrage!`,
    source: "EU Lebensmittelinformations-Verordnung 1169/2011 (LMIV)",
  },
  {
    keywords: ["rückstellprobe", "lmhv §11", "lebensmittelprobe", "speiseprobe", "rückstellproben frist"],
    answerShort: "Rückstellproben 7 Tage lang aufbewahren, mindestens 100 g bei -18 °C — Pflicht nach LMHV §11.",
    answerFull: `**Rückstellproben** (LMHV §11)\n\n**Pflicht in:** Gemeinschaftsverpflegung (Schule, Kita, Krankenhaus, Seniorenheim, Kantine)\n\n**Vorschriften:**\n- **Menge:** ≥ 100 g pro Gericht pro Ausgabetag\n- **Aufbewahrung:** Bei **−18 °C** (Tiefkühlkost)\n- **Frist:** **7 Tage** ab Herstellungsdatum\n- **Beschriftung:** Datum, Gericht, Charge\n- **Entnahme:** Zeitgleich mit der Ausgabe\n\nNach 7 Tagen können Proben vernichtet werden (wenn kein Krankheitsfall vorliegt).\n\nIn KitchenOS unter **Produktion → Rückstellproben** erfassen.`,
    source: "Lebensmittelhygiene-Verordnung §11",
  },
  {
    keywords: ["jodsalz", "jodmangel", "warum jodsalz", "jodsalz empfehlung"],
    answerShort: "Jodsalz verwenden — nationale Empfehlung zur Jodmangel-Prävention in Deutschland.",
    answerFull: `**Jodsalz in der Gemeinschaftsverpflegung**\n\nDeutschland ist ein **Jodmangelgebiet** — der Boden enthält zu wenig Jod.\n\n**Empfehlung:** Immer jodiertes Speisesalz verwenden (auch in DGE-Qualitätsstandards vorgeschrieben).\n\nJod ist wichtig für:\n- Schilddrüsenfunktion\n- Gehirnentwicklung bei Kindern\n- Energiestoffwechsel\n\n**Achtung:** Jodsalz nicht mit normalen Speisesalz mischen — immer konsequent ersetzen.`,
    source: "DGE-Qualitätsstandards (alle Einrichtungstypen)",
  },

  // ── Portionsgrößen ────────────────────────────────────────────────────────
  {
    keywords: ["portionsgröße", "mensa portion", "kantinen portion", "wie viel gramm"],
    answerShort: "Mensa/Kantine: Hauptgericht 350–450 g. Suppe 300–400 ml. Dessert 100–150 g.",
    answerFull: `**Institutionelle Portionsgrößen (Richtwerte)**\n\n| Gericht | Gramm/ml |\n|---------|----------|\n| Hauptgericht Erwachsene | 350–450 g |\n| Hauptgericht Grundschule | 280–350 g |\n| Hauptgericht Kita Ü3 | 200–250 g |\n| Hauptgericht Kita U3 | 150–200 g |\n| Suppe | 300–400 ml |\n| Dessert | 100–150 g |\n| Salat als Beilage | 80–120 g |\n| Brot / Brötchen | 50–70 g |\n\nSenioren: eher kleinere Portionen (300–380 g), dafür 2 Zwischenmahlzeiten täglich.`,
    source: "DGE-Qualitätsstandards / Mensa-Richtwerte",
  },

  // ── Allgemeine Küchenfragen ────────────────────────────────────────────────
  {
    keywords: ["butter ersetzen", "butter alternative", "margarine statt butter"],
    answerShort: "Butter kann durch Margarine, Rapsöl oder Kokosöl ersetzt werden.",
    answerFull: `**Butterersatz im Kochen**\n\n| Ersatz | Verhältnis | Eignung |\n|--------|------------|----------|\n| Margarine | 1:1 | Backen, Braten, Aufstrich |\n| Rapsöl | 80 % der Menge | Braten, Dünsten |\n| Kokosöl | 1:1 | Süßes Backen, asiatisch |\n| Apfelmus | 50 % der Menge | Süßes Backen (weniger Fett) |\n| Joghurt | gleiche Menge | Dips, Saucen |\n\nFür vegane Küche: pflanzliche Margarine (ohne Palmöl bevorzugen).`,
  },
  {
    keywords: ["schnitzel dauer", "schnitzel zubereitung", "wie lange schnitzel"],
    answerShort: "Wiener Schnitzel brät in der Pfanne je 3–4 Minuten pro Seite bei mittlerer Hitze.",
    answerFull: `**Schnitzel-Zubereitungszeit**\n\n- **Dicke:** 0,5–1 cm klopfen (Plattieren)\n- **Temperatur:** Mittlere bis hohe Hitze (Butterschmalz)\n- **Bratzeit:** Je **3–4 Minuten** pro Seite\n- **Kerntemperatur:** ≥ 72 °C (HACCP)\n- **Panade:** goldbraun, nicht verbrennen\n\n**Tipp:** Schnitzel schwimmen lassen — nicht auf das Fleisch drücken, damit die Panade aufgeht (typische Wiener-Technik).`,
  },
  {
    keywords: ["bio anteil", "bio quote", "dge zertifikat bio", "bio anforderung"],
    answerShort: "Für DGE-Zertifizierung empfohlen: mindestens 25 % Bio-Anteil bei Lebensmitteln.",
    answerFull: `**Bio-Anteil für DGE-Zertifizierung**\n\nEmpfehlung: ≥ **25 % Bio-Anteil** der verwendeten Lebensmittel (nach Einkaufswert).\n\nBio-Priorität (einfacher umsetzbar):\n1. Milch und Milchprodukte\n2. Eier\n3. Saisonales Gemüse und Obst\n4. Getreideprodukte\n\nTipp: Mit regionalen Erzeugerpartnerschaften oft günstiger als Supermarkt-Bio.\n\nIn KitchenOS: Lieferant als "Bio-zertifiziert" markieren → automatische Öko-Punkte im Öko-Wizard.`,
    source: "DGE-Qualitätsstandard Schulverpflegung, 7. Auflage 2022",
  },
  {
    keywords: ["nrs 2002", "mna", "mangelernährung screening", "ernährungsscreening"],
    answerShort: "NRS-2002 für Krankenhaus, MNA für Senioren — Screening bei Aufnahme Pflicht.",
    answerFull: `**Mangelernährungs-Screening**\n\n**NRS-2002** (Krankenhaus):\n- Screening bei **Aufnahme** und wöchentlich\n- Score ≥ 3 → Ernährungstherapeutin einschalten\n- Fragen: BMI < 20,5? Gewichtsverlust? Reduzierte Nahrungsaufnahme? Schwere Erkrankung?\n\n**MNA-SF** (Senioren, Mini Nutritional Assessment):\n- Score < 8 → Mangelernährung → sofort handeln\n- Score 8–11 → Risiko → beobachten\n- Score 12+ → normal\n\nBei Mangelernährung: Trinknahrung (ONS), angereicherte Speisen, ggf. Sondenernährung.`,
    source: "DGEM-Leitlinie / DGE-Qualitätsstandard Krankenhausverpflegung 2020",
  },

  // ── Kita: Zucker, Getränke, Sicherheit ────────────────────────────────────
  {
    keywords: [
      "kita zucker", "zucker kita", "süßigkeiten kita", "nachtisch kita",
      "dessert kita", "süßspeise kindergarten", "kita sweets", "sugar kindergarten",
    ],
    answerShort: "In der Kita höchstens 1 Süßspeise pro Woche — keine gesüßten Getränke.",
    answerFull: `**Zucker in der Kita-Verpflegung** (DGE Kita 7. Aufl. 2022)\n\n- Süßspeisen / Nachtisch: **höchstens 1× pro Woche**\n- Keine gesüßten Milchprodukte als Alltag (Fruchtjoghurt mit Zucker, Kakao)\n- Natürliche Süße bevorzugen: Obst, ungesüßter Joghurt, Kompott ohne Zucker\n- Kuchen nur zu besonderen Anlässen, nicht im Speiseplan\n\n**Warum:** Kleinkinder prägen den Geschmack jetzt. Viel Zucker erhöht Karies- und Übergewichtsrisiko.`,
    source: "DGE-Qualitätsstandard Kita-Verpflegung, 7. Auflage 2022",
  },
  {
    keywords: [
      "kita getränk", "kindergarten trinken", "kita wasser", "kita saft",
      "kita limonade", "kita milch trinken", "kita drinks",
    ],
    answerShort: "In der Kita: Wasser und ungesüßter Tee. Kein Saft als Alltagsgetränk.",
    answerFull: `**Getränke in der Kita**\n\n✅ Leitungswasser, stilles Mineralwasser, ungesüßter Kräutertee\n✅ Milch zu den Mahlzeiten (Vollmilch 3,5 % für U3, 1,5 % ab Ü3 üblich)\n\n❌ Limonade, Eistee, Nektar, Smoothies als Getränk, gesüßter Kakao im Alltag\n❌ Fruchtsaft unverdünnt — höchstens stark verdünnt und selten\n\nWasser steht den ganzen Tag frei zur Verfügung. In Berlin: Trinkbrunnen und Leitungswasser sind einwandfrei.`,
    source: "DGE-Qualitätsstandard Kita-Verpflegung, 7. Auflage 2022",
  },
  {
    keywords: [
      "erstickungsgefahr", "verschluck", "ganze nüsse kita", "trauben kita",
      "kirschen kita", "würstchen kita", "choking kindergarten", "nüsse kleinkind",
    ],
    answerShort: "Keine ganzen Nüsse, Trauben oder runden Würstchen unter 3 Jahren — Erstickungsgefahr.",
    answerFull: `**Erstickungsgefahr in der Kita** (unter 3 Jahren besonders)\n\nImmer mundgerecht, weich, nicht rund:\n- Trauben, Kirschen, Cocktailtomaten **halbieren oder vierteln**\n- Keine ganzen Nüsse, Mandeln, Popcorn\n- Würstchen der Länge nach aufschneiden, nicht in Scheiben\n- Hartes Rohkost-Gemüse (Möhre, Apfel) raspeln oder dünsten\n- Stücke unter **1,5 cm**\n\nPersonal bleibt während der Mahlzeit am Tisch. Notfallplan (Erste Hilfe Kind) muss bekannt sein.`,
    source: "DGE-Qualitätsstandard Kita-Verpflegung, 7. Auflage 2022",
  },
  {
    keywords: [
      "kita milch", "rohmilch", "vorzugsmilch kita", "milch u3", "vollmilch kita",
      "raw milk kindergarten",
    ],
    answerShort: "Keine Rohmilch in der Kita. U3: Vollmilch, pasteurisiert.",
    answerFull: `**Milch in der Kita**\n\n- **Immer pasteurisiert** — keine Rohmilch / Vorzugsmilch (Listerien, EHEC)\n- **U3 (1–3 J.):** Vollmilch ca. 3,5 % Fett (Energie und fettlösliche Vitamine)\n- **Ü3:** fettarme Milch 1,5 % ist üblich, Vollmilch bleibt erlaubt\n- Pflanzendrinks nur nach Absprache (Allergie, familiäre Vorgabe) und angereichert (Calcium, B12)\n- Ungezuckert. Kakao nicht als Alltagsgetränk.`,
    source: "DGE-Qualitätsstandard Kita-Verpflegung, 7. Auflage 2022",
  },
  {
    keywords: [
      "kita salz", "salz kleinkind", "jodsalz kita", "kindergarten salt",
    ],
    answerShort: "In der Kita sparsam salzen — immer Jodsalz, keine Würzsoßen extra auf den Tisch.",
    answerFull: `**Salz in der Kita**\n\n- Sparsam würzen, Kräuter statt Salz\n- **Immer Jodsalz** (Deutschland ist Jodmangelgebiet)\n- Keine Salzstreuer auf dem Kindertisch\n- Fertigsoßen, Brühwürfel und Knabbergebäck oft versteckt salzig — meiden\n- DGE: der Salzgehalt der Mittagsverpflegung soll niedrig bleiben; genaue mg-Grenzen gehören in die Nährwertberechnung.`,
    source: "DGE-Qualitätsstandard Kita-Verpflegung, 7. Auflage 2022",
  },
  {
    keywords: [
      "kita fleisch", "fleisch kindergarten", "kita wurst", "kita fisch",
      "kita vegetarisch",
    ],
    answerShort: "Kita: max. 2× Fleisch/Woche, davon max. 1× rot. Fisch 1×. Vegetarisch oft.",
    answerFull: `**Fleisch, Fisch, Vegetarisch — Kita (DGE 2022)**\n\n- Fleisch/Wurst **höchstens 2×/Woche**\n- Rotes Fleisch (Rind, Schwein, Lamm) **höchstens 1×/Woche**\n- **Seefisch mindestens 1×/Woche** (MSC, ohne Gräten, weich)\n- Vegetarische/vegane Hauptgerichte **mindestens 3×/Woche**\n- Hülsenfrüchte **mindestens 1×/Woche** (Linsen, Bohnen — weich gekocht)\n- Frittiertes **vermeiden** (höchstens selten, nicht wöchentlich)\n\nIn KitchenOS: DGE-Standard auf **Kita** stellen — der Score prüft genau diese Frequenzen.`,
    source: "DGE-Qualitätsstandard Kita-Verpflegung, 7. Auflage 2022",
  },
  {
    keywords: [
      "kantine dge", "betriebsgastronomie", "betriebsrestaurant standard",
      "kantine fleisch", "kantine vollkorn",
    ],
    answerShort: "Kantine: Gemüse täglich, Vollkorn 3×, Fleisch max. 2×, Fisch 1×, Wasser frei.",
    answerFull: `**DGE in der Kantine / Betriebsgastronomie**\n\nDie DGE-Kriterien für Gemeinschaftsverpflegung gelten analog:\n- Gemüse oder Salat **täglich**\n- Vollkorn **≥ 3×/Woche**\n- Hülsenfrüchte **≥ 1×/Woche**\n- Seefisch **≥ 1×/Woche**\n- Rotes Fleisch **≤ 1–2×/Woche**\n- Frittiertes **≤ 1×/Woche**\n- Ungesüßte Getränke, Wasser kostenlos\n- Jodsalz, wenig Zucker\n\nFür Berliner Behördenkantinen gilt zusätzlich die Berliner Ernährungsstrategie (Bio-Quote, regional, saisonal).`,
    source: "DGE-Qualitätsstandards Gemeinschaftsverpflegung",
  },

  // ── Berlin / Vorbestellung ────────────────────────────────────────────────
  {
    keywords: [
      "berlin kita", "berliner ernährungsstrategie", "bio quote berlin",
      "berlin kantine", "berlin speiseplan",
    ],
    answerShort: "Berlin: öffentliche Küchen sollen Bio und Regional steigern — DGE bleibt die fachliche Basis.",
    answerFull: `**Berlin — Kita und Kantine**\n\n- Fachliche Grundlage: **DGE-Qualitätsstandard Kita bzw. Gemeinschaftsverpflegung**\n- Berliner Ernährungsstrategie: mehr Bio, regional, saisonal, weniger Fleisch in öffentlichen Küchen\n- Leitungswasser in Berlin ist einwandfrei — als Standardgetränk nutzen\n- Allergenkennzeichnung (LMIV) muss für Erzieher:innen und Eltern nachvollziehbar sein\n- Bei Träger-Ausschreibungen oft DGE-Nachweis + Bio-Anteil gefordert — KitchenOS DGE-PDF nutzen\n\nKitchenOS sitzt in Berlin: Speiseplan, Vorbestellung und HACCP sind auf genau dieses Umfeld gebaut.`,
    source: "DGE 2022 / Berliner Ernährungsstrategie",
  },
  {
    keywords: [
      "vorbestellung", "wochenplan bestellen", "preorder", "kita bestellen",
      "speiseplan woche", "bestellung 08:00", "cutoff vorbestellung",
      "weekly order kindergarten",
    ],
    answerShort: "Kitas bestellen die Woche im Portal. Änderungen nur bis 08:00 Berlin am Liefertag.",
    answerFull: `**Wochen-Vorbestellung für Kitas**\n\n1. Küche veröffentlicht den **KW-Speiseplan** (Mo–Fr) im KitchenOS Preorder\n2. Kita / Standort loggt sich als **Geschäftskonto** ein (nach Freigabe durch die Küche)\n3. Pro Tag Gerichte und Stückzahlen wählen — Warenkorb bleibt erhalten bis zur Bestellung\n4. Bestellung absenden. **Stichtag: 08:00 Uhr Europe/Berlin** am gewünschten Liefertag\n5. Küche sieht Mengen in Produktion / Lieferliste\n\nTipp: Referenzcode vom Caterer einlösen, dann ist der Standort der Küche zugeordnet.\nOhne Internet in der Kita: Bestellung am Büro-Rechner der Leitung, nicht in der Küche.`,
    source: "KitchenOS Preorder / Europe/Berlin Cut-off 08:00",
  },
  {
    keywords: [
      "geschäftskonto", "business account", "kita portal zugang",
      "referenzcode", "freigabe kunde",
    ],
    answerShort: "Kitas brauchen ein freigeschaltetes Geschäftskonto und oft einen Referenzcode der Küche.",
    answerFull: `**Zugang zum Bestellportal**\n\n- Registrierung im Preorder-Portal\n- **Referenzcode** der liefernden Küche einlösen (Profil)\n- Küche schaltet das Konto frei (**Geschäftskonto genehmigt**)\n- Erst dann sind Wochenbestellungen möglich — schützt vor Fremdbestellungen\n\nEltern einzelner Kinder bestellen hier nicht; das Portal ist für **Standorte / Träger / Kantinenkunden**.`,
  },
  {
    keywords: [
      "anlieferung kita", "warmhaltezeit", "lieferkette warm", "ausgabe kita",
      "speisenverteilung",
    ],
    answerShort: "Warme Anlieferung: Ausgabe ≥ 65 °C, max. 30 Min halten. Kühlkost ≤ 7 °C.",
    answerFull: `**Anlieferung Kita / Außenstelle**\n\n- Warmkette: **≥ 65 °C** bei Ausgabe, Warmhalten **max. 30 Minuten**\n- Kühlkost: **≤ 7 °C**, Tiefkühl **≤ −18 °C**\n- Thermoboxen vorheizen / vorkühlen, Temperatur loggen (HACCP)\n- Rückstellprobe **≥ 100 g, 7 Tage, −18 °C** auch für ausgelieferte Chargen\n- Allergeninfo fährt mit (Aushang oder Lieferschein)\n\nIn KitchenOS: Produktion → Rückstellproben + HACCP-Temperaturlog.`,
    source: "LMHV §4 / §11 / EU 852/2004",
  },
  {
    keywords: [
      "kios was kannst du", "kios hilfe", "was kann kios", "kios befehle",
      "offline kios",
    ],
    answerShort: "Kios antwortet zu DGE, HACCP und Kita auch ohne Internet. Sage z. B. Kita kcal oder HACCP.",
    answerFull: `**Kios — der Küchenassistent**\n\nOhne Internet beantwortet Kios vorbereitete Fragen zu:\n- DGE Kita / Schule / Kantine (kcal, Fleisch, Fisch, Zucker, Getränke)\n- HACCP-Temperaturen, Allergene, Rückstellproben\n- Vorbestellung und Berliner Praxis\n\nMit Internet zusätzlich: Rezeptvorschläge, Bildscan, freie Fragen.\n\nBeispiele: „Kios, Kita kcal“, „Kios, Ausgabetemperatur“, „Kios, Honig unter einem Jahr“, „Kios, Vorbestellung“.`,
  },
  {
    keywords: ["dge kita", "dge kindergarten", "kita standard dge", "qualitätsstandard kita"],
    answerShort: "DGE Kita 2022: Obst und Milch täglich, kein Frittieren, wenig Fleisch, Fisch 1×.",
    answerFull: `**DGE-Qualitätsstandard Kita-Verpflegung (7. Aufl. 2022) — Kern**\n\n| Regel | Soll |\n|---|---|\n| Gemüse/Salat | täglich |\n| Obst | täglich |\n| Milchprodukt | täglich |\n| Vollkorn | ≥ 3×/Woche |\n| Hülsenfrüchte | ≥ 1×/Woche |\n| Seefisch | ≥ 1×/Woche |\n| Vegetarisch | ≥ 3×/Woche |\n| Rotes Fleisch | ≤ 1×/Woche |\n| Frittiert | vermeiden |\n| Süßspeise | ≤ 1×/Woche |\n\nMittagessen deckt bei Ganztagskita etwa **50 %** des Tagesbedarfs.\nKitchenOS → Mehr → DGE-Qualitätsstandard, Einrichtungstyp **Kita**.`,
    source: "DGE-Qualitätsstandard Kita-Verpflegung, 7. Auflage 2022",
  },
  {
    keywords: [
      "portion kita", "wie viel gramm kita", "ü3 gramm", "u3 gramm",
      "kantine portion erwachsene",
    ],
    answerShort: "Kita U3 150–200 g, Ü3 200–250 g. Kantine Erwachsene 350–450 g.",
    answerFull: `**Portionsgrößen (Richtwerte)**\n\n| Gruppe | Hauptgericht |\n|---|---|\n| Kita U3 (1–3 J.) | 150–200 g |\n| Kita Ü3 (3–6 J.) | 200–250 g |\n| Grundschule | 280–350 g |\n| Kantine Erwachsene | 350–450 g |\n| Suppe | 300–400 ml |\n| Dessert / Obst | 80–150 g |\n\nLieber nachnehmen lassen als überfüllen — besonders in der Kita.`,
    source: "DGE-Qualitätsstandards / Mensa-Richtwerte",
  },
  {
    keywords: [
      "kita allergen", "eltern allergen", "aushang kita", "notfall allergen",
    ],
    answerShort: "14 LMIV-Allergene schriftlich bereithalten. Bei Notfall: Notfallplan, nicht selbst experimentieren.",
    answerFull: `**Allergene in der Kita**\n\n- Die 14 LMIV-Allergene müssen **schriftlich** vorliegen (Aushang oder Karte)\n- Erzieher:innen brauchen die Info **vor** der Ausgabe, nicht erst auf Nachfrage der Eltern\n- Rezepturänderungen sofort nachziehen\n- Bei bekanntem Allergen: Gericht sperren oder Alternative — keine „ist nur ein bisschen“-Kompromisse\n- Notfall (Anaphylaxie): Notfallset laut Kita-Konzept, Rettungsdienst\n\nKitchenOS: Rezept → LMIV-Aushang drucken.`,
    source: "EU LMIV 1169/2011",
  },
  {
    keywords: [
      "eier kita", "rohes ei", "salmonellen kita", "tiramisu kita",
    ],
    answerShort: "Keine rohen Eier in der Kita — Salmonellen. Nur durcherhitzt.",
    answerFull: `**Eier in der Kita**\n\n- Kein Tiramisu, Zabaione, Mayonnaise aus Roh-Ei\n- Eier **durcherhitzen** (Omelett, gekocht, gebacken)\n- Hände und Flächen nach Kontakt reinigen\n- Kühlkette einhalten\n\nGilt analog für Mousse und Desserts mit unpasteurisiertem Ei.`,
    source: "LMHV / DGE Kita 2022",
  },
];


/**
 * Search offline knowledge for the best matching entry.
 * Scores by longest matching keyword so "kita kcal" beats a generic "kcal" hit.
 * Returns null when no keyword matches strongly enough.
 */
function normalizeQuery(question: string): string {
  return question
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
}

export function searchOffline(question: string): OfflineEntry | null {
  const q = question.toLowerCase();
  const qn = normalizeQuery(question);
  let best: { entry: OfflineEntry; score: number } | null = null;
  for (const entry of OFFLINE_KNOWLEDGE) {
    let score = 0;
    for (const kw of entry.keywords) {
      const k = kw.toLowerCase();
      const kn = normalizeQuery(kw);
      if (q.includes(k) || qn.includes(kn)) {
        score += k.length + (k.includes(" ") ? 6 : 0);
      }
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { entry, score };
    }
  }
  if (!best || best.score < 4) return null;
  return best.entry;
}

/**
 * Kitchen mutations and navigation should not be answered from the static
 * knowledge base — they need live state or the AI command parser.
 */
export function isKitchenCommand(question: string): boolean {
  return /\b(bestell\w*|nachbestell\w*|öffne|navigier\w*|stornier\w*|starte|lösch\w*|lege\s+an|addiere|buche\s+|zeig\s+mir\s+(die\s+)?(karte|lager|haccp)|geh\s+zu|go\s+to|open\s+|order\s+\d)\b/i.test(
    question,
  );
}

/**
 * Quick check: does an offline answer exist for this question?
 */
export function hasOfflineAnswer(question: string): boolean {
  return searchOffline(question) !== null;
}
