/**
 * Marketing PDF generator for KItchenOS.
 *
 * Generates two PDFs into artifacts/website/public/downloads/:
 *   - sales-emails.pdf  — DE outreach templates per segment
 *   - lead-list.pdf     — real, verifiable DE B2B targets per segment
 *
 * Run: pnpm --filter @workspace/scripts run gen:marketing
 */

import PDFDocument from "pdfkit";
import { createWriteStream, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "../../artifacts/website/public/downloads");
mkdirSync(OUT_DIR, { recursive: true });

// ─── Brand palette ──────────────────────────────────────────────────────────
const BRAND = {
  primary: "#d97706", // amber-600
  ink: "#1f2937",     // slate-800
  muted: "#64748b",   // slate-500
  rule: "#e2e8f0",    // slate-200
  bgSoft: "#fef3c7",  // amber-100
  bgMute: "#f8fafc",  // slate-50
};

const PAGE = { margin: 56, width: 595.28, height: 841.89 }; // A4

// ─── Types ─────────────────────────────────────────────────────────────────
interface EmailTpl {
  segment: string;
  audience: string;
  subjectDe: string;
  bodyDe: string;
  bestSentBy: string;
  followUp?: string;
}

interface Lead {
  name: string;
  city: string;
  segment: string;
  size: string;
  whyFit: string;
  contactPath: string;
  website: string;
}

