import type { Feather } from "@expo/vector-icons";

// ─────────────────────────────────────────────────────────────────────────────
// Gebrauchsanleitung — strukturierter Inhalt für /help
//
// Jeder Eintrag deckt eine App-Funktion mit:
//   what    — was die Funktion tut (1 Satz, "Elevator pitch")
//   when    — wann der Bediener sie verwendet (Anlass / Auslöser)
//   howTo   — 3–6 konkrete Schritte (Imperativ, kurz)
//   tips    — 1–3 praktische Tipps aus dem Küchenalltag
//   screen  — optionale Route, wird als "Öffnen"-Button angezeigt
//   related — optionale verwandte Topic-IDs (Cross-Reference)
//   keywords— Volltext-Suchbegriffe DE/EN, beide Sprachen
//
// Reihenfolge der Sektionen entspricht 1:1 dem reorganisierten Mehr-Menü.
// ─────────────────────────────────────────────────────────────────────────────

export type HelpSectionId =
  | "kiAssistent"
  | "dailyOps"
  | "kitchenProd"
  | "purchaseStock"
  | "guestsSales"
  | "complianceQuality"
  | "insightsReports"
  | "admin";

export interface HelpTopic {
  id: string;
  section: HelpSectionId;
  icon: React.ComponentProps<typeof Feather>["name"];
  title: string;
  what: string;
  when: string;
  howTo: string[];
  tips: string[];
  screen?: string;
  related?: string[];
  keywords: string;
}

export const HELP_SECTIONS: { id: HelpSectionId; titleKey: string }[] = [
  { id: "kiAssistent",       titleKey: "secKiAssistent" },
  { id: "dailyOps",          titleKey: "secDailyOps" },
  { id: "kitchenProd",       titleKey: "secKitchenProd" },
  { id: "purchaseStock",     titleKey: "secPurchaseStock" },
  { id: "guestsSales",       titleKey: "secGuestsSales" },
  { id: "complianceQuality", titleKey: "secComplianceQuality" },
  { id: "insightsReports",   titleKey: "secInsightsReports" },
  { id: "admin",             titleKey: "secAdmin" },
];

