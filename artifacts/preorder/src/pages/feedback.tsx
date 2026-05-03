import { useRoute, useLocation } from "wouter";
import { useEffect, useMemo, useState } from "react";
import { Star, ChevronLeft, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

interface Ratings {
  foodQuality: number;
  service: number;
  variety: number;
  value: number;
  cleanliness: number;
  ambience: number;
}

const CRITERIA: Array<{ key: keyof Ratings; de: string; en: string }> = [
  { key: "foodQuality", de: "Essensqualität", en: "Food quality" },
  { key: "service", de: "Service", en: "Service" },
  { key: "variety", de: "Auswahl", en: "Variety" },
  { key: "value", de: "Preis-Leistung", en: "Value" },
  { key: "cleanliness", de: "Sauberkeit", en: "Cleanliness" },
  { key: "ambience", de: "Ambiente", en: "Ambience" },
];

interface MenuLite {
  locationCode: string;
  locationName: string;
}

export default function Feedback() {
  const [, params] = useRoute("/feedback/:locationCode");
  const locationCode = params?.locationCode || "";
  const [, setLocation] = useLocation();

  const [menu, setMenu] = useState<MenuLite | null>(null);
  const [ratings, setRatings] = useState<Ratings>({
    foodQuality: 0,
    service: 0,
    variety: 0,
    value: 0,
    cleanliness: 0,
    ambience: 0,
  });
  const [comment, setComment] = useState("");
  const [guestName, setGuestName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!locationCode) return;
    fetch(`/api/preorder/menu/${encodeURIComponent(locationCode)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => setMenu(m ? { locationCode: m.locationCode, locationName: m.locationName } : null))
      .catch(() => setMenu(null));
  }, [locationCode]);

  const allFilled = useMemo(
    () => Object.values(ratings).every((v) => v >= 1 && v <= 5),
    [ratings],
  );

  const submit = async () => {
    if (!allFilled) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/preorder/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationCode,
          ratings,
          comment: comment.trim() || null,
          guestName: guestName.trim() || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Failed");
      }
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-6 bg-background">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center max-w-md"
        >
          <motion.div
            initial={{ rotate: -20, scale: 0 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 12 }}
            className="mx-auto mb-6 w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center"
          >
            <CheckCircle2 className="w-12 h-12 text-primary" />
          </motion.div>
          <h2 className="text-3xl mb-3">Vielen Dank!</h2>
          <p className="text-muted-foreground mb-2">Thank you for your feedback.</p>
          <p className="text-sm text-muted-foreground/80 mb-8">
            Ihre Bewertung hilft uns, besser zu werden.
            <br />
            Your rating helps us improve.
          </p>
          <Button onClick={() => setLocation(`/menu/${locationCode}`)} variant="outline">
            Zurück zur Speisekarte / Back to menu
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] pb-32 bg-background flex flex-col">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border p-4 pt-8">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation(`/menu/${locationCode}`)}
            data-testid="button-back"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-primary uppercase tracking-wider">
              {locationCode}
            </p>
            <h1 className="text-2xl truncate">
              {menu?.locationName ?? "Bewertung / Feedback"}
            </h1>
            <p className="text-sm text-muted-foreground font-serif italic mt-0.5">
              Wie war's bei uns? / How was it?
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-xl w-full mx-auto p-4 space-y-6">
        <div className="bg-card rounded-2xl border border-border p-5 space-y-5 shadow-sm">
          {CRITERIA.map((c) => (
            <CriterionRow
              key={c.key}
              label={`${c.de} / ${c.en}`}
              value={ratings[c.key]}
              onChange={(v) => setRatings((prev) => ({ ...prev, [c.key]: v }))}
            />
          ))}
        </div>

        <div className="bg-card rounded-2xl border border-border p-5 space-y-4 shadow-sm">
          <div>
            <label className="text-sm font-medium block mb-2">
              Name (optional)
            </label>
            <input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              maxLength={60}
              placeholder="Anna"
              className="w-full px-4 py-2.5 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
              data-testid="input-guest-name"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-2">
              Kommentar / Comment
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={500}
              rows={4}
              placeholder="Was hat Ihnen gefallen? Was können wir verbessern?"
              className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              data-testid="textarea-comment"
            />
            <p className="text-xs text-muted-foreground/70 mt-1">{comment.length}/500</p>
          </div>
        </div>

        {error ? (
          <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">{error}</div>
        ) : null}
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t border-border p-4">
        <div className="max-w-xl mx-auto">
          <Button
            onClick={submit}
            disabled={!allFilled || submitting}
            className="w-full h-14 text-lg"
            data-testid="button-submit"
          >
            {submitting
              ? "Wird gesendet…"
              : allFilled
                ? "Bewertung absenden / Submit"
                : "Bitte alle Kriterien bewerten"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CriterionRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium mb-2">{label}</p>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className="p-1 transition-transform active:scale-90"
            data-testid={`star-${label}-${n}`}
            aria-label={`${n} Sterne`}
          >
            <Star
              className={`w-9 h-9 ${
                n <= value
                  ? "fill-primary text-primary"
                  : "text-muted-foreground/30"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