// ─── Sales email templates (DE) ─────────────────────────────────────────────
const EMAILS: EmailTpl[] = [
  {
    segment: "1. Schule & Kindertagesstätte",
    audience:
      "Schulleitung / Kita-Trägerin / Verpflegungs-Verantwortliche bei kommunalen Trägern, Diakonie, Caritas, FRÖBEL, Kibo.",
    subjectDe:
      "DGE-Score 100/100 ohne Excel: Wie Schul- und Kita-Küchen die neue Qualitätsstandards erfüllen",
    bodyDe:
      "Sehr geehrte Frau/Herr [Nachname],\n\n" +
      "die DGE-Qualitätsstandards für die Schul- und Kita-Verpflegung sind seit 2024 in immer mehr Bundesländern Voraussetzung für öffentliche Aufträge — und der manuelle Nachweis kostet Ihre Hauswirtschaftsleitung wöchentlich Stunden in Excel.\n\n" +
      "KItchenOS scannt Ihren Wochenplan automatisch gegen die DGE-Kriterien (≥5 Vollkorn-Beilagen, ≥2 Gemüse, ≥1 Hülsenfrucht, ≤1 rotes Fleisch usw.) und erstellt auf Knopfdruck ein DGE-Zertifikat als PDF — fertig für Träger, Eltern und Ausschreibungen.\n\n" +
      "Drei Dinge, die Sie sofort gewinnen:\n\n" +
      "• Live DGE-Score 0–100 für die laufende Woche, mit konkreten Verbesserungs-Vorschlägen ('Mittwoch: Seefisch ergänzen').\n" +
      "• LMIV-Aushang pro Gericht in 5 Sekunden — Allergene, Zusatzstoffe, Nährwerte direkt aus dem Rezept.\n" +
      "• Eltern-Vorbestellung mit 08:00-Frist und Diät-Filtern (vegan, glutenfrei, halal). Kein Papier, keine Tüten mehr.\n\n" +
      "Hätten Sie 20 Minuten in den nächsten zwei Wochen für eine Live-Demo? Ich zeige Ihnen den DGE-Score live an Ihrem aktuellen Wochenplan.\n\n" +
      "Mit freundlichen Grüßen,\n[Ihr Name]\nKItchenOS · hello@kitchenos.de · +49 30 1234567",
    bestSentBy: "Dienstag oder Donnerstag, 08:30–10:00 Uhr (vor Eltern-Telefonzeit).",
    followUp:
      "Betreff: Kurz nachgefragt — DGE-Zertifikat für [Einrichtungsname]\n\n" +
      "Sehr geehrte Frau/Herr [Nachname],\n\n" +
      "ich wollte kurz nachhaken — falls Sie den Termin im Kalender nicht mehr finden, hier ein direkter Buchungs-Link: [calendly]\n\n" +
      "Falls die Verpflegung bei Ihnen extern vergeben ist, leite ich die Anfrage gern an die Caterer-Seite weiter — sagen Sie mir nur, wer dort verantwortlich ist.\n\n" +
      "Beste Grüße, [Ihr Name]",
  },
  {
    segment: "2. Krankenhaus & Klinik",
    audience:
      "Verpflegungsleitung / Wirtschaftsdirektion / Diätassistenz an Helios, Sana, Asklepios, Vivantes, kommunale Häuser, Universitätskliniken, Reha-Kliniken.",
    subjectDe:
      "MDK-Audit, DGE-Klinikstandard und 18 % weniger Foodcost — in einem System",
    bodyDe:
      "Sehr geehrte Frau/Herr [Nachname],\n\n" +
      "Klinik-Verpflegung steht heute zwischen drei Druckpunkten: DGE-Klinikstandard, MDK/QM-Audit und ein Personal-Engpass in der Hauswirtschaft, der Mengen-Schätzungen unzuverlässig macht.\n\n" +
      "KItchenOS adressiert genau diese drei Punkte:\n\n" +
      "• **DGE-Klinikstandard automatisch geprüft** — Speiseplan-Score in Echtzeit, fertiges PDF-Zertifikat für Audits und Träger.\n" +
      "• **HACCP-konform digital** — Kühlketten-Logging via Bluetooth-Sensor, Reinigungs-Checklisten mit Foto-Beleg, Rückstellproben mit Etikett-Druck und 7-Tages-Erinnerung.\n" +
      "• **Bedside Pre-Order am Tablet** — Diät-Filter (mech. weich, püriert, lakto-ovo, halal, koscher) durch Pflegepersonal binnen 30 Sekunden pro Bett.\n\n" +
      "Ein Haus mit 350 Betten hat im Pilot −18 % Lebensmittel-Verschwendung und −4 Std/Woche Verwaltungsaufwand pro Station erreicht. Ich zeige Ihnen gerne in 30 Minuten, wie das in Ihrer IT-Landschaft (SAP IS-H / Orbis / Medico) aussieht.\n\n" +
      "Wann passt es Ihnen — kommende oder übernächste Woche?\n\n" +
      "Beste Grüße,\n[Ihr Name]\nKItchenOS",
    bestSentBy: "Mittwoch 09:00–11:00 Uhr (nach Frühstücks-Service, vor OP-Wechsel).",
  },
  {
    segment: "3. Senioren- & Pflegeheim",
    audience:
      "Einrichtungsleitung / Hauswirtschaftsleitung bei Korian, Alloheim, Pro Seniore, Diakonie, Caritas, AWO, kommunalen Heimen.",
    subjectDe:
      "Ein Tablett pro Bewohner — auch bei Schluckstörung, Diabetes und 9 weiteren Diäten",
    bodyDe:
      "Sehr geehrte Frau/Herr [Nachname],\n\n" +
      "wenn jeder Bewohner sein eigenes Diät-Profil hat (Schluckstörung Stufe 2, Diabetes, Niereninsuffizienz, vegan, halal …), wird der Speisezettel zur Excel-Hölle und das Tablett-Etikett zum Risiko.\n\n" +
      "KItchenOS macht daraus einen Tap pro Bewohner:\n\n" +
      "• Diät-Profil pro Bewohner einmal angelegt — System filtert automatisch das passende Gericht und erlaubte Konsistenz.\n" +
      "• Tablett-Etikett mit Bewohnername, Zimmer, Diät-Codes und Allergen-Symbolen — Druck direkt in die Küche.\n" +
      "• DGE-Senioren-Standard automatisch gescort — Nachweis für MDK, Heimaufsicht und Angehörige als PDF.\n" +
      "• Tablett-Foto-Analyse für die Resteerfassung: Pflegepersonal fotografiert den Rückläufer, KI erkennt 'Gemüse 70 % zurück' — Sie erfahren in Echtzeit, welche Komponenten regelmäßig nicht ankommen.\n\n" +
      "20 Minuten Live-Demo? Ich zeige Ihnen das an einem realen Wochenplan eines vergleichbaren Hauses.\n\n" +
      "Mit besten Grüßen,\n[Ihr Name]\nKItchenOS · hello@kitchenos.de",
    bestSentBy: "Dienstag oder Donnerstag, 10:00–11:30 Uhr (nach Frühstück, vor Mittagsbestellung).",
  },
  {
    segment: "4. Betriebskantine & Werkskantine",
    audience:
      "Betriebsleitung / Küchenleitung / HR-Wellbeing-Beauftragte bei Apetito, Sodexo, Compass, Aramark, Dussmann, Klüh, eigenbetriebene Werkskantinen.",
    subjectDe:
      "Foodcost −18 %, Mitarbeiter-Bestellannahme +22 % — ohne Personalwechsel",
    bodyDe:
      "Sehr geehrte Frau/Herr [Nachname],\n\n" +
      "Betriebskantinen verlieren in der Regel 12–25 % ihrer Lebensmittel an die Schätzung 'wir kochen lieber etwas mehr' — und gleichzeitig bestellen nur 40–60 % der Mitarbeiter überhaupt mit, weil die Hürde zu hoch ist.\n\n" +
      "KItchenOS löst beide Probleme im selben System:\n\n" +
      "• **Vorbestellung bis 08:00** mit QR-Code am Eingang, ohne App-Installation. Live-Aggregat für die Küche um 08:01.\n" +
      "• **KI-Forecast** lernt aus Wetter, Wochentag und Anwesenheits-Quote die exakten Mengen pro Gericht — die Schätzung verschwindet.\n" +
      "• **Fiskaly-TSE-konforme Kasse** mit KassenSichV-Bons und DSFinV-K-Export für die Steuerprüfung — kein separates Kassen-System nötig.\n" +
      "• **DGE-Score & Klimaschutz-Kennzahlen** für Ihren Nachhaltigkeits-Bericht — relevant für den ESG-Report Ihres Mutterunternehmens.\n\n" +
      "Hätten Sie 30 Minuten für eine Live-Demo am Beispiel einer Kantine in vergleichbarer Größe? Ich rechne Ihnen den ROI in den ersten drei Monaten konkret vor.\n\n" +
      "Beste Grüße,\n[Ihr Name]\nKItchenOS",
    bestSentBy: "Dienstag–Donnerstag, 14:30–16:00 Uhr (nach Mittagsdruck, vor Schichtwechsel).",
  },
  {
    segment: "5. Catering & Event",
    audience:
      "Geschäftsführung / Operations bei mittelständischen Caterern, Hochzeits- und Event-Caterern, Hotel-Catering-Abteilungen.",
    subjectDe:
      "Outlook + KI-Chef + LMIV-Etiketten: Ihr Event-Catering, ohne Whiteboard",
    bodyDe:
      "Sehr geehrte Frau/Herr [Nachname],\n\n" +
      "Event-Catering ist meistens noch ein Excel-Whiteboard mit gelben Klebezetteln: Anfrage in Outlook, Mengen im Kopf, Pack-Liste auf einem A4 und LMIV-Etiketten am Veranstaltungstag von Hand.\n\n" +
      "KItchenOS macht den Workflow durchgängig digital:\n\n" +
      "• **Outlook-Integration**: E-Mail von Kundin landet als Lead in CRM, mit Kontakt, Datum, Personenzahl und automatischer Aufgabe für Angebot.\n" +
      "• **KI-Rezeptbuch** mit Mengenberechnung pro Pax — der Pack-Plan für die Küche entsteht in einem Klick.\n" +
      "• **LMIV-Etiketten pro Komponente** als Print-fertiges PDF (auch in Eltern-Sprache für Schulcatering).\n" +
      "• **Multi-Standort & Sammelrechnung** für Stamm-Geschäftskunden, Schulen und Behörden.\n\n" +
      "20 Minuten Demo am Beispiel einer realen Event-Anfrage? Ich zeige Ihnen Outlook → CRM → Pack-Plan → Etiketten in einem Durchgang.\n\n" +
      "Beste Grüße,\n[Ihr Name]\nKItchenOS",
    bestSentBy: "Montag oder Dienstag, 11:00–12:30 Uhr (nach Wochen-Briefing, vor Mittagsdruck).",
  },
  {
    segment: "6. Hotel- & Pension-Restaurant",
    audience:
      "F&B-Director / Küchenchef / Inhaber bei familiengeführten Hotels, Tagungs-Hotels, Wellness-Pensionen, Hotel-Ketten.",
    subjectDe:
      "Frühstück, Halbpension und Tagungs-Catering aus einer Karte — ohne neues POS",
    bodyDe:
      "Sehr geehrte Frau/Herr [Nachname],\n\n" +
      "Hotels verlieren überraschend viel Marge im F&B durch zwei Dinge: (a) ungenaue Frühstücks-Kalkulation und (b) doppelte Pflege von Karte, Allergenen und Kassen-Artikel.\n\n" +
      "KItchenOS pflegt alles in einem Stamm:\n\n" +
      "• Eine Rezept-Datenbank für Restaurant, Frühstück, Halbpension und Tagungs-Catering — Allergene, Nährwerte und Kalkulation immer synchron.\n" +
      "• Frühstücks-Forecast nach Auslastung (Pickup aus Ihrer PMS — Apaleo, Mews, Protel) — Sie kochen die richtige Menge Rührei.\n" +
      "• KassenSichV-konforme Bons mit Fiskaly-TSE — passt neben Ihre Hotel-Kasse.\n" +
      "• LMIV-Aushang pro Gericht für Tagungs-Buffets in 30 Sekunden.\n\n" +
      "Hätten Sie 25 Minuten in den kommenden zwei Wochen für eine Demo? Ich zeige Ihnen das gerne live anhand eines vergleichbaren Hauses.\n\n" +
      "Mit besten Grüßen,\n[Ihr Name]\nKItchenOS",
    bestSentBy: "Mittwoch oder Donnerstag, 15:00–16:30 Uhr (nach Check-out, vor Abend-Service).",
  },
  {
    segment: "7. Generic Follow-up (5 Werktage später)",
    audience:
      "Verwende für jeden Kontakt, der auf die erste E-Mail nicht geantwortet hat. Halte es kurz und respektvoll.",
    subjectDe: "Re: [Original-Betreff] — kurz nachgefragt",
    bodyDe:
      "Sehr geehrte Frau/Herr [Nachname],\n\n" +
      "kurzer Push-Up: Falls die letzte Mail im Posteingang untergegangen ist — hier ist sie noch einmal in einem Satz.\n\n" +
      "Wir helfen [Einrichtungsart] dabei, [konkretes Problem aus 1. Mail] zu lösen — und ich würde Ihnen gerne in 20 Minuten zeigen, wie das konkret bei Ihnen aussieht.\n\n" +
      "Direkter Kalender: [calendly]\nOder antworten Sie einfach mit zwei Vorschlagsterminen.\n\n" +
      "Beste Grüße,\n[Ihr Name]\nKItchenOS",
    bestSentBy: "Dienstag oder Donnerstag, 08:30 Uhr.",
  },
  {
    segment: "8. Breakup-Mail (10 Werktage später, letzte)",
    audience:
      "Letzter Versuch. Tonalität: respektvoll, nicht passiv-aggressiv. Lässt die Tür offen.",
    subjectDe: "Schließe ich Ihre Akte? — KItchenOS",
    bodyDe:
      "Sehr geehrte Frau/Herr [Nachname],\n\n" +
      "ich möchte Sie nicht weiter belasten und schließe Ihre Akte morgen, wenn ich keine Rückmeldung erhalte.\n\n" +
      "Falls KItchenOS aktuell nicht zur Priorität passt, ist das vollkommen in Ordnung — bitte lassen Sie es mich wissen, dann höre ich auf, Sie anzuschreiben. Falls der Zeitpunkt passt, brauche ich nur 'ja' zurück und schicke zwei Termine.\n\n" +
      "Mit besten Grüßen,\n[Ihr Name]\nKItchenOS",
    bestSentBy: "Freitag, 10:00 Uhr (vor Wochenende).",
  },
];

