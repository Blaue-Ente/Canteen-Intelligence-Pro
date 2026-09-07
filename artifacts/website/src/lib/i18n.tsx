import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Lang = "de" | "en";

type Dict = Record<string, string>;

const de: Dict = {
  brand: "KItchenOS",
  tagline: "Die smarte Plattform für Großküchen, Kantinen und Catering",
  navHome: "Start",
  navFeatures: "Funktionen",
  navOperators: "Für Betreiber",
  navCompare: "Vergleich",
  navStandards: "Standards",
  navHardware: "Hardware",
  navPricing: "Preise",
  navAbout: "Über uns",
  navContact: "Kontakt",
  navDownloads: "Downloads",
  navDemo: "Demo anfragen",
  navApp: "Zur App",
  navAppPreorder: "Pre-Order Portal",
  navAppPreorderDesc: "Online-Bestellung für Gäste",
  navAppDemo: "App-Demo",
  navAppDemoDesc: "Vollständige Kantinen-App ausprobieren",
  navAppNote: "Öffnet in neuem Fenster",

  // Hardware comparison page (iPad vs Android)
  hwTitle: "Welches Tablet passt zu Ihrer Küche?",
  hwSub: "iPad oder Android — bei Vertragsabschluss wählen Sie die Plattform, die zu Ihrem Betrieb passt.",
  hwTagline: "Beide Plattformen laufen mit derselben KItchenOS-App. Alle Daten liegen in der EU-Cloud — das Tablet ist nur das Fenster zu Ihrer Küche.",

  hwCloudTitle: "Cloud-First: Ihre Daten sind nie auf dem Tablet gefangen",
  hwCloudBody: "Bestellungen, Inventar, HACCP-Protokolle, Rezepte und Umsätze werden in Echtzeit verschlüsselt in unserer EU-Cloud (Frankfurt) gespeichert. Das Tablet ist austauschbar — fällt es aus, übernimmt das Ersatzgerät innerhalb von Minuten ohne Datenverlust.",
  hwCloudPoint1: "Verschlüsselt nach AES-256 in der EU (Frankfurt)",
  hwCloudPoint2: "Tägliche automatische Backups, 30 Tage Vorhaltung",
  hwCloudPoint3: "Tablet-Tausch in unter 5 Minuten — neu anmelden, fertig",
  hwCloudPoint4: "DSGVO-konform inkl. Auftragsverarbeitungsvertrag (AVV)",

  hwIpadHead: "iPad (Apple)",
  hwIpadIntro: "Die Premium-Wahl. Beste Optik, Apple-Ökosystem, hervorragende MDM-Integration über Apple Business Manager. Ideal für gehobene Restaurants und Hotels.",
  hwAndroidHead: "Android-Tablet (Samsung)",
  hwAndroidIntro: "Die robuste Wahl. Galaxy Tab Active mit IP68-Zertifizierung übersteht Dampf, Wasser, Stürze. Günstiger und besser geeignet für die Küchenrealität.",
  hwRecBadge: "Empfehlung Küche",

  hwLabelDevice: "Gerät",
  hwLabelMdm: "MDM-Lösung",
  hwLabelHwCost: "Hardware",
  hwLabelMonthly: "Verwaltung",
  hwIpadDevice: "iPad 10.9″ (10. Gen)",
  hwIpadMdmName: "Jamf School / Mosyle",
  hwIpadCost: "ab 499 €",
  hwIpadMonthly: "ca. 5 €/Monat",
  hwAndroidDevice: "Galaxy Tab Active5",
  hwAndroidMdmName: "Android Enterprise / Samsung Knox",
  hwAndroidCost: "ab 379 €",
  hwAndroidMonthly: "ca. 3 €/Monat",

  hwTableTitle: "Detaillierter Vergleich",
  hwColCriterion: "Kriterium",
  hwColIpad: "iPad",
  hwColAndroid: "Android-Tablet (rugged)",
  hwTableLegend: "Bewertung pro Zeile relativ zur jeweils anderen Plattform für den Einsatz in der Großküche.",
  hwScoreBest: "Klarer Vorteil",
  hwScoreGood: "Gut",
  hwScoreOk: "Akzeptabel mit Einschränkungen",

  hwRowDurability: "Robustheit",
  hwRowDurabilityDetail: "Schutz gegen Wasser, Dampf, Stürze, Hitze",
  hwIpadDurability: "Glas-Display, kein IP-Schutz — schützende Hülle dringend empfohlen",
  hwAndroidDurability: "IP68 zertifiziert, MIL-STD-810H, übersteht 1,5 m Sturz",

  hwRowPrice: "Anschaffungspreis",
  hwRowPriceDetail: "Hardware-Kosten pro Tablet",
  hwIpadPrice: "iPad ab 499 €, Hülle 60–120 €",
  hwAndroidPrice: "Galaxy Tab Active5 ab 379 € — Schutz inklusive",

  hwRowMdm: "Geräteverwaltung (MDM)",
  hwRowMdmDetail: "Fernkonfiguration, Single-App-Modus, Zero-Touch-Setup",
  hwIpadMdm: "Apple Business Manager + Jamf — branchenführend, ausgereift",
  hwAndroidMdm: "Android Enterprise + Knox — solide, etwas mehr Konfiguration",

  hwRowPwa: "PWA-Unterstützung im Browser",
  hwRowPwaDetail: "Lokale Speicherung, Offline-Fähigkeit, Push-Nachrichten",
  hwIpadPwa: "Safari löscht Daten nach 7 Tagen Inaktivität — Cloud-Sync zwingend",
  hwAndroidPwa: "Chrome behält Daten unbegrenzt, volle PWA-Funktionalität",

  hwRowVoice: "Sprachsteuerung (Kios)",
  hwRowVoiceDetail: "Web Speech API für freihändige Bedienung",
  hwIpadVoice: "Funktioniert, mit kleinen Audio-Eigenheiten von Safari",
  hwAndroidVoice: "Chrome implementiert die volle Web Speech API zuverlässig",

  hwRowDisplay: "Bildschirmqualität",
  hwRowDisplayDetail: "Farbtreue, Helligkeit, Ablesbarkeit",
  hwIpadDisplay: "Retina-Display, 500 nits, exzellente Farbwiedergabe",
  hwAndroidDisplay: "TFT, 450 nits, gute Ablesbarkeit auch bei Sonnenlicht",

  hwRowBattery: "Akkulaufzeit",
  hwRowBatteryDetail: "Dauer eines Servicetages",
  hwIpadBattery: "Bis zu 10 Stunden bei normaler Nutzung",
  hwAndroidBattery: "Wechselbarer Akku — durchgehender Betrieb möglich",

  hwRowService: "Service & Reparatur in DE",
  hwRowServiceDetail: "Verfügbarkeit von Ersatzteilen und Werkstätten",
  hwIpadService: "Apple Stores in jeder Großstadt, AppleCare optional",
  hwAndroidService: "Samsung-Servicepartner deutschlandweit, Express-Tausch",

  hwRowImage: "Markenwirkung",
  hwRowImageDetail: "Wahrnehmung durch Gäste und Mitarbeiter",
  hwIpadImage: "Premium-Image, höhere Akzeptanz im gehobenen Segment",
  hwAndroidImage: "Funktional-pragmatisches Image, Fokus auf Robustheit",

  hwRowProcurement: "Beschaffung im öffentlichen Sektor",
  hwRowProcurementDetail: "Schulen, Kliniken, Senioreneinrichtungen",
  hwIpadProcurement: "Häufig im Rahmen-Vertrag, aber höhere Stückkosten",
  hwAndroidProcurement: "Bessere Genehmigungsquote bei knappem Budget",

  hwRecTitle: "Wann welche Plattform?",
  hwRec1Title: "Feuchte oder rauhe Küchenumgebung",
  hwRec1Body: "Großküche mit Dampf, Spritzwasser, häufigem Reinigen, Kontakt mit Edelstahlflächen.",
  hwRec2Title: "Knappes Budget oder öffentlicher Träger",
  hwRec2Body: "Schulen, Kitas, soziale Einrichtungen — günstiger Anschaffungspreis und einfachere Beschaffung.",
  hwRec3Title: "Bestehendes Apple-Ökosystem",
  hwRec3Body: "Sie nutzen bereits Macs, iPhones, Apple Business Manager — nahtlose Integration.",
  hwRec4Title: "Premium-Restaurant oder Hotel",
  hwRec4Body: "Gehobenes Ambiente, gästeorientierte Bedienung, Markenbildung wichtig.",
  hwPickIpad: "Empfehlung: iPad",
  hwPickAndroid: "Empfehlung: Android-Tablet",

  hwCtaTitle: "Unsicher, was zu Ihrer Küche passt?",
  hwCtaBody: "Wir beraten Sie unverbindlich und stellen Ihnen ein Testgerät auf Wunsch zur Verfügung. Bei Vertragsabschluss legen wir die Plattform gemeinsam fest.",
  ctaDemo: "Kostenlose Demo",
  ctaDemoStart: "Demo starten",
  demoKantineTitle: "Kantine München",
  demoKantineDesc: "Mittagsküche, ~200 Portionen täglich",
  demoSchuleTitle: "Bio-Schulmensa",
  demoSchuleDesc: "Vegan/vegetarisch, DGE-Standard",
  demoCateringTitle: "Event-Catering",
  demoCateringDesc: "Veranstaltungs-Geschäft mit Forecast",
  ctaStart: "Jetzt starten",
  ctaTalk: "Mit uns sprechen",
  langSwitch: "EN",

  // Home
  heroBadge: "Neu 2026 · DGE · KI-Stimme · TSE-Kasse",
  heroTitle: "Eine Plattform. Ihre ganze Küche. Komplett konform.",
  heroSub:
    "KItchenOS ersetzt Excel, Klemmbrett, Kasse und drei weitere Tools. DGE-konform für Schulen, Kitas, Kliniken und Senioren-Heime. Mit KI-Sprachassistent, Fiskaly-TSE-Kasse, LMIV-Aushang und Echtzeit-Forecast.",
  heroPoint1: "DGE-Qualitätsstandard automatisch geprüft (einzigartig in DACH)",
  heroPoint2: "Sprachsteuerung freihändig — sage 'Kios, Tagesabschluss'",
  heroPoint3: "Fiskaly-TSE-Kasse + KassenSichV-Bons + DSFinV-K-Export",
  heroPoint4: "LMIV-konform für jedes Gericht — Allergene aus dem Rezept",
  socialProofTitle:
    "Warum Küchen-Betreiber, Caterer und Träger zu KItchenOS wechseln",

  // Why (4 cards)
  whyTitle: "Vier Probleme, die nur KItchenOS löst",
  whySub:
    "Jede dieser Funktionen entscheidet bei der Ausschreibung, beim MDK-Audit oder im Tagesbetrieb. Andere SaaS-Tools können davon eines, vielleicht zwei. KItchenOS hat alle vier.",
  why1Title: "DGE-Score live & als PDF-Zertifikat",
  why1Body:
    "Wir scannen Ihren Speiseplan automatisch gegen den DGE-Qualitätsstandard für Schule, Kita, Klinik oder Senioren — Live-Score, Empfehlungen, fertiges Zertifikat als Audit-Nachweis. Keine andere Plattform in DACH kann das.",
  why2Title: "Sprach-Assistent Kios — freihändig in der Küche",
  why2Body:
    "Mit nassen Händen am Herd: 'Kios, Tagesabschluss starten' — und das System wartet auf Ihre Zahlen. Always-on Hotword-Detection, deutsche und englische Stimme, kein Tippen mehr.",
  why3Title: "TSE-konforme Kasse direkt im System",
  why3Body:
    "Fiskaly-TSE-Signatur, KassenSichV-konforme Bons, DSFinV-K-Export für die Steuerprüfung. Kein zweites Kassen-System nötig, keine doppelte Artikel-Pflege, keine Schnittstellen-Pannen.",
  why4Title: "Eine Stamm-Datenbank für alles",
  why4Body:
    "Rezept, Allergene, Nährwerte, Kalkulation, Kasse, Aushang und LMIV-Etikett — alles aus einer Quelle. Andere Anbieter brauchen drei Tools dafür.",

  // Stats strip
  statsTitle: "Was Betreiber im ersten Jahr erreichen",
  stat1: "−18 %",
  stat1Label: "Lebensmittel-Verschwendung",
  stat2: "−4 Std",
  stat2Label: "Verwaltung pro Woche",
  stat3: "+22 %",
  stat3Label: "Bestellannahme der Mitarbeiter",
  stat4: "100 %",
  stat4Label: "DGE & LMIV-Audit-fähig",

  testimonialBody:
    "Unsere Hauswirtschaftsleitung hat in der ersten Woche zehn Stunden gespart — und der DGE-Nachweis für die Stadt war ein Knopfdruck. Wir hätten das nicht geglaubt, wenn wir es nicht selbst gesehen hätten.",
  testimonialAuthor: "Verpflegungsleiter, Klinik-Verbund Nord",

  finalCtaTitle: "Bereit, Excel und Klemmbrett in Rente zu schicken?",
  finalCtaSub:
    "30 Minuten Demo — wir zeigen DGE-Score, Sprachsteuerung und TSE-Kasse an Ihrem realen Wochenplan.",

  // Features page
  featuresTitle: "Funktionen",
  featuresSub:
    "Alles, was eine Großküche im Jahr 2026 braucht — vom KI-Assistenten bis zur fiskaly-TSE-Kasse.",

  fGroup1Title: "Konformität & Qualität",
  fGroup2Title: "Tagesgeschäft & Bedienung",
  fGroup3Title: "Küche & Produktion",
  fGroup4Title: "Einkauf, Lager & Forecast",
  fGroup5Title: "Gäste, Verkauf & CRM",
  fGroup6Title: "Insights, Berichte & Multi-Standort",

  // Compliance & Quality (NEW USPs)
  fDgeTitle: "DGE-Score & Zertifikat",
  fDgeBody:
    "Live-Score 0–100 gegen den DGE-Standard für Schule, Kita, Klinik oder Senioren. Empfehlungen pro Tag ('Mittwoch: Seefisch ergänzen'), PDF-Zertifikat für Träger und Audits.",
  fLmivTitle: "LMIV-Aushang pro Gericht",
  fLmivBody:
    "Print-fertiger Aushang mit Allergenen, Zusatzstoffen und Nährwerten — direkt aus dem Rezept generiert. Eltern-Sprache für Schule und Kita auf Knopfdruck.",
  fHaccpTitle: "HACCP digital",
  fHaccpBody:
    "Kühlketten-Logging via Bluetooth-Sensor, Reinigungs-Checklisten mit Foto-Beleg, Rückstellproben mit Etikett-Druck und 7-Tages-Erinnerung — DIN-konform.",
  fOkoTitle: "BIO/Öko-Wizard",
  fOkoBody:
    "Bio-Quote pro Komponente live. Öko-Lieferanten-Liste, Kennzeichnungs-Stufen (Bronze/Silber/Gold), automatische Reports für Träger und ESG-Berichte.",

  // Daily ops
  fKiosTitle: "Sprach-Assistent Kios",
  fKiosBody:
    "Always-on Hotword-Detection. Sage 'Kios, Tagesabschluss', 'Kios, Bestellung XY anlegen', 'Kios, wie ist mein DGE-Score'. Freihändig, deutsch und englisch.",
  fKasseTitle: "Fiskaly-TSE-Kasse",
  fKasseBody:
    "KassenSichV-konforme Bons, TSE-Signatur, DSFinV-K-Export, Tages-Z-Report. Passt neben Hotel-Kasse oder als Stand-alone — keine Drittanbieter nötig.",
  fZettleTitle: "Zettle-Z-Report Sync",
  fZettleBody:
    "Wenn Sie bereits mit Zettle/SumUp arbeiten: Synchronisieren Sie Verkaufs-Daten in Echtzeit, ohne doppelte Eingabe. Z-Report wird automatisch erfasst.",
  fSchichtTitle: "Schichtübergabe & Dienstplan",
  fSchichtBody:
    "Strukturierte Übergabe-Notizen zwischen Schichten. Dienstplan mit Wunschzeiten, Krankmeldungen, Tausch-Anfragen — direkt am Smartphone.",
  fTagesTitle: "Tagesabschluss in 90 Sekunden",
  fTagesBody:
    "Pro Gericht: gekocht / verkauft / Reste. Erfassungs-Fenster verhindert Manipulation. Live-Aggregat für Mehrere Standorte.",

  // Production
  fProdTitle: "Produktion & Rückstellproben",
  fProdBody:
    "Pack-Plan aus dem Wochenmenü. Rückstellproben-Etiketten mit Datum, Charge und 7-Tages-Erinnerung. Foto-Beleg pro Probe.",
  fRezepteTitle: "KI-Rezeptbuch (150+ Klassiker)",
  fRezepteBody:
    "Deutsch, italienisch, französisch, asiatisch, BBQ. Mengen, Allergene und Nährwerte automatisch berechnet — auch für vegane, vegetarische und Diät-Versionen.",
  fScanTitle: "Scannen — Etikett, Barcode, Produkt",
  fScanBody:
    "Foto vom Produkt → KI erkennt Artikel, Hersteller, Allergene. Scannen Sie die Lieferung herein, statt sie manuell zu erfassen.",
  fReinigungTitle: "Reinigungsplan & HACCP-Checklisten",
  fReinigungBody:
    "Tages-, Wochen- und Monats-Reinigungspläne pro Bereich. Foto-Beleg, Verantwortlicher, Zeitstempel — auf Anfrage als PDF an Aufsicht.",

  // Inventory & Forecast
  fLagerTitle: "Lager mit Mindestbestand & MHD",
  fLagerBody:
    "Live-Bestand pro Standort. Mindestbestand triggert Bestellvorschlag. MHD-Frühwarnung an die Küche, bevor Reste entstehen.",
  fBestellTitle: "Bestellungen direkt an Lieferanten",
  fBestellBody:
    "Entwürfe per E-Mail oder PDF in einem Klick. Lieferanten-Stamm mit Konditionen, Mindestbestellmengen und Liefertagen.",
  fForecastTitle: "KI-Forecast (Wetter, Wochentag, Anwesenheit)",
  fForecastBody:
    "Vorhersage von Mengen pro Gericht aus historischen Daten plus externe Faktoren. Reduziert Schätz-Fehler um typischerweise 60 %.",
  fPriceTitle: "Preisserver & Kalkulation",
  fPriceBody:
    "Foodcost pro Komponente live. Preis-Vorschlag pro Gericht aus Marge, Gemeinkosten und MwSt. Brutto-VK automatisch.",

  // Sales & CRM
  fVorbestTitle: "Vorbestellung mit 08:00-Cutoff",
  fVorbestBody:
    "QR-Code am Eingang, keine App-Installation. Mitarbeiter, Eltern oder Bewohner bestellen vorab — die Küche bekommt um 08:01 die Aggregat-Liste.",
  fCrmTitle: "CRM mit Outlook-Lead-Capture",
  fCrmBody:
    "Anfrage-Mail aus Outlook landet als Lead im CRM. Notizen, Wiedervorlagen, Veranstaltungs-Historie pro Kontakt — Catering wird strukturiert.",
  fCateringTitle: "Catering & Event-Plan",
  fCateringBody:
    "Vorlauffristen, Lieferzeitfenster, Pack-Plan und LMIV-Etiketten pro Komponente — alles aus einem Auftrag generiert.",
  fSchulkontoTitle: "Schulkonto / RKSH-konform",
  fSchulkontoBody:
    "Eltern-Konto mit Sammelrechnung, automatischer SEPA-Lastschrift und Bildungs- und Teilhabe-Schnittstelle (BuT/RKSH).",

  // Reports & Multi-site
  fStatsTitle: "Live-Statistik (Tab)",
  fStatsBody:
    "Tages-Umsatz, Top-Gerichte, Verschwendungs-Quote, Foodcost-Trend, Marge — Dashboard für die Geschäftsführung. Drill-Down per Tap.",
  fReportsTitle: "Berichte (Bank, Träger, Ausschreibung)",
  fReportsBody:
    "Vorlagen für Bank-Report (Kreditverhandlung), Träger-Report (Schule/Klinik) und Ausschreibung (DGE-Score + Bio-Quote + Allergen-Statistik).",
  fLocationsTitle: "Multi-Standort & Roll-up",
  fLocationsBody:
    "Eine Plattform für mehrere Kantinen, Häuser oder Caterer. Trennung der Daten, gemeinsame Auswertung. Roll-up-Aggregat über alle Standorte.",
  fTabletTitle: "Tablett-Foto-Analyse für Reste",
  fTabletBody:
    "Pflegepersonal fotografiert den Rückläufer — KI erkennt 'Gemüse 70 % zurück'. Echtzeit-Wissen, welche Komponenten regelmäßig nicht ankommen.",

  // Compare page
  compareTitle: "KItchenOS vs. der Markt",
  compareSub:
    "Wir haben uns ehrlich neben Apicbase, Foodics, MarketMan und Choco gestellt. Hier ist, wo wir gewinnen — und wo wir bewusst etwas anderes machen.",
  compareWhy:
    "Andere Plattformen sind aus dem Restaurant-Markt geboren und versuchen, sich an Großküchen anzupassen. KItchenOS ist von Tag eins für Schule, Klinik, Senioren und Catering gebaut — mit den deutschen Compliance-Vorgaben im Kern.",
  compareCol1: "Funktion",
  compareCol2: "KItchenOS",
  compareCol3: "Apicbase",
  compareCol4: "Foodics",
  compareCol5: "MarketMan",
  compareCol6: "Choco",
  compareYes: "Ja",
  compareNo: "Nein",
  compareLimited: "Eingeschränkt",
  compareRow1: "DGE-Score (DE)",
  compareRow2: "LMIV-Aushang pro Gericht",
  compareRow3: "HACCP digital + Rückstellprobe",
  compareRow4: "KassenSichV/TSE (Fiskaly)",
  compareRow5: "DSFinV-K-Export (DE Steuer)",
  compareRow6: "Sprach-Assistent (DE/EN)",
  compareRow7: "BIO/Öko-Wizard (EU 2018/848)",
  compareRow8: "Diät-Profil pro Bewohner",
  compareRow9: "Tablett-Foto-Resteanalyse",
  compareRow10: "BuT/RKSH-Schul-Konto",
  compareRow11: "Vorbestellung mit 08:00-Cutoff",
  compareRow12: "Lieferanten-Bestellung & EDI",
  compareRow13: "KI-Forecast (Wetter+Anwesenheit)",
  compareRow14: "KI-Rezeptbuch (150+ Klassiker)",
  compareRow15: "Catering-CRM + Outlook-Lead",
  compareRow16: "Multi-Standort & Roll-up",
  compareRow17: "DSGVO + Hosting EU/DE",
  compareLegend:
    "Ja: voll integriert · Eingeschränkt: über Add-on/Drittanbieter · Nein: nicht verfügbar.",
  compareLegendNote:
    "Stand 2026, beruht auf öffentlich verfügbaren Produkt-Webseiten.",
  compareSummaryTitle: "Wenn KItchenOS, wenn andere?",
  compareSummary1Title: "Wählen Sie KItchenOS, wenn …",
  compareSummary1Body:
    "Sie eine Großküche, Kantine, Klinik, Senioren-Heim oder Catering-Betrieb in DACH führen, DGE-Standard, KassenSichV-Pflicht und LMIV-Compliance einhalten müssen, eine deutschsprachige Sprachsteuerung im Küchen-Alltag wollen, und keine Lust auf drei Tools haben, die nicht miteinander reden.",
  compareSummary2Title: "Wählen Sie Apicbase, wenn …",
  compareSummary2Body:
    "Sie eine Kette mit > 50 Standorten in mehreren Ländern führen, hauptsächlich Restaurant-Operations und kein deutsches Compliance-Profil brauchen.",
  compareSummary3Title: "Wählen Sie Foodics oder MarketMan, wenn …",
  compareSummary3Body:
    "Sie ein klassisches Quick-Service-Restaurant in der MENA-Region (Foodics) oder Nordamerika (MarketMan) führen.",
  compareSummary4Title: "Wählen Sie Choco, wenn …",
  compareSummary4Body:
    "Sie nur ein Tool für die Bestellung an Lieferanten suchen — und keine Plattform, die alles andere abdeckt.",

  // Standards page
  standardsTitle: "Compliance, in jeder Zeile",
  standardsSub:
    "KItchenOS ist kein Marketing-Versprechen, sondern ein Compliance-System. Hier sind die Standards, die wir konkret abdecken — mit dem entsprechenden Modul.",
  std1Title: "DGE-Qualitätsstandard",
  std1Body:
    "Schule, Kita, Klinik, Senioren — alle vier Standards der Deutschen Gesellschaft für Ernährung sind im Scoring-Engine implementiert. Live-Score, Empfehlungen, PDF-Zertifikat.",
  std1Tag: "DGE",
  std2Title: "LMIV / EU-VO 1169/2011",
  std2Body:
    "14 Hauptallergene plus Zusatzstoffe automatisch erkannt. Aushang pro Gericht, Eltern-Sprache, Symbol-Legende. Korrekte Schriftgrößen-Pflicht beachtet.",
  std2Tag: "LMIV",
  std3Title: "HACCP / DIN 10514, DIN 10516",
  std3Body:
    "Kühlketten-Logging (Bluetooth-Sensor optional), Reinigungs-Checklisten mit Foto-Beleg, Rückstellproben-Etiketten und 7-Tages-Erinnerung. Audit-Trail unveränderlich.",
  std3Tag: "HACCP",
  std4Title: "KassenSichV / TSE / DSFinV-K",
  std4Body:
    "Fiskaly-zertifizierte TSE-Signatur. KassenSichV-konforme Bons mit QR-Code. DSFinV-K-Export für die Betriebsprüfung des Finanzamts.",
  std4Tag: "TSE",
  std5Title: "EU-Bio-Verordnung 2018/848",
  std5Body:
    "Bio-Komponenten-Tracking, Lieferanten-Zertifikat-Verwaltung, Kennzeichnungs-Stufen Bronze/Silber/Gold gemäß Bayerns BIO-Siegel-System.",
  std5Tag: "BIO",
  std6Title: "DSGVO / GDPR",
  std6Body:
    "Hosting in Deutschland (Hetzner Frankfurt). Auftragsverarbeitungs-Vertrag (AVV) inklusive. Daten-Export, Lösch-Recht, Tracking-frei. Eltern-Daten besonders geschützt.",
  std6Tag: "DSGVO",
  std7Title: "BuT / Bildung und Teilhabe",
  std7Body:
    "Schul-Mensa-Abrechnung über Bildungs- und Teilhabe-Karte (BuT) und RKSH-Schnittstelle. Sammelrechnung an Träger oder kommunale Verwaltung.",
  std7Tag: "BuT",
  std8Title: "Klimaschutz / ESG-Reporting",
  std8Body:
    "CO₂-Footprint pro Gericht (Datenbank Eaternity), Bio-Quote, Tier-/Pflanzen-Verhältnis, Regional-Anteil. Export für ESG-Bericht der Mutter-Konzerne.",
  std8Tag: "ESG",

  // Operators (richer version)
  opTitle: "Für Großküchen-Betreiber",
  opSub:
    "Sechs Branchen, sechs Workflows, eine Plattform. KItchenOS ist von Tag eins für Schule, Klinik, Senioren, Betrieb, Catering und Hotel gebaut.",
  opCanteenTitle: "Betriebskantine & Werkskantine",
  opCanteenBody:
    "Vorbestellung 08:00, KI-Forecast aus Anwesenheit, Sammelrechnung an Arbeitgeber, ESG-Kennzahlen für den Konzern-Bericht.",
  opSchoolTitle: "Schule & Kindertagesstätte",
  opSchoolBody:
    "DGE-Score live, Eltern-Vorbestellung, Diät-Filter (vegan, glutenfrei, halal, koscher), BuT-konforme Abrechnung.",
  opCareTitle: "Krankenhaus & Klinik",
  opCareBody:
    "DGE-Klinikstandard, Bedside-Pre-Order am Tablet, MDK-Audit-fähig, HACCP digital. Integration mit SAP IS-H, Orbis, Medico möglich.",
  opSeniorTitle: "Senioren- & Pflegeheim",
  opSeniorBody:
    "Diät-Profil pro Bewohner (Schluckstörung, Diabetes, Niereninsuffizienz, vegan, halal). Tablett-Etikett mit Allergen-Symbolen. DGE-Senioren-Standard.",
  opCateringTitle: "Catering & Event",
  opCateringBody:
    "Outlook-Lead-Capture, automatischer Pack-Plan, LMIV-Etiketten pro Komponente, Multi-Standort und Sammelrechnung an Stamm-Geschäftskunden.",
  opHotelTitle: "Hotel- & Tagungsrestaurant",
  opHotelBody:
    "Eine Rezept-DB für Restaurant, Frühstück, Halbpension und Tagungs-Catering. PMS-Integration für Frühstücks-Forecast (Apaleo, Mews, Protel).",
  opStatTitle: "Was Betreiber im ersten Jahr erreichen",
  opStat1: "−18 %",
  opStat1Label: "Lebensmittel-Verschwendung",
  opStat2: "+22 %",
  opStat2Label: "Bestellannahme",
  opStat3: "−4 Std",
  opStat3Label: "Verwaltung pro Woche",
  opStat4: "100 %",
  opStat4Label: "DGE & LMIV-Audit-fähig",

  // Pricing (slight enrichment)
  pricingTitle: "Faire Preise",
  pricingSub:
    "Keine Einrichtungsgebühr. Keine versteckten Kosten. Monatlich kündbar. DSGVO-konform aus Frankfurt gehostet.",
  planStarter: "Starter",
  planStarterPrice: "€89",
  planStarterDesc: "Für eine Kantine bis 100 Mahlzeiten/Tag",
  planPro: "Professional",
  planProPrice: "€189",
  planProDesc: "Für eine Kantine bis 400 Mahlzeiten/Tag",
  planEnterprise: "Enterprise",
  planEnterprisePrice: "Auf Anfrage",
  planEnterpriseDesc: "Multi-Standort, eigene Domain, SLA, On-Premise möglich",
  planMonth: "/Monat",
  feat1: "Digitales Menü + QR-Codes",
  feat2: "Vorbestellung & 08:00-Cutoff",
  feat3: "Mobile Küchen-App + Sprach-Assistent",
  feat4: "LMIV-Allergenkennzeichnung",
  feat5: "DGE-Score & Zertifikat",
  feat6: "Fiskaly-TSE-Kasse",
  feat7: "Mehrere Standorte",
  feat8: "Eigene Domain & API-Zugang",
  feat9: "Persönlicher Onboarding-Manager",
  pickPlan: "Plan wählen",

  // About
  aboutTitle: "Über KItchenOS",
  aboutLead:
    "Wir glauben, dass Kantinen, Kliniken und Schul-Mensen die gleiche Software-Qualität verdienen wie Hotels und Restaurants — und mehr Compliance.",
  aboutP1:
    "KItchenOS wurde 2025 in Berlin gegründet, weil wir es satt hatten, Kliniken mit Klemmbrettern und Schulen mit Excel zu sehen, während die DGE-Standards und KassenSichV immer strenger werden. Jede Großküche — vom Krankenhaus bis zur Schul-Mensa — verdient Software, die für sie gemacht ist und nicht aus dem Restaurant-Markt zwangs-importiert wurde.",
  aboutP2:
    "Wir sind ein kleines, unabhängiges Team. Unsere Software wird in Deutschland entwickelt und auf Hetzner-Servern in Frankfurt gehostet. DSGVO-konform, ohne Tracking-Theater, ohne US-Cloud-Klauseln.",
  aboutP3:
    "Wir arbeiten direkt mit Hauswirtschafts-Leitungen, Verpflegungs-Direktoren und Caterern. Was Sie sehen, ist Software, die in echten Großküchen entsteht — nicht im Konferenzraum.",
  valuesTitle: "Was uns antreibt",
  v1Title: "Ehrlich",
  v1Body:
    "Keine Setup-Gebühren, keine Lock-in-Verträge, keine Tricks. Sie können jederzeit kündigen, Ihre Daten exportieren und gehen.",
  v2Title: "Praktisch",
  v2Body:
    "Jede Funktion entsteht aus einem echten Küchenproblem. Keine Buzzwords, keine Mockups — nur Software, die im Tagesbetrieb hält.",
  v3Title: "Schnell",
  v3Body:
    "Anfragen werden innerhalb eines Werktages beantwortet. Wir sind echte Menschen mit Telefonnummer.",

  // Contact
  contactTitle: "Kontakt",
  contactSub: "Wir antworten innerhalb eines Werktages.",
  contactEmail: "E-Mail",
  contactPhone: "Telefon",
  contactAddress: "Adresse",
  contactHours: "Geschäftszeiten",
  contactHoursVal: "Mo–Fr, 09:00–17:00 Uhr",
  imprintTitle: "Impressum",
  imprintBody:
    "KItchenOS GmbH, Beispielstraße 1, 10115 Berlin · HRB 000000 B · Geschäftsführer: Beispiel · USt-IdNr: DE000000000 · Verantwortlich i.S.d. § 18 Abs. 2 MStV: Beispiel.",

  // Demo launcher page
  demoPageTitle: "Demo starten",
  demoPageSub:
    "Einfach eine Demo öffnen — oder persönliche Demo-Führung anfragen.",
  demoInstantTitle: "Drei Betriebe, sofort live",
  demoInstantSub:
    "Wähle einen Demo-Betrieb und tauche direkt ein. Echter Datensatz, echte App — keine Registrierung nötig.",

  // Demo request form (kept below instant section)
  demoTitle: "Kostenlose Demo anfragen",
  demoSub:
    "30 Minuten. Kein Verkaufsgespräch. Sie sagen uns, was Sie brauchen — wir zeigen, ob es passt.",
  demoNameLabel: "Name",
  demoNamePh: "Anna Müller",
  demoCompanyLabel: "Unternehmen / Einrichtung",
  demoCompanyPh: "Musterkantine GmbH",
  demoEmailLabel: "E-Mail",
  demoEmailPh: "anna@beispiel.de",
  demoSizeLabel: "Mahlzeiten pro Tag",
  demoSizeOpt1: "bis 100",
  demoSizeOpt2: "100–400",
  demoSizeOpt3: "über 400",
  demoMsgLabel: "Was möchten Sie erreichen?",
  demoMsgPh: "Wir möchten unsere Vorbestellung digitalisieren …",
  demoSubmit: "Demo anfragen",
  demoSending: "Wird gesendet…",
  demoThanks: "Danke! Wir melden uns innerhalb eines Werktages.",
  demoError: "Senden fehlgeschlagen. Bitte später erneut versuchen oder uns per E-Mail schreiben.",

  // Downloads
  downloadsTitle: "Downloads & Ressourcen",
  downloadsSub:
    "Wir haben für Sie zwei direkt nutzbare Ressourcen vorbereitet — kostenlos, ohne Registrierung.",
  dl1Title: "Sales-E-Mail-Vorlagen",
  dl1Body:
    "8 deutsche Outreach-Templates, einsatzfertig — pro Segment der Verpflegungs-Branche (Schule, Kita, Klinik, Senioren, Betrieb, Catering, Hotel) plus Follow-up und Breakup-Mail.",
  dl1Cta: "PDF herunterladen",
  dl2Title: "Ziel-Liste · DE-B2B-Kontakte",
  dl2Body:
    "41 öffentlich bekannte Operator und Träger in DACH — Großcaterer, Klinik-Konzerne, Pflege-Ketten, Studierendenwerke, Hotel-Gruppen, Behörden — mit Segment, Größe, Kontakt-Pfad und Begründung.",
  dl2Cta: "PDF herunterladen",
  dlFootnote:
    "Quelle: öffentlich verfügbare Unternehmens-Webseiten und Geschäftsberichte. Personenbezogene Kontakte bewusst weggelassen — recherchieren Sie im LinkedIn Sales Navigator oder Apollo, sobald Sie die Einrichtung priorisiert haben.",

  // Footer
  footerRights: "© 2026 KItchenOS. Alle Rechte vorbehalten.",
  footerImprint: "Impressum",
  footerPrivacy: "Datenschutz",
  contactTitleFooter: "Kontakt",
};