export const HELP_TOPICS: HelpTopic[] = [
  // ─── 0. Statistik (Tab — global, vor allen Mehr-Sektionen erreichbar) ────
  // Wird trotzdem in Sektion „Insights & Berichte" einsortiert, weil dort
  // mental verortet.
  {
    id: "stats",
    section: "insightsReports",
    icon: "trending-up",
    title: "Statistik (Tab)",
    what:
      "Live-Dashboard mit Tages-Umsatz, Top-Gerichten, Verschwendungs-Quote, Foodcost-Trend und Marge — der Schnell-Blick für die Geschäftsführung.",
    when:
      "Morgens als 'Wie war gestern?', mehrmals täglich um den Pulsschlag zu fühlen.",
    howTo: [
      "Tab 'Statistik' in der unteren Tab-Leiste oder 'Kios, Statistik'.",
      "Zeitraum-Selector oben (heute / Woche / Monat).",
      "Tap eine Kachel: Drill-Down in den entsprechenden Bericht.",
    ],
    tips: [
      "Wenn das Dashboard leer wirkt: erst Tagesabschluss machen, dann erscheinen die Werte.",
      "Top-Gericht-Liste hilft beim wöchentlichen Karten-Review — schwache Gerichte rotieren.",
    ],
    screen: "/(tabs)/stats",
    related: ["sales", "reports", "dishanalysis"],
    keywords: "statistik stats dashboard uebersicht overview kennzahlen kpi",
  },

  // ─── 1. KI-Assistent ──────────────────────────────────────────────────────
  {
    id: "kios",
    section: "kiAssistent",
    icon: "mic",
    title: "Kios — Sprach-Assistent",
    what:
      "Always-on Sprachassistent für freihändigen Betrieb am iPad. Sage 'Kios, wie viel Milch?' und du erhältst sofort Antwort und Navigation.",
    when:
      "Wenn deine Hände voll sind: bei der Vorbereitung, beim Service, beim Wareneingang oder am Pass.",
    howTo: [
      "Aktiviere Kios einmalig pro Sitzung: tippe auf das Mikrofon-Symbol über der Tab-Leiste.",
      "Sage 'Kios' + deine Frage oder Anweisung in einem Satz.",
      "Beispiele: 'Kios, mach den Tagesabschluss' · 'Kios, Rückstellprobe nehmen' · 'Kios, wie ist mein DGE-Score'.",
      "Kios spricht die Antwort vor und navigiert ggf. zum passenden Bildschirm.",
    ],
    tips: [
      "Kios kennt 38+ Bildschirme und reagiert auch auf umgangssprachliche Wendungen wie 'Was kochen wir morgen?'.",
      "Antworten kommen als Text + Sprachausgabe (ElevenLabs Premium-Stimme 'Sarah').",
      "Schnellbefehle (Tagesabschluss, Lager, Rezept …) umgehen die KI-Anfrage und reagieren in unter 200 ms.",
    ],
    related: ["chat", "scan"],
    keywords: "kios voice sprach assistant assistent mikrofon sprechen befehl wake word",
  },
  {
    id: "chat",
    section: "kiAssistent",
    icon: "message-circle",
    title: "KI-Chat",
    what:
      "Tippe komplexere Fragen oder Rezeptideen — die KI antwortet im Konversations-Stil und nutzt deine echten Küchen-Daten als Kontext.",
    when:
      "Wenn die Frage länger als ein Satz ist: Menü-Vorschläge, Rezeptanpassungen, Erklärungen, Reklamationen.",
    howTo: [
      "Öffne über Mehr → KI-Assistent → KI-Chat oder das Chat-Symbol auf der Startseite.",
      "Tippe deine Frage frei aus, Markdown wird gerendert (Listen, Tabellen, Code).",
      "Folgefragen halten den Kontext, du musst dich nicht wiederholen.",
    ],
    tips: [
      "Ideal für: 'Schreibe mir 5 Schul-Menüs unter 3 € Foodcost', 'Erkläre meinem Azubi den Unterschied DGE Schule vs. Kita'.",
      "Wenn du eine konkrete Aktion willst (z. B. Bestellung absenden), nutze besser Kios oder den jeweiligen Bildschirm.",
    ],
    screen: "/chat",
    related: ["kios"],
    keywords: "chat ki ai assistant fragen rezeptidee gespraech",
  },
  {
    id: "scan",
    section: "kiAssistent",
    icon: "camera",
    title: "Scannen",
    what:
      "Fotografiere ein Etikett, einen Barcode oder ein Produkt — die KI erkennt Artikel, Menge und Allergene und schlägt eine Inventur-Buchung vor.",
    when:
      "Bei Wareneingang ohne Lieferschein, beim Inventarisieren neuer Produkte, beim Erfassen von Spontankäufen.",
    howTo: [
      "Mehr → Scannen oder 'Kios, Scanner'.",
      "Halte das Etikett mittig im Sucher, Tap auf den Auslöser.",
      "Prüfe den KI-Vorschlag (Name, Einheit, Menge, Allergene), passe an, speichere.",
    ],
    tips: [
      "Flache, gerade Aufnahme bei guter Beleuchtung verdoppelt die Erkennungs-Genauigkeit.",
      "Mehrere Etiketten zusammen scannen geht — bestätige dann pro Position einzeln.",
    ],
    screen: "/scan",
    related: ["inventory", "orders"],
    keywords: "scan kamera foto etikett barcode erkennen ai vision",
  },

  // ─── 2. Tagesgeschäft ────────────────────────────────────────────────────
  {
    id: "sales",
    section: "dailyOps",
    icon: "check-square",
    title: "Tagesabschluss",
    what:
      "Pro Gericht: wieviele Portionen wurden gekocht und wieviele verkauft? Die Differenz fließt automatisch in Reste, Marge, Foodcost und Statistik.",
    when:
      "Direkt nach Service-Ende, bevor jemand den Posten verlässt — sonst gehen die Zahlen verloren.",
    howTo: [
      "Mehr → Tagesgeschäft → Tagesabschluss oder 'Kios, Tagesabschluss'.",
      "Pro heutiges Gericht: tippe gekocht und verkauft. Differenz = Rest.",
      "Speichern. Die Zahlen erscheinen sofort in Statistik, Marge und KI-Prognose.",
    ],
    tips: [
      "Aktiviere in Einstellungen das 'Erfassungsfenster' — danach können Zahlen nur noch erhöht werden, nicht reduziert. Verhindert Manipulation während des Service.",
      "Wenn dir eine Schätzung fehlt: nutze Tablett-Foto-Analyse, um Reste über die Kamera zu schätzen.",
    ],
    screen: "/sales",
    related: ["wastecam", "forecast"],
    keywords: "tagesabschluss verkauf portionen daily close eod cash report",
  },
  {
    id: "kasse",
    section: "dailyOps",
    icon: "credit-card",
    title: "Kasse / Rechnung (TSE)",
    what:
      "Voll-konforme Kasse mit fiskaly-TSE-Signatur, KassenSichV-konformen Bons, DSFinV-K-Export für die Betriebsprüfung. Nur in Full-Modus aktiv.",
    when:
      "Wenn du keine separate POS-Kasse hast und KitchenOS als rechtsverbindliche Registrierkasse nutzt.",
    howTo: [
      "Erst in Einstellungen → App-Modus auf 'Full' wechseln und fiskaly-TSE konfigurieren.",
      "Mehr → Tagesgeschäft → Kasse oder 'Kios, Kasse'.",
      "Gerichte tippen, Zahlart wählen, Bon drucken / mailen.",
      "Monatlich: DSFinV-K-Export für Steuerberater erzeugen.",
    ],
    tips: [
      "Im Lite-Modus ist die Kasse ausgeblendet — der Tagesabschluss reicht für reine Statistik.",
      "Wenn eine Rechnung storniert werden muss: TSE protokolliert das automatisch, kein manueller Eintrag nötig.",
    ],
    screen: "/kasse",
    related: ["zettle", "sales"],
    keywords: "kasse register tse kassensichv dsfinv fiskal bon rechnung receipt invoice",
  },
  {
    id: "zettle",
    section: "dailyOps",
    icon: "credit-card",
    title: "Zettle Kartenterminal",
    what:
      "Synchronisiert Verkäufe vom Zettle-Terminal in den Tagesabschluss — keine Doppelerfassung mehr.",
    when:
      "Wenn du Zettle als Kartenterminal einsetzt und Sales nicht händisch übertragen willst.",
    howTo: [
      "Einstellungen → Zahlungen → Zettle verbinden (OAuth).",
      "Mehr → Tagesgeschäft → Zettle, Tap 'Sync'.",
      "Geprüfte Zeilen werden in den Tagesabschluss übernommen.",
    ],
    tips: [
      "Nach Service immer zuerst Zettle syncen, dann Tagesabschluss — sonst musst du Bar-Verkäufe nachtragen.",
    ],
    screen: "/zettle",
    related: ["sales", "kasse"],
    keywords: "zettle terminal karten payment paypal sumup pos",
  },
  {
    id: "handover",
    section: "dailyOps",
    icon: "message-square",
    title: "Schichtübergabe",
    what:
      "Strukturierte Notiz von der ablösenden an die übernehmende Schicht: was zu tun ist, was schiefging, was bestellt werden muss.",
    when:
      "Am Ende jeder Schicht, vor dem Verlassen der Küche.",
    howTo: [
      "Mehr → Tagesgeschäft → Schichtübergabe.",
      "Wähle die Übernahme-Schicht, tippe die Punkte als Bullet List.",
      "Optional: Foto vom Pass / Kühlhaus anhängen.",
      "Senden — die nächste Schicht sieht sie auf der Startseite.",
    ],
    tips: [
      "KI kann den Text aus deinem Stichwort-Diktat formulieren — Tap auf Mikrofon.",
      "Verwende Vorlagen für Wiederkehrendes ('Salatkühlung Sensor 4 erneut prüfen').",
    ],
    screen: "/handover",
    related: ["dienstplan"],
    keywords: "schichtuebergabe handover shift handoff briefing",
  },
  {
    id: "dienstplan",
    section: "dailyOps",
    icon: "calendar",
    title: "Dienstplan",
    what:
      "Wochenweise Schichtplanung pro Mitarbeiter und Posten mit Auto-Vorschlag basierend auf Verfügbarkeit und Qualifikation.",
    when:
      "Sonntag oder Montag für die kommende Woche; bei Krankmeldungen sofort.",
    howTo: [
      "Mehr → Tagesgeschäft → Dienstplan.",
      "Kalenderwoche wählen, Drag & Drop oder 'KI-Vorschlag'.",
      "Veröffentlichen — alle bekommen eine Push-Benachrichtigung.",
    ],
    tips: [
      "Pflege Verfügbarkeit + Qualifikation in Team — der KI-Vorschlag wird dadurch genauer.",
      "Tap auf eine Schicht öffnet die Lohnkostenschätzung in Echtzeit.",
    ],
    screen: "/dienstplan",
    related: ["team", "leaderboard"],
    keywords: "dienstplan schichtplan personal staff schedule rota planung",
  },

  // ─── 3. Küche & Produktion ───────────────────────────────────────────────
  {
    id: "menu",
    section: "kitchenProd",
    icon: "book-open",
    title: "Wochenkarte (Menüplanung)",
    what:
      "Plane jeden Tag der Woche mit Drag & Drop von Rezepten. Zeigt live: DGE-Score, Foodcost, Allergene und KI-Prognose.",
    when:
      "Donnerstag/Freitag für die Folgewoche, jederzeit für spontane Anpassungen.",
    howTo: [
      "Tab 'Karte' oder 'Kios, Karte'.",
      "Tippe einen Tag, dann + → Rezept aus der Liste oder neu anlegen.",
      "Ziehe Rezepte zwischen Tagen, um Reste sinnvoll umzuverteilen.",
    ],
    tips: [
      "Wenn DGE aktiviert ist, siehst du in der Kopfzeile sofort den Wochen-Score und welche Kriterien fehlen.",
      "'KI-Generieren' füllt eine ganze Woche basierend auf Saison, Foodcost-Ziel und Allergie-Bedarf vor.",
    ],
    screen: "/(tabs)/menu",
    related: ["dge", "calculator", "forecast"],
    keywords: "menue wochenplan menu karte planung rezept",
  },
  {
    id: "production",
    section: "kitchenProd",
    icon: "clipboard",
    title: "Produktion & Rückstellproben",
    what:
      "Erfasse Produktions-Chargen (Wer, Was, Wann, Wieviel) und entnehme automatisch eine Rückstellprobe nach LMHV §11 (7 Tage Aufbewahrung).",
    when:
      "Bei jeder Charge größer als 'eine Pfanne', besonders Catering, Schule, Kita.",
    howTo: [
      "Mehr → Küche & Produktion → Produktion oder 'Kios, Produktion'.",
      "Charge anlegen: Rezept, Datum, Menge, Mitarbeiter:in.",
      "Rückstellprobe: tippe 'nehmen', Foto + Etikett anbringen — das System trägt automatisch retentionUntil = Datum + 7 Tage.",
    ],
    tips: [
      "Lege in Einstellungen einen Standard-Probenkühlschrank fest, dann werden Proben automatisch zugeordnet.",
      "Nach 7 Tagen markiert das System Proben automatisch als 'dürfen entsorgt werden' — kein händisches Mitzählen.",
      "Pflicht ab 50 Portionen pro Tag in Gemeinschaftsverpflegung — bei Verdacht auf Lebensmittelvergiftung sind sie der einzige Beweis.",
    ],
    screen: "/production",
    related: ["haccp", "dge"],
    keywords: "produktion rueckstellprobe sample charge batch lmhv haccp",
  },
  {
    id: "reste",
    section: "kitchenProd",
    icon: "refresh-ccw",
    title: "Reste-Rezepte",
    what:
      "Die KI schlägt aus deinen Übermengen 3–5 neue Gerichte vor — z. B. 'Aus 4 kg gekochten Kartoffeln: Rösti, Gratin, Suppe'.",
    when:
      "Wenn nach dem Tagesabschluss erkennbare Reste übrig sind, oder vor Wochenend-Schließtagen.",
    howTo: [
      "Mehr → Küche & Produktion → Reste-Rezepte.",
      "Top-Reste der letzten 3 Tage werden vorgeschlagen, Tap auf 'Ideen generieren'.",
      "Wähle ein Rezept → in die Wochenkarte ziehen oder direkt produzieren.",
    ],
    tips: [
      "Spart bis zu 8 % Foodcost in saisonalen Spitzenwochen.",
      "Filtere nach Allergenen, wenn die Zielgruppe Schule/Kita ist.",
    ],
    screen: "/reste",
    related: ["waste", "menu"],
    keywords: "reste leftover verwertung uebrig",
  },
  {
    id: "calculator",
    section: "kitchenProd",
    icon: "dollar-sign",
    title: "Preiskalkulation",
    what:
      "Berechnet Foodcost pro Portion, Wunschmarge, Verkaufspreis und MwSt — auch rückwärts: 'Welcher Foodcost erlaubt 35 % Marge bei 9,90 € VK?'.",
    when:
      "Vor Aufnahme eines neuen Gerichts in die Karte, bei Lieferantenwechsel, bei Preisanpassungen.",
    howTo: [
      "Mehr → Küche & Produktion → Preiskalkulation.",
      "Rezept wählen oder Zutaten manuell tippen.",
      "Wunsch-Marge oder Wunsch-VK eingeben — das andere wird berechnet.",
    ],
    tips: [
      "Preise aus dem Lager werden live verwendet — bei Lieferanten-Wechsel kalkuliert die App automatisch neu.",
      "Schwellwerte für Marge-Alerts setzt du in Einstellungen → Marge-Schwellen.",
    ],
    screen: "/calculator",
    related: ["margin", "menu"],
    keywords: "kalkulation preis foodcost marge calculator pricing",
  },

  // ─── 4. Einkauf & Lager ──────────────────────────────────────────────────
  {
    id: "inventory",
    section: "purchaseStock",
    icon: "package",
    title: "Lager (Bestand)",
    what:
      "Live-Übersicht aller Vorräte mit Mindestbestand, Verfallsdatum, Lieferanten-Zuordnung und Gefahrenmarkern.",
    when:
      "Täglich morgens 1× kurz prüfen, vor jeder Bestellung gründlich.",
    howTo: [
      "Tab 'Lager' oder 'Kios, Lager'.",
      "Sortiere nach 'kritisch zuerst' — rot markierte Artikel sind unter Mindestbestand.",
      "Tap auf einen Artikel: Bestandskorrektur, Foto, Lieferantenwechsel, Notiz.",
    ],
    tips: [
      "Setze Mindestbestand realistisch (1,5× durchschnittlicher Wochenverbrauch) — sonst wirst du von Auto-Bestellung überflutet.",
      "Verfallsdaten unter 3 Tagen erscheinen automatisch in Reste-Vorschlägen.",
    ],
    screen: "/(tabs)/inventory",
    related: ["procurement", "inventur", "reste"],
    keywords: "lager bestand vorrat inventory stock",
  },
  {
    id: "procurement",
    section: "purchaseStock",
    icon: "package",
    title: "Auto-Bestellung",
    what:
      "Die KI errechnet aus Verbrauch, Menüplan, Wetterprognose und Mindestbestand eine fertige Bestellung pro Lieferant.",
    when:
      "Mo / Mi / Fr morgens — oder wenn die Startseite einen kritischen Bestand meldet.",
    howTo: [
      "Mehr → Einkauf & Lager → Auto-Bestellung oder 'Kios, nachbestellen'.",
      "Pro Lieferant prüfen: Mengen anpassen, Position löschen, Notiz hinzufügen.",
      "'Senden' — Bestellung geht per E-Mail / WhatsApp / EDI an den Lieferanten.",
    ],
    tips: [
      "Die KI berücksichtigt Wetter (z. B. mehr Salat bei Sommer-Hitze) — die Genauigkeit steigt nach 4 Wochen Lerndaten.",
      "Pinne saisonale Sonderbestellungen (Erdbeeren im Juni) in Einstellungen → Bestell-Vorgaben.",
    ],
    screen: "/procurement",
    related: ["inventory", "suppliers", "forecast"],
    keywords: "bestellung procurement order auto nachbestellen",
  },
  {
    id: "orders",
    section: "purchaseStock",
    icon: "truck",
    title: "Wareneingang",
    what:
      "Lieferungen entgegennehmen, mit Bestellung abgleichen, Differenzen reklamieren — alles ohne Papier.",
    when:
      "Bei jeder Anlieferung — bevor der Fahrer geht.",
    howTo: [
      "Mehr → Einkauf & Lager → Wareneingang oder 'Kios, Wareneingang'.",
      "Bestellung wählen, Positionen abhaken, Differenzen tippen.",
      "Bei Mängel: Foto + Notiz — geht direkt als Reklamations-PDF an den Lieferanten.",
    ],
    tips: [
      "Lieferantenfehler werden automatisch in der Lieferanten-Bewertung addiert — rückwirkend transparent.",
      "Temperatur-Pflicht-Artikel (Frischfleisch, TK): tippe Temperatur ein, das Wert geht direkt ins HACCP-Protokoll.",
    ],
    screen: "/orders",
    related: ["suppliers", "haccp"],
    keywords: "wareneingang lieferung empfang receiving delivery",
  },
  {
    id: "inventur",
    section: "purchaseStock",
    icon: "clipboard",
    title: "Inventur",
    what:
      "Stichtag-Inventur mit Drill-Down nach Lagerort. Druckt anschließend einen unterschriftsfähigen Bestandsnachweis.",
    when:
      "Monatsende, Quartalsende, Jahreswechsel — pflicht für Bilanz.",
    howTo: [
      "Mehr → Einkauf & Lager → Inventur.",
      "Stichtag wählen, Lagerorte selektieren, Mitarbeiter:innen zuordnen.",
      "Pro Position: gezählter Wert eingeben oder per Sprache diktieren.",
      "Abweichungen prüfen, dann 'Abschließen' → PDF erzeugt.",
    ],
    tips: [
      "Mehrere Personen können parallel zählen — jede:r bekommt einen Bereich zugewiesen.",
      "Letzte Inventur als 'Vorlage' laden spart 70 % der Tippzeit.",
    ],
    screen: "/inventur",
    related: ["inventory", "reports"],
    keywords: "inventur bestandsaufnahme inventory stock count",
  },
  {
    id: "suppliers",
    section: "purchaseStock",
    icon: "users",
    title: "Lieferanten",
    what:
      "Stammdaten aller Lieferanten: Konditionen, Mindestbestellwert, Lieferzeiten, Bewertung aus Pünktlichkeit/Qualität/Reklamationen.",
    when:
      "Bei Aufnahme neuer Lieferanten, jährliche Konditions-Verhandlung, Reklamations-Audit.",
    howTo: [
      "Mehr → Einkauf & Lager → Lieferanten.",
      "Tap einen Lieferant: alle Bestellungen, Reklamationen, Pünktlichkeits-Score sichtbar.",
      "'Lieferanten finden' sucht regional via PLZ + Kategorie.",
    ],
    tips: [
      "Score unter 70 sollte ein Re-Tender-Trigger sein — die App schlägt ab 50 automatisch Alternativen vor.",
      "Pflege Mindestbestellwert genau, sonst springt die Auto-Bestellung auf den falschen Lieferanten.",
    ],
    screen: "/suppliers",
    related: ["procurement", "producers"],
    keywords: "lieferanten supplier wholesale grosshaendler",
  },
  {
    id: "producers",
    section: "purchaseStock",
    icon: "sunrise",
    title: "Regionale Erzeuger",
    what:
      "Direktverbindung zu Bauern und Höfen in deiner Region — kürzere Lieferketten, bessere Bio-/Regional-Quote für Öko-Score und DGE.",
    when:
      "Beim Aufbau eines Bio-Anteils, für Schul-/Kita-Verpflegung, für Marketing-Storytelling.",
    howTo: [
      "Mehr → Einkauf & Lager → Regionale Erzeuger.",
      "Erzeuger nach Entfernung / Kategorie / Saison filtern.",
      "Anfrage senden — Erzeuger antwortet im selben Chat.",
    ],
    tips: [
      "Erzeuger erscheinen automatisch als alternative Quelle in Auto-Bestellung wenn günstiger pro kg.",
      "Im Öko-Wizard zählen ihre Lieferungen 3× zur Regional-Quote.",
    ],
    screen: "/producers",
    related: ["okowizard", "dge"],
    keywords: "erzeuger producer bauer hof regional bio farm",
  },

  // ─── 5. Gäste & Verkauf ─────────────────────────────────────────────────
  {
    id: "preorder",
    section: "guestsSales",
    icon: "smartphone",
    title: "Vorbestellungen (App-Bestellung)",
    what:
      "Gäste bestellen über die KitchenOS-Vorbestell-App ihr Mittag — du siehst die Mengen pro Gericht spätestens 2 h vor Service.",
    when:
      "Wenn du Schule, Kita, Mensa oder Catering mit unsicheren Gästezahlen führst.",
    howTo: [
      "Mehr → Gäste & Verkauf → Vorbestellungen.",
      "Pro Tag siehst du: Gerichte × bestellte Portionen, Zahlart, Notizen.",
      "'Preorder schließen' 1 h vor Service hilft die Produktion zu fixieren.",
    ],
    tips: [
      "Hinterlege in Einstellungen Cutoff-Zeiten pro Gericht (z. B. 'Schnitzel nur bis 9:00').",
      "Push-Erinnerung an Stammgäste am Vorabend hebt die Vorbestellquote um typischerweise 35 %.",
    ],
    screen: "/preorder",
    related: ["customers", "forecast"],
    keywords: "vorbestellung preorder app bestellung",
  },
  {
    id: "customers",
    section: "guestsSales",
    icon: "user-check",
    title: "Geschäftskunden (B2B)",
    what:
      "Genehmige Firmen-Konten (Schulen, Pflegeheime, Büros) mit Rechnungs-Versand und Sammel-Vorbestellungen.",
    when:
      "Bei Anfrage neuer Firmen-Konten oder Monats-Abrechnungslauf.",
    howTo: [
      "Mehr → Gäste & Verkauf → Geschäftskunden.",
      "Pro Anfrage: Bonität prüfen, Konditionen festlegen, freigeben.",
      "Monatlich: 'Sammel-Rechnung erzeugen' pro Kunde.",
    ],
    tips: [
      "Kreditlimit + Zahlungsziel pflegen — sonst überschreiten Stammkunden das Limit unbemerkt.",
      "Im CRM siehst du Umsatzentwicklung pro Kunde inkl. Saisonalität.",
    ],
    screen: "/customers",
    related: ["crm", "kasse"],
    keywords: "kunden customer geschaeftskunden b2b firma",
  },
  {
    id: "crm",
    section: "guestsSales",
    icon: "book-open",
    title: "CRM",
    what:
      "Kundenpflege: Kontakthistorie, Anlässe (Geburtstag/Jubiläum), Lieblingsgerichte, manuelle Notizen.",
    when:
      "Vor jedem Verkaufsgespräch, vor jeder Catering-Anfrage, bei Reklamation.",
    howTo: [
      "Mehr → Gäste & Verkauf → CRM.",
      "Suche oder filtere nach Tag (z. B. 'Schule', 'Pflegeheim').",
      "Kontakt-Karte: alle E-Mails, Bestellungen, Veranstaltungen, Notizen chronologisch.",
    ],
    tips: [
      "Setze Wiedervorlagen für Cross-Sell ('3 Wochen nach Hochzeit: Geburtstagsangebot Ehepaar').",
      "Notiz-Felder pro Kontakt — halte hier Sonderwünsche, Allergien, Lieblingsweine fest.",
    ],
    screen: "/crm",
    related: ["customers", "catering"],
    keywords: "crm kunden kontakt pflege relationship",
  },
  {
    id: "catering",
    section: "guestsSales",
    icon: "mail",
    title: "Catering-Aufträge",
    what:
      "Kleine + mittlere Catering-Aufträge bis ~80 Personen: Anfrage → Angebot → Bestätigung → Produktion → Rechnung.",
    when:
      "Bei jeder Catering-Anfrage außerhalb des regulären Service.",
    howTo: [
      "Mehr → Gäste & Verkauf → Catering oder 'Kios, Catering'.",
      "Anfrage anlegen: Datum, Gäste, Wünsche, Allergene.",
      "Angebot generieren (KI schlägt Menü + Preis vor) → an Kunde mailen.",
      "Nach Bestätigung: Produktion + Lieferung + Rückstellprobe automatisch geplant.",
    ],
    tips: [
      "Mehrwertsteuer-Splitting (7 % vs. 19 %) automatisch nach Gerichtsart — manuell prüfen bei Mischauftrag.",
      "Aus 'Veranstaltungen' wechseln, sobald > 80 Personen oder mehrtägig.",
    ],
    screen: "/catering",
    related: ["events", "production"],
    keywords: "catering auftrag liefer event verpflegung",
  },
  {
    id: "events",
    section: "guestsSales",
    icon: "calendar",
    title: "Veranstaltungen",
    what:
      "Großevents (Hochzeit, Firmenfeier, Stadtfest): Multi-Tage-Planung, Mitarbeiter-Zuordnung, Logistik, Equipment-Liste.",
    when:
      "Bei Aufträgen über ~80 Personen oder mehrtägig oder mit Auf-/Abbau.",
    howTo: [
      "Mehr → Gäste & Verkauf → Veranstaltungen.",
      "Event anlegen: Datum, Gäste, Location, Menü.",
      "Tap das Event: Zeitplan (Anlieferung / Aufbau / Service / Abbau), Personal, Equipment.",
    ],
    tips: [
      "Status-Workflow 'Anfrage → Entwurf → Bestätigt → Erbracht → Bezahlt' — auf der Startseite siehst du heute/morgen anstehende.",
      "Demo-Daten haben 5 realistische Events für Onboarding-Training.",
    ],
    screen: "/events",
    related: ["catering", "dienstplan"],
    keywords: "veranstaltung event hochzeit jubilaeum firma",
  },

  // ─── 6. Qualität & Recht ─────────────────────────────────────────────────
  {
    id: "haccp",
    section: "complianceQuality",
    icon: "shield",
    title: "HACCP & BLE-Thermometer",
    what:
      "Tägliche Hygiene- und Temperaturprotokolle nach HACCP — manuell, oder vollautomatisch mit Bluetooth-Thermometern (Inkbird/Govee).",
    when:
      "Täglich morgens, abends und nach jedem kritischen Vorgang (Lieferung, Heißhalten, Abkühlung).",
    howTo: [
      "Mehr → Qualität & Recht → HACCP.",
      "Pro Sensor: Soll-Bereich definieren, Mess-Frequenz wählen.",
      "BLE-Thermometer in Einstellungen → Gerät pairen — Werte fließen automatisch.",
      "Bei Abweichung: System fragt Korrekturmaßnahme + dokumentiert mit Foto.",
    ],
    tips: [
      "Lebensmittelkontrolle akzeptiert PDF-Export aus 'Inspektions-Modus' — generiert auf Tap.",
      "Sensor-Batterien rechtzeitig wechseln — App warnt bei < 20 %.",
      "Manuelle Einträge sind weiterhin möglich, falls BLE ausfällt.",
    ],
    screen: "/haccp",
    related: ["cleaning", "production"],
    keywords: "haccp hygiene temperatur protokoll ble thermometer kontrolle",
  },
  {
    id: "dge",
    section: "complianceQuality",
    icon: "award",
    title: "DGE-Qualitätsstandard",
    what:
      "Automatische Compliance-Prüfung gegen einen der 4 DGE-Standards (Schule, Kita, Krankenhaus, Senioren) für deinen Wochenmenüplan — mit Score 0–100, Kriterien-Breakdown und PDF-Zertifikat.",
    when:
      "Bei öffentlichen Ausschreibungen (Schule, Kita, Klinik, Senioren), bei Re-Zertifizierungen, beim wöchentlichen Menü-Review.",
    howTo: [
      "Erst in Einstellungen → DGE-Standard den passenden auswählen (z. B. Schulverpflegung).",
      "Mehr → Qualität & Recht → DGE-Qualitätsstandard oder 'Kios, DGE'.",
      "Score sehen, fehlende Kriterien lesen, 'Empfehlungen' umsetzen (z. B. '1× Seefisch in dieser Woche').",
      "Bei Ausschreibung: 'Zertifikat erstellen (PDF)' — gibt einen unterschriftsfähigen Audit-Bogen.",
    ],
    tips: [
      "Live-Badge im Wochenkarte-Header zeigt sofort den aktuellen Score — grün ≥80, gelb 60–79, rot <60.",
      "Kein anderer Anbieter (Apicbase, Foodics, MarketMan, Choco) hat das — nutze es als USP in Pitches.",
      "Score basiert auf Klassifikation aus Rezeptnamen, Zutaten und Allergenen — pflege Zutatenlisten gut für höchste Genauigkeit.",
    ],
    screen: "/dge",
    related: ["menu", "production"],
    keywords: "dge qualitaetsstandard schule kita krankenhaus senioren score zertifikat",
  },
  {
    id: "cleaning",
    section: "complianceQuality",
    icon: "droplet",
    title: "Reinigungsplan",
    what:
      "Master-Reinigungsplan nach §4 LMHV: was wird wo wann von wem gereinigt + Foto-Nachweis.",
    when:
      "Täglich Routinereinigung, wöchentlich Tiefenreinigung, monatlich Fettabscheider — alles automatisch terminiert.",
    howTo: [
      "Mehr → Qualität & Recht → Reinigungsplan.",
      "Bereich + Frequenz wählen (Küche/Kühlung/Boden/Abluft … × täglich/wöchentlich).",
      "Beim Erledigen: Tap 'Erledigt' + optional Foto.",
      "Lebensmittelkontrolle: 'Inspektions-PDF' generieren.",
    ],
    tips: [
      "Foto-Pflicht für Tiefen-Reinigung aktivieren — schützt bei Verfahren.",
      "Wöchentliche Erinnerung an Verantwortliche per Push.",
    ],
    screen: "/cleaning",
    related: ["haccp"],
    keywords: "reinigung cleaning hygiene putz lmhv",
  },
  {
    id: "waste",
    section: "complianceQuality",
    icon: "trash-2",
    title: "Verschwendung erfassen",
    what:
      "Manuelle Erfassung von Lebensmittel-Abfall (Verfall, Falschproduktion, Reklamation) mit Wert in Euro.",
    when:
      "Bei jedem Wegwerf-Vorgang über ~500 g — sonst entgehen dir 70 % der Daten.",
    howTo: [
      "Mehr → Qualität & Recht → Verschwendung.",
      "Artikel + Menge + Grund (verfallen / verbrannt / reklamiert / sonstige) eintragen.",
      "Speichern — fließt in Foodcost und Reports.",
    ],
    tips: [
      "Tablett-Foto-Analyse erfasst Service-Reste viel schneller — nutze diese statt Hand-Eintrag wo möglich.",
      "Monatlich Top-3-Quellen prüfen → meist ein Lieferant oder Rezept identifizierbar.",
    ],
    screen: "/waste",
    related: ["wastecam", "reste"],
    keywords: "abfall waste verschwendung muell food",
  },
  {
    id: "wastecam",
    section: "complianceQuality",
    icon: "camera",
    title: "Tablett-Foto-Analyse",
    what:
      "Foto vom Tablett oder Teller → KI schätzt was übriggeblieben ist, aktualisiert Reste automatisch.",
    when:
      "Beim Abräumen am Pass — wenn händisches Zählen zu lange dauert.",
    howTo: [
      "Mehr → Qualität & Recht → Tablett-Foto oder 'Kios, Tablett-Foto'.",
      "Foto machen — KI erkennt Gerichte und schätzt Restmenge in %.",
      "Bestätigen oder korrigieren, speichern.",
    ],
    tips: [
      "Bei Schul-/Kita-Verpflegung wertvoll: durchschnittliche Restmenge pro Gericht zeigt was die Kinder nicht mögen.",
      "Foto direkt von oben mit gutem Licht → Erkennungsquote über 90 %.",
    ],
    screen: "/wastecam",
    related: ["waste", "sales"],
    keywords: "wastecam tablett foto teller plate restcam analyse ai",
  },

  // ─── 7. Insights & Berichte ──────────────────────────────────────────────
  {
    id: "forecast",
    section: "insightsReports",
    icon: "cpu",
    title: "KI-Bedarfsprognose",
    what:
      "Vorhersage der Portionen pro Gericht für die nächsten 7 Tage basierend auf Historie, Wetter, Schul-/Ferienkalender, Events.",
    when:
      "Vor jeder Auto-Bestellung, vor der Wochenkarten-Planung.",
    howTo: [
      "Mehr → Insights & Berichte → KI-Prognose oder 'Kios, Prognose'.",
      "Pro Tag siehst du erwartete Portionen mit Konfidenz-Intervall.",
      "Tap auf einen Tag: welche Faktoren den Wert beeinflussen (Wetter / Ferien / Event).",
    ],
    tips: [
      "Genauigkeit braucht 4 Wochen Lerndaten — bei Saisonwechsel kurz instabil.",
      "Wenn Vorhersage und Realität auseinanderlaufen: prüfe ob Sonderfaktoren (Streik, Feiertag) gepflegt sind.",
    ],
    screen: "/forecast",
    related: ["procurement", "menu"],
    keywords: "forecast prognose vorhersage demand bedarf ki",
  },
  {
    id: "margin",
    section: "insightsReports",
    icon: "trending-up",
    title: "Marge-Alerts",
    what:
      "Rote Liste aller Gerichte, deren Foodcost-Anteil über deinem Schwellwert liegt — typischerweise > 35 % Foodcost.",
    when:
      "Wöchentlich, bei Lieferantenwechsel, vor Karten-Update.",
    howTo: [
      "Mehr → Insights & Berichte → Marge-Alerts.",
      "Sortiere nach 'Verlust pro Portion'.",
      "Tap ein Gericht: Foodcost-Treiber + Vorschläge (Substitut / Preisanpassung / Streichen).",
    ],
    tips: [
      "Schwelle in Einstellungen pflegen — z. B. 30 % bei Vollservice, 25 % bei Schul-Verpflegung.",
      "Aktion 'Preis erhöhen um X%' wirft live die neue Marge aus.",
    ],
    screen: "/margin",
    related: ["calculator", "dishanalysis"],
    keywords: "marge margin gewinn verlust deckungsbeitrag",
  },
  {
    id: "leaderboard",
    section: "insightsReports",
    icon: "award",
    title: "Mitarbeiter-Bestenliste",
    what:
      "Spielerische Rangliste pro Mitarbeiter:in: Pünktlichkeit, Foodcost, HACCP-Disziplin, Reklamationen — wöchentlich.",
    when:
      "Im Team-Meeting, beim Schichtbeginn als Motivation.",
    howTo: [
      "Mehr → Insights & Berichte → Bestenliste.",
      "Filter nach Zeitraum / Posten / Filiale.",
      "Tap eine Person: Detail-Score + Coaching-Vorschläge.",
    ],
    tips: [
      "Score-Gewichtung in Einstellungen anpassen — manche Häuser gewichten Pünktlichkeit höher.",
      "Top-3 jeden Monat öffentlich würdigen — kostet nichts, wirkt enorm.",
    ],
    screen: "/leaderboard",
    related: ["dienstplan", "team"],
    keywords: "leaderboard rangliste mitarbeiter beste top performance",
  },
  {
    id: "reports",
    section: "insightsReports",
    icon: "pie-chart",
    title: "Berichte",
    what:
      "Zusammenfassende Reports (Tag/Woche/Monat) mit Umsatz, Foodcost, Marge, Top-Gerichten, Verschwendung — als PDF exportierbar.",
    when:
      "Monatsende für Geschäftsführung, vor Bankgesprächen, bei Ausschreibungen.",
    howTo: [
      "Mehr → Insights & Berichte → Berichte.",
      "Zeitraum wählen, Sektionen aktivieren, 'PDF erzeugen'.",
    ],
    tips: [
      "Vorlage 'Bank-Report' enthält alle Kennzahlen die für Kreditverhandlung relevant sind.",
      "Vorlage 'Ausschreibung' enthält DGE-Score, Bio-Quote, Allergen-Statistik.",
    ],
    screen: "/reports",
    related: ["dge", "okowizard", "aggregate"],
    keywords: "berichte report monatsbericht wochenbericht pdf",
  },
  {
    id: "dishanalysis",
    section: "insightsReports",
    icon: "bar-chart",
    title: "Gericht-Analyse",
    what:
      "Pro Gericht: Score 0–100 aus Verkaufsmenge, Marge, Reklamationen, Saisonalität — sagt dir was bleibt, was rausfliegt, was teurer wird.",
    when:
      "Vor jedem Karten-Update (typisch quartalsweise).",
    howTo: [
      "Mehr → Insights & Berichte → Gericht-Analyse.",
      "Sortiere nach Score absteigend.",
      "Tap ein Gericht: vollständiger Lebenszyklus (Verkauf-Trend, Margin-Trend, Reklamations-Trend).",
    ],
    tips: [
      "Gerichte unter Score 40 sind starke Streich-Kandidaten.",
      "Score über 80 + niedriger Foodcost = Cash-Cow → mehr bewerben.",
    ],
    screen: "/dishanalysis",
    related: ["margin", "menu"],
    keywords: "gericht analyse dish analysis bcg matrix score",
  },
  {
    id: "okowizard",
    section: "insightsReports",
    icon: "zap",
    title: "Öko-Wizard",
    what:
      "Tägliche Nachhaltigkeitsaufgaben mit CO2-Score, Bio-Anteil, Regional-Quote — gamifiziert mit Medaillen.",
    when:
      "Wenn Nachhaltigkeit ein Verkaufsargument ist (Schule, Kita, Bio-Catering, Eco-Audit).",
    howTo: [
      "Erst in Einstellungen → Öko-Wizard aktivieren.",
      "Mehr → Insights & Berichte → Öko-Wizard.",
      "Tägliche Aufgaben abarbeiten, Medaillen sammeln.",
    ],
    tips: [
      "Verknüpfung mit Erzeugern erhöht den Regional-Score automatisch.",
      "Quartalsweise CO2-Report als Anhang an deinen Sustainability-Bericht.",
    ],
    screen: "/okowizard",
    related: ["producers", "dge"],
    keywords: "oeko wizard nachhaltigkeit bio regional co2 klima",
  },
  {
    id: "aggregate",
    section: "insightsReports",
    icon: "layers",
    title: "Tagesübersicht",
    what:
      "Pro Filiale, pro Tag: Umsatz, Portionen, Foodcost, Verschwendung — alles auf einem Bildschirm.",
    when:
      "Morgens als 'Wie war gestern?', abends als 'Wie lief heute?'.",
    howTo: [
      "Mehr → Insights & Berichte → Tagesübersicht.",
      "Tag wählen, Filiale wählen.",
      "Drill-Down auf Gericht / Mitarbeiter / Stunde.",
    ],
    tips: [
      "Bei Multi-Standort: nutze Standortvergleich für synchrone Sicht.",
    ],
    screen: "/aggregate",
    related: ["rollup", "reports"],
    keywords: "aggregate tagesuebersicht daily summary aggregate",
  },
  {
    id: "rollup",
    section: "insightsReports",
    icon: "bar-chart-2",
    title: "Standortvergleich",
    what:
      "Side-by-Side aller Filialen: welche performt am besten? Welche braucht Coaching?",
    when:
      "Wöchentliches Multi-Standort-Meeting, bei neuer Filiale (Vergleich Hochlauf-Phase).",
    howTo: [
      "Mehr → Insights & Berichte → Standortvergleich.",
      "Kennzahl wählen (Umsatz, Foodcost, Marge, Reklamation).",
      "Zeitraum wählen, Standorte filtern.",
    ],
    tips: [
      "Best-Practice der Top-Filiale als Template auf andere übertragen — die App zeigt Diff.",
    ],
    screen: "/rollup",
    related: ["aggregate", "leaderboard"],
    keywords: "rollup standorte filialen vergleich multi location",
  },
  {
    id: "priceserver",
    section: "insightsReports",
    icon: "tag",
    title: "Preisserver",
    what:
      "Zentral gepflegte Verkaufspreise, die an alle Filialen synchron ausgespielt werden — kein Excel-Chaos mehr.",
    when:
      "Bei Karten-Update, Mehrwertsteuer-Änderung, Inflations-Anpassung.",
    howTo: [
      "Mehr → Insights & Berichte → Preisserver.",
      "Preis ändern → Wirksamkeitsdatum wählen → an Filialen ausspielen.",
    ],
    tips: [
      "Vorausplanung 2 Wochen vor Wirksamkeit gibt Filialen Zeit für Schilder-Druck.",
      "Audit-Log zeigt jede Änderung mit Mitarbeiter:in + Zeitstempel.",
    ],
    screen: "/priceserver",
    related: ["calculator", "rollup"],
    keywords: "preisserver price server vk verkaufspreis preis",
  },

  // ─── 8. Administration ──────────────────────────────────────────────────
  {
    id: "team",
    section: "admin",
    icon: "users",
    title: "Team",
    what:
      "Mitarbeiter:innen-Stammdaten: Qualifikation, Verfügbarkeit, Allergie-Schein, Hygiene-Schulung mit Ablaufdatum.",
    when:
      "Bei Onboarding, jährlich Schulungs-Update, vor Dienstplan-Wochen.",
    howTo: [
      "Mehr → Administration → Team.",
      "Person anlegen: Stammdaten, Foto, Qualifikationen.",
      "Schulungs-Dokument hochladen mit Gültigkeit-bis-Datum.",
    ],
    tips: [
      "Push-Erinnerung 30 Tage vor Schulungsablauf — keine Strafzahlungen mehr.",
      "Gehaltsband pro Qualifikation hinterlegen → Dienstplan rechnet Lohnkosten live.",
    ],
    screen: "/team",
    related: ["dienstplan", "leaderboard"],
    keywords: "team mitarbeiter personal hr",
  },
  {
    id: "locations",
    section: "admin",
    icon: "map-pin",
    title: "Filialen",
    what:
      "Alle Standorte mit Adresse, Öffnungszeiten, Sitzplätzen, Standard-Lieferanten, eigenen Preisen (überschreibbar).",
    when:
      "Bei Filial-Eröffnung, Adress-Änderung, Übernahme.",
    howTo: [
      "Mehr → Administration → Filialen.",
      "Filiale anlegen → Stammdaten + Lieferanten-Zuordnung.",
      "Bestehende: Tap zur Bearbeitung.",
    ],
    tips: [
      "Filialen-spezifische Preise überschreiben den Preisserver gezielt — nutze sparsam.",
    ],
    screen: "/locations",
    related: ["rollup", "priceserver"],
    keywords: "locations filialen standorte multi site",
  },
  {
    id: "aushang",
    section: "admin",
    icon: "printer",
    title: "LMIV-Aushang pro Gericht",
    what:
      "Pro Gericht ein Print-fertiger Aushang mit allen LMIV-Pflichtangaben (Allergene, Zusatzstoffe, Nährwerte) — direkt aus dem Rezept generiert.",
    when:
      "Beim Aufnehmen eines neuen Gerichts in die Karte, bei Eltern-Information (Schule/Kita), bei Catering-Anlass.",
    howTo: [
      "Karte oder Wochenplan öffnen, Gericht antippen.",
      "Im Rezept-Detail: 'LMIV-Aushang' wählen.",
      "Vorschau prüfen, drucken oder als PDF teilen.",
    ],
    tips: [
      "Allergene werden aus den Rezept-Zutaten gezogen — pflege sie sauber, sonst entstehen Lücken auf dem Aushang.",
      "Für die ganze Woche: nutze die Print-Funktion direkt im Wochenplan — generiert alle aktuellen Aushänge in einem Durchgang.",
    ],
    related: ["menu", "haccp"],
    keywords: "aushang lmiv allergen ausdruck poster gericht",
  },
  {
    id: "settings",
    section: "admin",
    icon: "settings",
    title: "Einstellungen",
    what:
      "Alle Konfigurationen: App-Modus, Abo-Tarif, Sprache, Marge-Schwellen, DGE-Standard, Demo-Daten, BLE-Geräte, Zahlungs-Anbieter, Erfassungsfenster.",
    when:
      "Initial beim Onboarding, danach bei jeder organisatorischen Änderung.",
    howTo: [
      "Mehr → Administration → Einstellungen oder 'Kios, Einstellungen'.",
      "Sektionen sind nach Häufigkeit sortiert (oft genutzt oben).",
    ],
    tips: [
      "'Demo-Daten laden' befüllt eine leere Installation mit 5 realistischen Events + 1 Firmenprofil — perfekt für Onboarding-Schulung.",
      "Bei Wechsel von Lite → Full: TSE-Setup vorab mit Steuerberater abstimmen.",
    ],
    screen: "/settings",
    related: ["team"],
    keywords: "einstellungen settings konfiguration optionen",
  },
];