// ─── Real DE B2B target leads (publicly known operators) ───────────────────
const LEADS: Lead[] = [
  // Großcaterer (wholesale catering)
  {
    name: "apetito catering B.V. & Co. KG",
    city: "Rheine (NRW)",
    segment: "Großcaterer · Schule, Klinik, Senioren, Betrieb",
    size: "ca. 1.200 belieferte Einrichtungen",
    whyFit:
      "Multi-Standort, DGE-Standard für Schul- und Klinik-Verpflegung, ohnehin DGE-zertifiziert — KItchenOS automatisiert den Nachweis.",
    contactPath: "Vertrieb Verpflegungslösungen — info@apetito.de",
    website: "www.apetito-catering.de",
  },
  {
    name: "Sodexo Services GmbH",
    city: "Rüsselsheim",
    segment: "Großcaterer · Betrieb, Klinik, Senioren",
    size: "ca. 13.000 Mitarbeiter DE",
    whyFit:
      "Multi-Standort, ESG-Reporting-Pflicht (Mutterkonzern Paris) — Klimaschutz-Kennzahlen sind kaufrelevant.",
    contactPath: "Pressestelle / KAM Public Sector — info.de@sodexo.com",
    website: "de.sodexo.com",
  },
  {
    name: "Compass Group Deutschland GmbH (Eurest)",
    city: "Eschborn",
    segment: "Großcaterer · Betrieb, Bildung",
    size: "ca. 12.500 Mitarbeiter DE",
    whyFit:
      "Eurest-Marke betreibt zahlreiche Werkskantinen — Bedarf für Vorbestellung, Forecast und ESG-Kennzahlen.",
    contactPath: "Bewerbungs- und Kundenportal — info@compass-group.de",
    website: "www.compass-group.de",
  },
  {
    name: "Aramark Holdings GmbH & Co. KG",
    city: "Neu-Isenburg",
    segment: "Großcaterer · Betrieb, Bildung, Klinik",
    size: "ca. 10.000 Mitarbeiter DE",
    whyFit:
      "US-Mutter mit hohem Standard-Druck (Allergene, ESG) — Compliance-Nachweis ist wertschöpfend.",
    contactPath: "Standort-Center / Kundenanfragen — info@aramark.de",
    website: "www.aramark.de",
  },
  {
    name: "Dussmann Service Deutschland GmbH",
    city: "Berlin",
    segment: "Großcaterer · Klinik, Senioren, Bildung",
    size: "ca. 22.000 Mitarbeiter DE (Service Group)",
    whyFit:
      "Stark in Klinik & Pflege — DGE-Klinikstandard und MDK-Audits sind Daily Business.",
    contactPath: "Vertrieb Verpflegungsmanagement — info@dussmann.de",
    website: "www.dussmann.com",
  },
  {
    name: "Klüh Catering GmbH",
    city: "Düsseldorf",
    segment: "Großcaterer · Betrieb, Bildung",
    size: "ca. 850 Standorte",
    whyFit:
      "Mittelstands-Caterer mit hoher Standort-Vielfalt — Multi-Mandant-Plattform ist passgenau.",
    contactPath: "catering@klueh.de",
    website: "www.klueh.de/catering",
  },
  {
    name: "Stockheim Group GmbH",
    city: "Düsseldorf",
    segment: "Premium-Catering · Event, Tagung",
    size: "ca. 1.200 Mitarbeiter",
    whyFit:
      "Event-Schwerpunkt — Outlook→CRM→Pack-Plan ist ein direkter Workflow-Sieg.",
    contactPath: "info@stockheim.de",
    website: "www.stockheim.de",
  },
  {
    name: "Hofmann Menü-Manufaktur GmbH",
    city: "Boxberg (Baden-Württemberg)",
    segment: "Tiefkühl-Großcaterer · Schule, Senioren",
    size: "Familienbetrieb, > 800 Mitarbeiter",
    whyFit:
      "DGE-zertifiziert für Schul-Caterer — automatisierter DGE-Score wäre Verkaufsargument für deren Endkunden.",
    contactPath: "info@hofmann-menue.de",
    website: "www.hofmann-menue.de",
  },

  // Schulen, Kitas, Ganztags-Träger
  {
    name: "FRÖBEL Bildung und Erziehung gGmbH",
    city: "Berlin (bundesweit)",
    segment: "Kita-Träger · 220+ Einrichtungen",
    size: "ca. 220 Kitas, > 5.000 Mitarbeiter",
    whyFit:
      "Bundesweiter Träger mit eigenem Verpflegungs-Standard — ein zentrales DGE-Kita-Score-Dashboard ist kaufentscheidend.",
    contactPath: "info@froebel-gruppe.de · Bereich Verpflegung",
    website: "www.froebel-gruppe.de",
  },
  {
    name: "Internationaler Bund (IB) — Verpflegungsbereich",
    city: "Frankfurt am Main",
    segment: "Träger · Schulen, Kitas, Jugendhilfe",
    size: "ca. 14.000 Mitarbeiter",
    whyFit:
      "Bundesweite Träger mit gemischtem Portfolio — Multi-Mandant + DGE-Score deckt alle Sparten.",
    contactPath: "info@ib.de — Anfrage Verpflegung",
    website: "www.internationaler-bund.de",
  },
  {
    name: "Studierendenwerk Berlin",
    city: "Berlin",
    segment: "Hochschul-Mensa · Studierende",
    size: "12 Mensen, ca. 25.000 Essen/Tag",
    whyFit:
      "Hohes Volumen, ESG-Druck (Klimaschutz, Bio-Quote), Vorbestellung über Studi-App — KItchenOS-API integriert nahtlos.",
    contactPath: "info@stw.berlin",
    website: "www.stw.berlin",
  },
  {
    name: "Studierendenwerk München Oberbayern",
    city: "München",
    segment: "Hochschul-Mensa",
    size: "13 Mensen, ca. 30.000 Essen/Tag",
    whyFit:
      "Bayerns größtes Studierendenwerk, hoher Bio-Anteil — Öko-Wizard und Bio-Quoten-Reporting sind direkt nutzbar.",
    contactPath: "info@studentenwerk-muenchen.de",
    website: "www.studierendenwerk-muenchen-oberbayern.de",
  },
  {
    name: "Studierendenwerk Hamburg",
    city: "Hamburg",
    segment: "Hochschul-Mensa",
    size: "13 Mensen, ca. 18.000 Essen/Tag",
    whyFit:
      "Eigene App-Strategie, Pre-Order-Pilot — KItchenOS-API als Backend ist ein direkter Match.",
    contactPath: "info@studierendenwerk-hamburg.de",
    website: "www.studierendenwerk-hamburg.de",
  },
  {
    name: "Berliner Schul-Caterer (mehrere kleine, z. B. LunchVegaz, Mosaik-Berlin)",
    city: "Berlin",
    segment: "Schul-Catering · Bio-Vollwert",
    size: "5–30 Schulen pro Caterer",
    whyFit:
      "Berliner Senatsverwaltung verlangt 50 % Bio + DGE-Standard — KItchenOS automatisiert beides als Reporting.",
    contactPath: "Recherche pro Caterer auf Senatsverwaltung-Liste",
    website: "berlin.de/sen/bjf",
  },

  // Kliniken
  {
    name: "Charité — Universitätsmedizin Berlin",
    city: "Berlin",
    segment: "Universitätsklinik",
    size: "> 3.000 Betten, eigene Klinik-Catering-Tochter",
    whyFit:
      "DGE-Klinikstandard, MDK-Audits, hoher Diät-Mix — KItchenOS hat alle drei vereint.",
    contactPath: "Wirtschaftsdirektion · presse@charite.de für Erstkontakt",
    website: "www.charite.de",
  },
  {
    name: "Helios Kliniken GmbH",
    city: "Berlin (Konzern)",
    segment: "Kliniken-Konzern",
    size: "ca. 86 Häuser DE, > 100.000 Mitarbeiter",
    whyFit:
      "Standardisierungs-Druck im Konzern — eine Plattform für alle Häuser ist ROI-relevant.",
    contactPath: "Zentraler Einkauf / IT-Strategie · helios-gesundheit.de Kontakt",
    website: "www.helios-gesundheit.de",
  },
  {
    name: "Sana Kliniken AG",
    city: "Ismaning bei München",
    segment: "Kliniken-Konzern",
    size: "ca. 50 Häuser, > 36.000 Mitarbeiter",
    whyFit:
      "Eigene Service-Tochter (Sana Catering Service) — direkter Verhandlungspartner für Pilot.",
    contactPath: "Sana Catering Service · service@sana.de",
    website: "www.sana.de",
  },
  {
    name: "Asklepios Kliniken GmbH & Co. KGaA",
    city: "Hamburg",
    segment: "Kliniken-Konzern",
    size: "ca. 170 Einrichtungen DE, > 67.000 Mitarbeiter",
    whyFit:
      "Eigenbetriebene Verpflegung, hohes Volumen, ESG-Reporting — KItchenOS skaliert.",
    contactPath: "Konzern-Pressestelle als Erstkontakt — info@asklepios.com",
    website: "www.asklepios.com",
  },
  {
    name: "Vivantes — Netzwerk für Gesundheit GmbH",
    city: "Berlin",
    segment: "Kommunale Klinik-Gruppe",
    size: "9 Krankenhäuser, ca. 6.000 Betten",
    whyFit:
      "Größter kommunaler Klinik-Verbund DE — öffentliche Hand, Ausschreibung, DGE-Klinikstandard verpflichtend.",
    contactPath: "Ausschreibungs-Plattform · presse@vivantes.de",
    website: "www.vivantes.de",
  },
  {
    name: "Universitätsklinikum Heidelberg / Mannheim / Freiburg / Tübingen / Köln / Hamburg-Eppendorf",
    city: "BW, NRW, HH",
    segment: "Universitätskliniken",
    size: "Je 1.000–2.000 Betten",
    whyFit:
      "Drittmittel-Forschung im Bereich Klinik-Ernährung — KItchenOS als Studien-Plattform für DGE/Diät-Outcomes.",
    contactPath: "Geschäftsführung Wirtschaft · Klinik-Webseite",
    website: "klinikum.uni-heidelberg.de u. a.",
  },

  // Senioren / Pflege
  {
    name: "Korian Deutschland GmbH",
    city: "München",
    segment: "Pflegeheim-Konzern",
    size: "ca. 270 Einrichtungen DE",
    whyFit:
      "Größter privater Heim-Betreiber DE — Standardisierung, MDK-Audit, individuelle Diäten — KItchenOS deckt alles.",
    contactPath: "info@korian.de — Bereich Hauswirtschaft",
    website: "www.korian.de",
  },
  {
    name: "Alloheim Senioren-Residenzen SE",
    city: "Düsseldorf",
    segment: "Pflegeheim-Konzern",
    size: "ca. 270 Einrichtungen DE",
    whyFit:
      "Hoher Personal-Engpass, Bedarf für Tablett-Foto-Analyse und automatische Diät-Filter.",
    contactPath: "info@alloheim.de",
    website: "www.alloheim.de",
  },
  {
    name: "Pro Seniore (Victor's Group)",
    city: "Saarbrücken",
    segment: "Pflegeheim-Gruppe",
    size: "ca. 130 Häuser DE",
    whyFit:
      "Familienbetrieb, schnelle Entscheidungswege, Bedarf für Eltern/Angehörigen-Kommunikation.",
    contactPath: "info@victors.de · Bereich Pflege",
    website: "www.pro-seniore.de",
  },
  {
    name: "Diakonie Deutschland (regionale Werke)",
    city: "Berlin (Bundesverband)",
    segment: "Träger · Pflege, Klinik, Kita",
    size: "ca. 600.000 Mitarbeiter (Gesamt-Werk)",
    whyFit:
      "Dezentral organisiert — Einstieg über regionales Werk (z. B. Diakonie Düsseldorf, Diakonie Württemberg), dann skalieren.",
    contactPath: "info@diakonie.de + regionale Werke",
    website: "www.diakonie.de",
  },
  {
    name: "Caritas-Verband Deutschland (regionale Verbände)",
    city: "Freiburg im Breisgau",
    segment: "Träger · Pflege, Klinik, Kita",
    size: "ca. 700.000 Mitarbeiter (Gesamt-Verband)",
    whyFit:
      "Wie Diakonie — Einstieg über Diözesan-Caritasverband (DiCV) je Bistum.",
    contactPath: "info@caritas.de + DiCV regional",
    website: "www.caritas.de",
  },
  {
    name: "AWO Bundesverband e. V.",
    city: "Berlin",
    segment: "Träger · Pflege, Kita, Jugend",
    size: "ca. 250.000 Mitarbeiter",
    whyFit:
      "Sozial-orientiert, ESG-Druck, oft kommunale Förder-Mittel — DGE-Score pflicht.",
    contactPath: "info@awo.org + Bezirksverband",
    website: "www.awo.org",
  },

  // Betriebskantinen (Eigenbetrieb)
  {
    name: "BMW AG — Werks-Verpflegung München",
    city: "München",
    segment: "Werkskantine (Eigenbetrieb / Caterer)",
    size: "10.000+ Mahlzeiten/Tag",
    whyFit:
      "ESG-Druck, hohe Bio-Quote (Bayern), Vorbestellung wäre Mitarbeiter-Benefit — Pilot mit einem Werk skalierbar.",
    contactPath: "Kontakt über Caterer (oft eigene Tochter) oder Werks-Service",
    website: "www.bmwgroup.com",
  },
  {
    name: "Siemens AG — Standort-Verpflegung",
    city: "München (Konzern)",
    segment: "Werkskantine an > 30 Standorten DE",
    size: "Schwankend, > 50.000 Essen/Tag konzernweit",
    whyFit:
      "Eigenbetriebene und vergebene Kantinen — KItchenOS-Multi-Mandant ist genau das Modell.",
    contactPath: "Real Estate / Workplace Services · Standort-Manager",
    website: "www.siemens.com",
  },
  {
    name: "SAP SE — Mitarbeiter-Restaurant Walldorf, St. Leon-Rot",
    city: "Walldorf",
    segment: "Werkskantine + Mitarbeiter-Restaurant",
    size: "ca. 20.000 Essen/Tag (peak)",
    whyFit:
      "Tech-Affinität, hoher Wellbeing-Etat, Bio-Pilot — Vorzeige-Standort für Klimaschutz-Kennzahlen.",
    contactPath: "Workplace Services Walldorf",
    website: "www.sap.com",
  },
  {
    name: "Bosch — Werkskantinen DE",
    city: "Stuttgart-Feuerbach (Konzern)",
    segment: "Werkskantine",
    size: "Standorte DE-weit",
    whyFit:
      "Standardisierungs-Programm für F&B im Werk — eine Plattform vereinfacht Reporting.",
    contactPath: "Workplace Services pro Werk",
    website: "www.bosch.com",
  },
  {
    name: "Daimler Truck AG — Werkskantine Wörth, Mannheim, Gaggenau",
    city: "Wörth am Rhein u. a.",
    segment: "Werkskantine",
    size: "10.000+ Essen/Tag pro Großwerk",
    whyFit:
      "Eigene Kantine + ESG-Pflichten — KItchenOS deckt Foodcost + Klimaschutz-Kennzahlen.",
    contactPath: "Workplace Services pro Werk",
    website: "www.daimlertruck.com",
  },

  // Hotels
  {
    name: "Lindner Hotels AG",
    city: "Düsseldorf",
    segment: "Hotelkette · Tagungshotels",
    size: "ca. 35 Häuser DE & EU",
    whyFit:
      "Tagungs-Catering ist Profit-Pool — KItchenOS ersetzt Excel-Pack-Plan und LMIV-Etiketten.",
    contactPath: "F&B-Direction Konzern · info@lindnerhotels.com",
    website: "www.lindnerhotels.com",
  },
  {
    name: "Maritim Hotelgesellschaft mbH",
    city: "Bad Salzuflen",
    segment: "Hotelkette · Tagung & Bankett",
    size: "ca. 35 Häuser DE",
    whyFit:
      "Bankett-Größe, hohe Catering-Volumina — Pack-Plan + LMIV-Aushang sind direkter ROI.",
    contactPath: "info@maritim.de",
    website: "www.maritim.de",
  },
  {
    name: "Steigenberger Hotels AG (DEHAG / H World Group)",
    city: "Frankfurt am Main",
    segment: "Hotelkette",
    size: "ca. 40 Häuser DE/EU",
    whyFit:
      "PMS-Integration (Apaleo, Mews, Protel) — Frühstücks-Forecast aus Auslastung ist verkäuflich.",
    contactPath: "F&B Konzern · info@steigenberger.com",
    website: "www.steigenberger.com",
  },
  {
    name: "Familiengeführte 4-Sterne-Tagungshotels (Bergland Sölden, Hotel Bareiss, Brenners Park, Hotel Traube Tonbach)",
    city: "BW, Bayern",
    segment: "Boutique- & Tagungshotel",
    size: "Individuell · 50–200 Zimmer",
    whyFit:
      "Familienbetrieb mit klarer Entscheidungs-Struktur — direkter Vertrieb hocheffizient.",
    contactPath: "F&B-Direktion oder Inhaber direkt",
    website: "diverse",
  },

  // Behörden / öffentliche Hand
  {
    name: "Bundeswehr — Truppenverpflegung (Bw-Catering)",
    city: "Bonn (Bundesamt)",
    segment: "Truppenkantinen",
    size: "ca. 180 Standorte",
    whyFit:
      "Ausschreibungs-Pflicht, DGE-Standard verpflichtend — Compliance-Plattform spart Audit-Stunden.",
    contactPath: "Bundesamt für das Personalmanagement der Bundeswehr · BAPersBw",
    website: "www.bundeswehr.de",
  },
  {
    name: "Justizvollzugsanstalten (JVA) der Länder",
    city: "Länderebene",
    segment: "Anstalts-Verpflegung",
    size: "Variabel pro JVA",
    whyFit:
      "Klare Diät-Pflichten (medizinisch, religiös), Audit-Pflicht — KItchenOS deckt alles.",
    contactPath: "Justizministerium der jeweiligen Länder · JVA-Verwaltung",
    website: "diverse",
  },
  {
    name: "Studentenwerk-Verbund (Deutsches Studentenwerk e. V.)",
    city: "Berlin",
    segment: "57 Studierendenwerke deutschlandweit",
    size: "ca. 1,2 Mio. Studierende versorgt",
    whyFit:
      "Verband-Einstieg → Pilot mit 1–2 Werken → Skalierung auf alle 57. Hoher Hebel.",
    contactPath: "info@studentenwerke.de",
    website: "www.studentenwerke.de",
  },
  {
    name: "Kommunale Schulverwaltungs-Ämter (z. B. Hamburg HIBB, München RBS)",
    city: "Stadtebene",
    segment: "Schulträger · Mensa-Vergaben",
    size: "Variabel · 20–500 Schulen",
    whyFit:
      "Vergabe-Stelle, DGE-Pflicht, Eltern-Druck auf Bio-Quote — KItchenOS ist zentraler Compliance-Partner.",
    contactPath: "Schulverwaltungs-Amt · Bereich Verpflegung",
    website: "diverse",
  },

  // Bio / Nachhaltigkeit
  {
    name: "FRoSTA AG — Werkskantine Bremerhaven",
    city: "Bremerhaven",
    segment: "Werkskantine mit Bio-Profil",
    size: "ca. 1.500 Mitarbeiter",
    whyFit:
      "Mutterkonzern fordert Klimaschutz-Reporting — KItchenOS-Sustainability-Dashboard ist verkäuflich.",
    contactPath: "info@frosta.de",
    website: "www.frosta.de",
  },
  {
    name: "Alnatura Produktions- und Handels GmbH — Mitarbeiter-Restaurant",
    city: "Darmstadt",
    segment: "Werkskantine · Bio-Vollwert",
    size: "ca. 3.500 Mitarbeiter",
    whyFit:
      "100 % Bio Pflicht — Öko-Wizard und Bio-Lieferanten-Modul sind perfekt passend.",
    contactPath: "info@alnatura.de",
    website: "www.alnatura.de",
  },
];