const en: Dict = {
  brand: "KItchenOS",
  tagline: "The smart platform for institutional kitchens and catering",
  navHome: "Home",
  navFeatures: "Features",
  navOperators: "For Operators",
  navCompare: "Compare",
  navStandards: "Standards",
  navHardware: "Hardware",
  navPricing: "Pricing",
  navAbout: "About",
  navContact: "Contact",
  navDownloads: "Downloads",
  navDemo: "Request Demo",
  navApp: "Open App",
  navAppPreorder: "Pre-order Portal",
  navAppPreorderDesc: "Online ordering for guests",
  navAppDemo: "App Demo",
  navAppDemoDesc: "Try the full canteen app",
  navAppNote: "Opens in a new window",

  // Hardware comparison page (iPad vs Android)
  hwTitle: "Which tablet fits your kitchen?",
  hwSub: "iPad or Android — at contract signing you choose the platform that suits your operation.",
  hwTagline: "Both platforms run the same KItchenOS app. All data lives in the EU cloud — the tablet is just the window into your kitchen.",

  hwCloudTitle: "Cloud-First: your data is never trapped on the tablet",
  hwCloudBody: "Orders, inventory, HACCP logs, recipes and revenue are stored encrypted in real time in our EU cloud (Frankfurt). The tablet is interchangeable — if it fails, the replacement device takes over within minutes with no data loss.",
  hwCloudPoint1: "AES-256 encrypted, hosted in the EU (Frankfurt)",
  hwCloudPoint2: "Daily automatic backups, 30-day retention",
  hwCloudPoint3: "Tablet swap in under 5 minutes — sign in, done",
  hwCloudPoint4: "GDPR compliant incl. data processing agreement (DPA)",

  hwIpadHead: "iPad (Apple)",
  hwIpadIntro: "The premium choice. Best display, Apple ecosystem, excellent MDM integration via Apple Business Manager. Ideal for upscale restaurants and hotels.",
  hwAndroidHead: "Android Tablet (Samsung)",
  hwAndroidIntro: "The rugged choice. Galaxy Tab Active with IP68 certification withstands steam, water, drops. Cheaper and better suited for kitchen reality.",
  hwRecBadge: "Kitchen Pick",

  hwLabelDevice: "Device",
  hwLabelMdm: "MDM solution",
  hwLabelHwCost: "Hardware",
  hwLabelMonthly: "Management",
  hwIpadDevice: "iPad 10.9″ (10th Gen)",
  hwIpadMdmName: "Jamf School / Mosyle",
  hwIpadCost: "from €499",
  hwIpadMonthly: "approx. €5/month",
  hwAndroidDevice: "Galaxy Tab Active5",
  hwAndroidMdmName: "Android Enterprise / Samsung Knox",
  hwAndroidCost: "from €379",
  hwAndroidMonthly: "approx. €3/month",

  hwTableTitle: "Detailed comparison",
  hwColCriterion: "Criterion",
  hwColIpad: "iPad",
  hwColAndroid: "Android Tablet (rugged)",
  hwTableLegend: "Rating per row relative to the other platform for use in commercial kitchens.",
  hwScoreBest: "Clear advantage",
  hwScoreGood: "Good",
  hwScoreOk: "Acceptable with caveats",

  hwRowDurability: "Durability",
  hwRowDurabilityDetail: "Protection against water, steam, drops, heat",
  hwIpadDurability: "Glass display, no IP rating — protective case strongly recommended",
  hwAndroidDurability: "IP68 certified, MIL-STD-810H, survives 1.5 m drop",

  hwRowPrice: "Purchase price",
  hwRowPriceDetail: "Hardware cost per tablet",
  hwIpadPrice: "iPad from €499, case €60–120",
  hwAndroidPrice: "Galaxy Tab Active5 from €379 — protection included",

  hwRowMdm: "Device management (MDM)",
  hwRowMdmDetail: "Remote configuration, single-app mode, zero-touch setup",
  hwIpadMdm: "Apple Business Manager + Jamf — industry-leading, mature",
  hwAndroidMdm: "Android Enterprise + Knox — solid, slightly more configuration",

  hwRowPwa: "PWA support in browser",
  hwRowPwaDetail: "Local storage, offline capability, push notifications",
  hwIpadPwa: "Safari deletes data after 7 days of inactivity — cloud sync mandatory",
  hwAndroidPwa: "Chrome retains data indefinitely, full PWA functionality",

  hwRowVoice: "Voice control (Kios)",
  hwRowVoiceDetail: "Web Speech API for hands-free operation",
  hwIpadVoice: "Works, with minor Safari audio quirks",
  hwAndroidVoice: "Chrome implements the full Web Speech API reliably",

  hwRowDisplay: "Display quality",
  hwRowDisplayDetail: "Color accuracy, brightness, readability",
  hwIpadDisplay: "Retina display, 500 nits, excellent color reproduction",
  hwAndroidDisplay: "TFT, 450 nits, good readability even in sunlight",

  hwRowBattery: "Battery life",
  hwRowBatteryDetail: "Duration of a service day",
  hwIpadBattery: "Up to 10 hours of normal use",
  hwAndroidBattery: "Replaceable battery — continuous operation possible",

  hwRowService: "Service & repair in DE",
  hwRowServiceDetail: "Availability of spare parts and workshops",
  hwIpadService: "Apple Stores in every major city, AppleCare optional",
  hwAndroidService: "Samsung service partners nationwide, express swap",

  hwRowImage: "Brand perception",
  hwRowImageDetail: "Perception by guests and staff",
  hwIpadImage: "Premium image, higher acceptance in upscale segment",
  hwAndroidImage: "Functional-pragmatic image, focus on durability",

  hwRowProcurement: "Public sector procurement",
  hwRowProcurementDetail: "Schools, hospitals, senior facilities",
  hwIpadProcurement: "Often part of framework agreements, but higher unit cost",
  hwAndroidProcurement: "Better approval rate with tight budgets",

  hwRecTitle: "When to pick which platform?",
  hwRec1Title: "Wet or harsh kitchen environment",
  hwRec1Body: "Commercial kitchen with steam, splashes, frequent cleaning, contact with stainless steel surfaces.",
  hwRec2Title: "Tight budget or public-sector buyer",
  hwRec2Body: "Schools, kindergartens, social institutions — lower purchase price and easier procurement.",
  hwRec3Title: "Existing Apple ecosystem",
  hwRec3Body: "You already use Macs, iPhones, Apple Business Manager — seamless integration.",
  hwRec4Title: "Premium restaurant or hotel",
  hwRec4Body: "Upscale ambiance, guest-facing operation, brand perception matters.",
  hwPickIpad: "Recommendation: iPad",
  hwPickAndroid: "Recommendation: Android Tablet",

  hwCtaTitle: "Unsure which fits your kitchen?",
  hwCtaBody: "We'll advise you free of charge and provide a test device on request. At contract signing, we choose the platform together.",
  ctaDemo: "Free demo",
  ctaDemoStart: "Try live demo",
  demoKantineTitle: "Munich canteen",
  demoKantineDesc: "Lunch service, ~200 portions/day",
  demoSchuleTitle: "Organic school cafeteria",
  demoSchuleDesc: "Vegan/vegetarian, DGE standard",
  demoCateringTitle: "Event catering",
  demoCateringDesc: "Events business with forecasting",

  // Demo launcher page (EN)
  demoPageTitle: "Try the demo",
  demoPageSub:
    "Jump straight in — or request a guided walkthrough with our team.",
  demoInstantTitle: "Three operations, live right now",
  demoInstantSub:
    "Pick a demo operation and dive in. Real dataset, real app — no registration needed.",
  ctaStart: "Get started",
  ctaTalk: "Talk to us",
  langSwitch: "DE",

  heroBadge: "New 2026 · DGE · AI voice · fiscal POS",
  heroTitle: "One platform. Your whole kitchen. Fully compliant.",
  heroSub:
    "KItchenOS replaces Excel, clipboards, your POS and three other tools. DGE-compliant for schools, kindergartens, hospitals and senior care. With AI voice assistant, fiscal POS, EU-FIC labelling and real-time forecasting.",
  heroPoint1: "DGE quality standard automatically scored (unique in DACH)",
  heroPoint2: "Voice control hands-free — say 'Kios, daily close'",
  heroPoint3: "Fiskaly TSE POS + KassenSichV receipts + DSFinV-K export",
  heroPoint4: "EU-FIC compliant per dish — allergens straight from the recipe",
  socialProofTitle: "Why kitchen operators, caterers and trustees switch to KItchenOS",

  whyTitle: "Four problems only KItchenOS solves",
  whySub:
    "Each of these features wins tenders, MDK audits and the daily routine. Other SaaS tools cover one, maybe two of them. KItchenOS has all four.",
  why1Title: "Live DGE score & PDF certificate",
  why1Body:
    "We score your menu live against the German DGE standard for school, kindergarten, hospital or senior care — score, recommendations, ready-to-print certificate. No other DACH platform does this.",
  why2Title: "Voice assistant Kios — hands-free in the kitchen",
  why2Body:
    "Wet hands at the stove: 'Kios, start daily close' and the system waits for your numbers. Always-on hotword detection, German and English voices, no typing.",
  why3Title: "Fiscal POS built in",
  why3Body:
    "Fiskaly TSE signature, KassenSichV-compliant receipts, DSFinV-K tax export. No second POS, no double item maintenance, no broken integrations.",
  why4Title: "One source of truth for everything",
  why4Body:
    "Recipe, allergens, nutrition, costing, POS, posters and EU-FIC labels — all from one source. Other vendors need three tools.",

  statsTitle: "What operators achieve in year one",
  stat1: "−18%",
  stat1Label: "Food waste",
  stat2: "−4 hrs",
  stat2Label: "Admin per week",
  stat3: "+22%",
  stat3Label: "Order acceptance",
  stat4: "100%",
  stat4Label: "DGE & EU-FIC audit-ready",

  testimonialBody:
    "Our housekeeping lead saved ten hours in the first week — and the DGE proof for the city was a single click. We wouldn't have believed it without seeing it ourselves.",
  testimonialAuthor: "Catering Director, North Hospital Group",

  finalCtaTitle: "Ready to retire Excel and the clipboard?",
  finalCtaSub:
    "30-minute demo — we show DGE score, voice control and the fiscal POS on your real weekly menu.",

  featuresTitle: "Features",
  featuresSub:
    "Everything an institutional kitchen needs in 2026 — from AI assistant to fiscal POS.",
  fGroup1Title: "Compliance & Quality",
  fGroup2Title: "Daily ops",
  fGroup3Title: "Kitchen & production",
  fGroup4Title: "Purchasing, inventory & forecast",
  fGroup5Title: "Guests, sales & CRM",
  fGroup6Title: "Insights, reports & multi-site",

  fDgeTitle: "DGE score & certificate",
  fDgeBody:
    "Live 0–100 score against the DGE standards for school, kindergarten, hospital or senior care. Daily recommendations, PDF certificate for trustees and audits.",
  fLmivTitle: "EU-FIC poster per dish",
  fLmivBody:
    "Print-ready poster with allergens, additives and nutrition — generated straight from the recipe. Parent-friendly version for school and kindergarten in one click.",
  fHaccpTitle: "HACCP digitised",
  fHaccpBody:
    "Cold-chain logging via Bluetooth sensor, cleaning checklists with photo proof, sample retention with label print and 7-day reminders — DIN compliant.",
  fOkoTitle: "Organic / eco wizard",
  fOkoBody:
    "Live organic share per component. Organic supplier list, certification tiers (bronze/silver/gold), automatic reports for trustees and ESG submissions.",

  fKiosTitle: "Voice assistant Kios",
  fKiosBody:
    "Always-on hotword detection. Say 'Kios, daily close', 'Kios, create order XY', 'Kios, what's my DGE score'. Hands-free, German and English.",
  fKasseTitle: "Fiskaly TSE POS",
  fKasseBody:
    "KassenSichV-compliant receipts, TSE signature, DSFinV-K export, daily Z-report. Pairs with hotel POS or stand-alone — no third party needed.",
  fZettleTitle: "Zettle Z-report sync",
  fZettleBody:
    "If you already use Zettle/SumUp: real-time sales sync, no double entry, automatic Z-report capture.",
  fSchichtTitle: "Shift handover & roster",
  fSchichtBody:
    "Structured handover notes between shifts. Roster with shift wishes, sick leave and shift swaps — directly on the smartphone.",
  fTagesTitle: "Daily close in 90 seconds",
  fTagesBody:
    "Per dish: cooked / sold / leftovers. Capture window prevents manipulation. Live aggregate across multiple sites.",

  fProdTitle: "Production & sample retention",
  fProdBody:
    "Pack plan from the weekly menu. Sample retention labels with date, batch and 7-day reminder. Photo proof per sample.",
  fRezepteTitle: "AI cookbook (150+ classics)",
  fRezepteBody:
    "German, Italian, French, Asian, BBQ. Quantities, allergens and nutrition computed automatically — also for vegan, vegetarian and special-diet versions.",
  fScanTitle: "Scan — label, barcode, product",
  fScanBody:
    "Photograph the product → AI recognises article, manufacturer, allergens. Scan deliveries in instead of typing them.",
  fReinigungTitle: "Cleaning plan & HACCP checklists",
  fReinigungBody:
    "Daily, weekly and monthly cleaning plans per zone. Photo proof, owner, timestamp — exportable to authorities on request.",

  fLagerTitle: "Inventory with min-stock & best-before",
  fLagerBody:
    "Live stock per site. Min-stock triggers an order draft. Best-before early warnings to the kitchen — before waste happens.",
  fBestellTitle: "Orders direct to suppliers",
  fBestellBody:
    "Drafts via email or PDF in one click. Supplier master with conditions, MOQ and delivery days.",
  fForecastTitle: "AI forecast (weather, weekday, presence)",
  fForecastBody:
    "Forecasts portions per dish from history plus external factors. Typically reduces guessing error by 60%.",
  fPriceTitle: "Price server & costing",
  fPriceBody:
    "Live food cost per component. Price suggestion per dish from margin, overhead and VAT. Gross selling price automatic.",

  fVorbestTitle: "Pre-order with 08:00 cutoff",
  fVorbestBody:
    "QR code at the entrance, no app install. Staff, parents or residents pre-order — kitchen gets the aggregate at 08:01.",
  fCrmTitle: "CRM with Outlook lead capture",
  fCrmBody:
    "Inbox enquiries land as leads in CRM. Notes, follow-ups, event history per contact — catering becomes structured.",
  fCateringTitle: "Catering & event plan",
  fCateringBody:
    "Lead times, delivery windows, pack plan and EU-FIC labels per component — all generated from one event order.",
  fSchulkontoTitle: "School account / BuT-compliant",
  fSchulkontoBody:
    "Parent account with consolidated invoicing, automatic SEPA direct debit and education/participation interface (BuT/RKSH).",

  fStatsTitle: "Live statistics (tab)",
  fStatsBody:
    "Daily revenue, top dishes, waste rate, food cost trend, margin — dashboard for management. Drill down by tap.",
  fReportsTitle: "Reports (bank, trustee, tender)",
  fReportsBody:
    "Templates for bank report (loan negotiation), trustee report (school/hospital) and tender (DGE score + organic share + allergen statistics).",
  fLocationsTitle: "Multi-site & roll-up",
  fLocationsBody:
    "One platform for several canteens, homes or caterers. Data separation, shared analytics. Roll-up aggregate across sites.",
  fTabletTitle: "Tray photo waste analysis",
  fTabletBody:
    "Care staff photographs returns — AI recognises 'vegetables 70% returned'. Real-time insight into which components miss.",

  compareTitle: "KItchenOS vs. the market",
  compareSub:
    "We've put ourselves honestly next to Apicbase, Foodics, MarketMan and Choco. Here's where we win — and where we deliberately do something different.",
  compareWhy:
    "Other platforms were born in restaurants and try to adapt to institutional kitchens. KItchenOS was built from day one for school, hospital, senior care and catering — with German compliance at the core.",
  compareCol1: "Feature",
  compareCol2: "KItchenOS",
  compareCol3: "Apicbase",
  compareCol4: "Foodics",
  compareCol5: "MarketMan",
  compareCol6: "Choco",
  compareYes: "Yes",
  compareNo: "No",
  compareLimited: "Limited",
  compareRow1: "DGE score (DE)",
  compareRow2: "EU-FIC label per dish",
  compareRow3: "HACCP digital + retention sample",
  compareRow4: "KassenSichV/TSE (Fiskaly)",
  compareRow5: "DSFinV-K export (DE tax)",
  compareRow6: "Voice assistant (DE/EN)",
  compareRow7: "Organic / EU 2018/848 wizard",
  compareRow8: "Per-resident diet profile",
  compareRow9: "Tray photo waste analysis",
  compareRow10: "School allowance / BuT account",
  compareRow11: "Pre-order with 08:00 cutoff",
  compareRow12: "Supplier ordering & EDI",
  compareRow13: "AI forecast (weather + attendance)",
  compareRow14: "AI recipe book (150+ classics)",
  compareRow15: "Catering CRM + Outlook lead capture",
  compareRow16: "Multi-site & roll-up reporting",
  compareRow17: "GDPR + hosting EU/DE",
  compareLegend:
    "Yes: fully integrated · Limited: via add-on/third party · No: not available.",
  compareLegendNote:
    "As of 2026, based on publicly available product pages.",
  compareSummaryTitle: "When to pick which?",
  compareSummary1Title: "Pick KItchenOS if …",
  compareSummary1Body:
    "You run an institutional kitchen, canteen, hospital, senior home or catering operation in DACH; need to comply with DGE, KassenSichV and EU-FIC; want German voice control in the daily routine; and don't want three tools that don't talk to each other.",
  compareSummary2Title: "Pick Apicbase if …",
  compareSummary2Body:
    "You run a chain with > 50 sites in multiple countries, mainly restaurant operations and no German compliance need.",
  compareSummary3Title: "Pick Foodics or MarketMan if …",
  compareSummary3Body:
    "You run a classic quick-service restaurant in MENA (Foodics) or North America (MarketMan).",
  compareSummary4Title: "Pick Choco if …",
  compareSummary4Body:
    "You only need a tool for ordering from suppliers — and not a platform that covers everything else.",

  standardsTitle: "Compliance, in every line",
  standardsSub:
    "KItchenOS isn't a marketing promise but a compliance system. Here are the standards we cover — with the corresponding module.",
  std1Title: "DGE quality standard",
  std1Body:
    "School, kindergarten, hospital, senior — all four standards of the German Nutrition Society implemented in the scoring engine. Live score, recommendations, PDF certificate.",
  std1Tag: "DGE",
  std2Title: "EU-FIC / EU Reg. 1169/2011",
  std2Body:
    "14 main allergens plus additives detected automatically. Poster per dish, parent-friendly text, symbol legend. Required font sizes respected.",
  std2Tag: "EU-FIC",
  std3Title: "HACCP / DIN 10514, DIN 10516",
  std3Body:
    "Cold-chain logging (Bluetooth sensor optional), cleaning checklists with photo proof, retention sample labels with 7-day reminders. Audit trail immutable.",
  std3Tag: "HACCP",
  std4Title: "KassenSichV / TSE / DSFinV-K",
  std4Body:
    "Fiskaly-certified TSE signature. KassenSichV-compliant receipts with QR code. DSFinV-K export for tax authority audits.",
  std4Tag: "TSE",
  std5Title: "EU Organic Regulation 2018/848",
  std5Body:
    "Organic component tracking, supplier certificate management, labelling tiers bronze/silver/gold along Bavarian organic seal system.",
  std5Tag: "BIO",
  std6Title: "GDPR",
  std6Body:
    "Hosted in Germany (Hetzner Frankfurt). Data processing agreement (DPA) included. Data export, right to erasure, no tracking. Parent data extra-protected.",
  std6Tag: "GDPR",
  std7Title: "BuT / Education and participation",
  std7Body:
    "School canteen invoicing via BuT card and RKSH interface. Consolidated invoicing to trustee or municipal admin.",
  std7Tag: "BuT",
  std8Title: "Climate / ESG reporting",
  std8Body:
    "CO₂ footprint per dish (Eaternity database), organic share, animal/plant ratio, regional share. Export for parent-company ESG reporting.",
  std8Tag: "ESG",

  opTitle: "For institutional operators",
  opSub:
    "Six segments, six workflows, one platform. KItchenOS is built from day one for school, hospital, senior care, corporate, catering and hotel.",
  opCanteenTitle: "Corporate & factory canteens",
  opCanteenBody:
    "Pre-orders by 08:00, AI forecast from presence data, consolidated invoicing to employer, ESG metrics for the parent group's report.",
  opSchoolTitle: "Schools & kindergartens",
  opSchoolBody:
    "Live DGE score, parent pre-order, diet filters (vegan, gluten-free, halal, kosher), BuT-compliant invoicing.",
  opCareTitle: "Hospitals & clinics",
  opCareBody:
    "DGE clinic standard, bedside pre-order on tablet, MDK-audit ready, HACCP digital. Integrates with SAP IS-H, Orbis, Medico.",
  opSeniorTitle: "Senior & care homes",
  opSeniorBody:
    "Diet profile per resident (dysphagia, diabetes, renal, vegan, halal). Tray label with allergen icons. DGE senior standard.",
  opCateringTitle: "Catering & events",
  opCateringBody:
    "Outlook lead capture, automated pack plan, EU-FIC labels per component, multi-site and consolidated invoicing for repeat business clients.",
  opHotelTitle: "Hotel & conference restaurant",
  opHotelBody:
    "One recipe DB for restaurant, breakfast, half-board and conference catering. PMS integration for breakfast forecast (Apaleo, Mews, Protel).",
  opStatTitle: "What operators achieve in year one",
  opStat1: "−18%",
  opStat1Label: "Food waste",
  opStat2: "+22%",
  opStat2Label: "Order acceptance",
  opStat3: "−4 hrs",
  opStat3Label: "Admin per week",
  opStat4: "100%",
  opStat4Label: "DGE & EU-FIC audit-ready",

  pricingTitle: "Fair pricing",
  pricingSub:
    "No setup fee. No hidden costs. Monthly cancellation. GDPR-compliant, hosted in Frankfurt.",
  planStarter: "Starter",
  planStarterPrice: "€89",
  planStarterDesc: "For one canteen up to 100 meals/day",
  planPro: "Professional",
  planProPrice: "€189",
  planProDesc: "For one canteen up to 400 meals/day",
  planEnterprise: "Enterprise",
  planEnterprisePrice: "On request",
  planEnterpriseDesc: "Multi-site, custom domain, SLA, on-premise possible",
  planMonth: "/month",
  feat1: "Digital menu + QR codes",
  feat2: "Pre-orders & 08:00 cutoff",
  feat3: "Mobile kitchen app + voice assistant",
  feat4: "EU-FIC allergen labelling",
  feat5: "DGE score & certificate",
  feat6: "Fiskaly TSE POS",
  feat7: "Multiple sites",
  feat8: "Custom domain & API access",
  feat9: "Personal onboarding manager",
  pickPlan: "Choose plan",

  aboutTitle: "About KItchenOS",
  aboutLead:
    "We believe canteens, hospitals and school kitchens deserve the same software quality as hotels and restaurants — and more compliance.",
  aboutP1:
    "KItchenOS was founded in Berlin in 2025 because we were tired of seeing hospitals on clipboards and schools on Excel while DGE standards and KassenSichV get stricter every year. Every institutional kitchen — from a hospital to a school cafeteria — deserves software actually built for it, not force-imported from the restaurant world.",
  aboutP2:
    "We are a small, independent team. Our software is built in Germany and hosted on Hetzner servers in Frankfurt. GDPR-compliant, no tracking theatre, no US cloud clauses.",
  aboutP3:
    "We work directly with housekeeping leads, catering directors and caterers. What you see is software born in real institutional kitchens — not in a meeting room.",
  valuesTitle: "What drives us",
  v1Title: "Honest",
  v1Body:
    "No setup fees, no lock-in contracts, no gotchas. Cancel anytime, export your data and walk away.",
  v2Title: "Practical",
  v2Body:
    "Every feature comes from a real kitchen problem. No buzzwords, no mockups — just software that holds up in daily operations.",
  v3Title: "Fast",
  v3Body:
    "Inquiries answered within one working day. We're real people with a phone number.",

  contactTitle: "Contact",
  contactSub: "We answer within one working day.",
  contactEmail: "Email",
  contactPhone: "Phone",
  contactAddress: "Address",
  contactHours: "Hours",
  contactHoursVal: "Mon–Fri, 09:00–17:00",
  imprintTitle: "Imprint",
  imprintBody:
    "KItchenOS GmbH, Beispielstraße 1, 10115 Berlin · HRB 000000 B · Managing Director: Sample · VAT ID: DE000000000 · Responsible per § 18 (2) MStV: Sample.",

  demoTitle: "Request a free demo",
  demoSub: "30 minutes. No sales pitch. You tell us what you need — we show whether it fits.",
  demoNameLabel: "Name",
  demoNamePh: "Anna Müller",
  demoCompanyLabel: "Company / facility",
  demoCompanyPh: "Sample Canteen GmbH",
  demoEmailLabel: "Email",
  demoEmailPh: "anna@example.com",
  demoSizeLabel: "Meals per day",
  demoSizeOpt1: "up to 100",
  demoSizeOpt2: "100–400",
  demoSizeOpt3: "above 400",
  demoMsgLabel: "What are you trying to achieve?",
  demoMsgPh: "We want to digitise our pre-order flow …",
  demoSubmit: "Request demo",
  demoSending: "Sending…",
  demoThanks: "Thanks! We'll get back to you within one working day.",
  demoError: "Could not send. Please try again later or email us.",

  downloadsTitle: "Downloads & resources",
  downloadsSub:
    "We've prepared two ready-to-use resources for you — free, no signup.",
  dl1Title: "Sales email templates",
  dl1Body:
    "8 German outreach templates ready to send — per segment of the institutional kitchen industry (school, kindergarten, hospital, senior, corporate, catering, hotel) plus follow-up and breakup mail.",
  dl1Cta: "Download PDF",
  dl2Title: "Target list · DE B2B contacts",
  dl2Body:
    "41 publicly known operators and trustees in DACH — large caterers, hospital groups, care chains, university unions, hotel groups, government — with segment, size, contact path and rationale.",
  dl2Cta: "Download PDF",
  dlFootnote:
    "Source: publicly available company websites and annual reports. Personal contacts deliberately omitted — research them in LinkedIn Sales Navigator or Apollo once you've prioritised the institution.",

  footerRights: "© 2026 KItchenOS. All rights reserved.",
  footerImprint: "Imprint",
  footerPrivacy: "Privacy",
  contactTitleFooter: "Contact",
};

const dicts: Record<Lang, Dict> = { de, en };

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: keyof typeof de) => string };
const I18nCtx = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("kitchenos-lang") : null;
    return (stored === "en" || stored === "de") ? stored : "de";
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("kitchenos-lang", lang);
      document.documentElement.lang = lang;
    }
  }, [lang]);
  const t = (k: keyof typeof de) => dicts[lang][k] ?? String(k);
  return <I18nCtx.Provider value={{ lang, setLang, t }}>{children}</I18nCtx.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nCtx);
  if (!ctx) throw new Error("useI18n outside provider");
  return ctx;
}