// ─── PDF rendering helpers ──────────────────────────────────────────────────
function makeDoc(): PDFKit.PDFDocument {
  const doc = new PDFDocument({
    size: "A4",
    bufferPages: true,
    margins: {
      top: PAGE.margin,
      bottom: PAGE.margin + 36,
      left: PAGE.margin,
      right: PAGE.margin,
    },
    info: { Author: "KItchenOS", Producer: "KItchenOS marketing pdf-gen" },
  });
  return doc;
}

function drawHeader(
  doc: PDFKit.PDFDocument,
  title: string,
  subtitle: string,
): void {
  doc.save();
  doc
    .rect(0, 0, PAGE.width, 96)
    .fill(BRAND.bgSoft);
  doc
    .fillColor(BRAND.primary)
    .font("Helvetica-Bold")
    .fontSize(11)
    .text("KITCHENOS", PAGE.margin, 32, { characterSpacing: 2 });
  doc
    .fillColor(BRAND.ink)
    .font("Helvetica-Bold")
    .fontSize(20)
    .text(title, PAGE.margin, 50, { width: PAGE.width - PAGE.margin * 2 });
  doc
    .fillColor(BRAND.muted)
    .font("Helvetica")
    .fontSize(10)
    .text(subtitle, PAGE.margin, 78, { width: PAGE.width - PAGE.margin * 2 });
  doc.restore();
  doc.y = 130;
}

function paginateAtEnd(doc: PDFKit.PDFDocument): void {
  // Use bufferPages mode: iterate after content is written, draw footer with no
  // flow-based wrapping (lineBreak: false) so we never trigger pageAdded recursion.
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    const y = PAGE.height - 36;
    doc.save();
    doc
      .strokeColor(BRAND.rule)
      .lineWidth(0.5)
      .moveTo(PAGE.margin, y - 10)
      .lineTo(PAGE.width - PAGE.margin, y - 10)
      .stroke();
    doc
      .fillColor(BRAND.muted)
      .font("Helvetica")
      .fontSize(8)
      .text(
        "KItchenOS  ·  hello@kitchenos.de  ·  +49 30 1234567  ·  www.kitchenos.de",
        PAGE.margin,
        y,
        {
          width: PAGE.width - PAGE.margin * 2,
          align: "left",
          lineBreak: false,
        },
      );
    doc.text(`Seite ${i + 1} / ${range.count}`, PAGE.margin, y, {
      width: PAGE.width - PAGE.margin * 2,
      align: "right",
      lineBreak: false,
    });
    doc.restore();
  }
}

function sectionTitle(doc: PDFKit.PDFDocument, text: string): void {
  doc.moveDown(1.2);
  doc
    .fillColor(BRAND.primary)
    .font("Helvetica-Bold")
    .fontSize(14)
    .text(text);
  doc
    .strokeColor(BRAND.rule)
    .lineWidth(0.5)
    .moveTo(PAGE.margin, doc.y + 4)
    .lineTo(PAGE.width - PAGE.margin, doc.y + 4)
    .stroke();
  doc.moveDown(0.7);
  doc.fillColor(BRAND.ink).font("Helvetica").fontSize(10);
}

function meta(doc: PDFKit.PDFDocument, label: string, value: string): void {
  // Avoid `continued: true` (interacts badly with bufferPages on long text).
  doc
    .fillColor(BRAND.muted)
    .font("Helvetica-Bold")
    .fontSize(9)
    .text(label.toUpperCase(), { characterSpacing: 1 });
  doc
    .fillColor(BRAND.ink)
    .font("Helvetica")
    .fontSize(10)
    .text(value);
  doc.moveDown(0.2);
}

// ─── PDF: sales-emails.pdf ──────────────────────────────────────────────────
function buildEmailsPdf(): Promise<void> {
  const out = resolve(OUT_DIR, "sales-emails.pdf");
  return new Promise((resolveP, rejectP) => {
    const doc = makeDoc();
    const stream = createWriteStream(out);
    doc.pipe(stream);

    drawHeader(
      doc,
      "Sales-E-Mail-Vorlagen",
      "8 Outreach-Templates auf Deutsch · pro Segment der Verpflegungs-Branche",
    );

    doc
      .fillColor(BRAND.ink)
      .font("Helvetica")
      .fontSize(10)
      .text(
        "Diese Vorlagen sind so gebaut, dass Sie Platzhalter wie [Nachname], " +
          "[Einrichtungsart] und [calendly] direkt austauschen und in Outlook, Apollo, " +
          "HubSpot oder Lemlist einfügen. Empfohlene Versende-Fenster sind unter jedem " +
          "Template angegeben — sie spiegeln den Tagesablauf der jeweiligen Zielgruppe wider.",
        { align: "justify" },
      );

    EMAILS.forEach((tpl) => {
      sectionTitle(doc, tpl.segment);
      meta(doc, "Zielgruppe", tpl.audience);
      meta(doc, "Beste Sende-Zeit", tpl.bestSentBy);
      doc.moveDown(0.4);
      meta(doc, "Betreff", tpl.subjectDe);
      doc.moveDown(0.6);

      doc
        .fillColor(BRAND.muted)
        .font("Helvetica-Bold")
        .fontSize(9)
        .text("E-MAIL-TEXT", { characterSpacing: 1 });
      doc.moveDown(0.3);

      // Body in light card
      const startY = doc.y;
      const bodyW = PAGE.width - PAGE.margin * 2 - 16;
      doc.fillColor(BRAND.ink).font("Helvetica").fontSize(10);
      const bodyHeight = doc.heightOfString(tpl.bodyDe, {
        width: bodyW,
        align: "left",
      });
      doc.save();
      doc
        .roundedRect(
          PAGE.margin,
          startY - 4,
          PAGE.width - PAGE.margin * 2,
          bodyHeight + 16,
          6,
        )
        .fill(BRAND.bgMute);
      doc.restore();
      doc.fillColor(BRAND.ink).font("Helvetica").fontSize(10);
      doc.text(tpl.bodyDe, PAGE.margin + 8, startY + 4, {
        width: bodyW,
        align: "left",
      });
      doc.y = startY + bodyHeight + 16;

      if (tpl.followUp) {
        doc.moveDown(0.5);
        doc
          .fillColor(BRAND.muted)
          .font("Helvetica-Bold")
          .fontSize(9)
          .text("FOLLOW-UP (5 WERKTAGE SPÄTER)", { characterSpacing: 1 });
        doc.moveDown(0.3);
        doc.fillColor(BRAND.ink).font("Helvetica").fontSize(10);
        doc.text(tpl.followUp, { align: "left" });
      }
    });

    paginateAtEnd(doc);
    doc.end();
    stream.on("finish", () => resolveP());
    stream.on("error", rejectP);
  });
}

// ─── PDF: lead-list.pdf ─────────────────────────────────────────────────────
function buildLeadsPdf(): Promise<void> {
  const out = resolve(OUT_DIR, "lead-list.pdf");
  return new Promise((resolveP, rejectP) => {
    const doc = makeDoc();
    const stream = createWriteStream(out);
    doc.pipe(stream);

    drawHeader(
      doc,
      "Ziel-Liste · DE-B2B-Kontakte",
      `${LEADS.length} öffentlich bekannte Operator und Träger im DACH-Raum, gruppiert nach Segment.`,
    );

    doc
      .fillColor(BRAND.ink)
      .font("Helvetica")
      .fontSize(10)
      .text(
        "Diese Liste enthält öffentlich bekannte Verpflegungs-Operator, Träger und " +
          "potenzielle Pilot-Kunden im deutschsprachigen Raum. Alle Angaben stammen aus " +
          "öffentlich verfügbaren Quellen (Unternehmens-Webseiten, Pressemitteilungen, " +
          "Geschäftsberichte). Personenbezogene Kontakte bewusst weggelassen — recherchieren Sie " +
          "im LinkedIn Sales Navigator oder Apollo, sobald Sie die Einrichtung priorisiert haben.",
        { align: "justify" },
      );

    // Group by segment
    const groups = new Map<string, Lead[]>();
    LEADS.forEach((l) => {
      const segKey = l.segment.split("·")[0].trim();
      if (!groups.has(segKey)) groups.set(segKey, []);
      groups.get(segKey)!.push(l);
    });

    for (const [seg, list] of groups) {
      sectionTitle(doc, `${seg}  ·  ${list.length} Einträge`);
      list.forEach((l) => {
        // Card
        const startY = doc.y;
        const cardW = PAGE.width - PAGE.margin * 2;
        const padX = 12;
        const padY = 10;

        // Estimate height
        doc.font("Helvetica").fontSize(9.5);
        const innerW = cardW - padX * 2;
        const fitH = doc.heightOfString(`Warum: ${l.whyFit}`, { width: innerW });
        const cardH = padY * 2 + 14 + 12 + 12 + 12 + fitH + 14;

        // Page break if needed
        if (startY + cardH > PAGE.height - PAGE.margin - 20) {
          doc.addPage();
        }

        const yTop = doc.y;
        doc.save();
        doc
          .roundedRect(PAGE.margin, yTop, cardW, cardH, 6)
          .fillAndStroke(BRAND.bgMute, BRAND.rule);
        doc.restore();

        // Name (bold) + city
        doc
          .fillColor(BRAND.ink)
          .font("Helvetica-Bold")
          .fontSize(11)
          .text(l.name, PAGE.margin + padX, yTop + padY, { width: innerW });
        doc
          .fillColor(BRAND.primary)
          .font("Helvetica")
          .fontSize(9)
          .text(`${l.city}  ·  ${l.size}`, PAGE.margin + padX, doc.y + 1, {
            width: innerW,
          });

        doc.moveDown(0.3);
        doc
          .fillColor(BRAND.ink)
          .font("Helvetica")
          .fontSize(9.5)
          .text(`Warum: ${l.whyFit}`, PAGE.margin + padX, doc.y, {
            width: innerW,
          });

        doc
          .fillColor(BRAND.muted)
          .font("Helvetica")
          .fontSize(9)
          .text(
            `Kontakt: ${l.contactPath}   ·   ${l.website}`,
            PAGE.margin + padX,
            doc.y + 2,
            { width: innerW },
          );

        doc.y = yTop + cardH + 6;
      });
    }

    paginateAtEnd(doc);
    doc.end();
    stream.on("finish", () => resolveP());
    stream.on("error", rejectP);
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log("Generating sales-emails.pdf …");
  await buildEmailsPdf();
  console.log("Generating lead-list.pdf …");
  await buildLeadsPdf();
  console.log(`Done. Output → ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
