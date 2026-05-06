---
title: "KItchenOS — Video Style Guide & Prompt Library"
generated: 2026-05-05
audience: AI video generators (Sora, Veo, Runway, Pika, Kling), video editors, social media managers
---

# KItchenOS — Video Style Guide & Prompt Library

Дeкларира как трябва да изглежда **всяко** видео, което излиза с името KItchenOS — независимо дали е генерирано от AI (Sora, Veo, Runway, Pika), снимано на телефон, или сглобено в After Effects.

---

## 1. BRAND DNA — единните 5 правила

| # | Правило | Как изглежда конкретно |
|---|---|---|
| 1 | **Документално, не реклaмно** | Истински кухни в работа, не студио. Светлина на прозорец, не softbox. Лек кадрираж, не perfect-grid. |
| 2 | **Compliance-first** | Винаги покажи нещо, което е "доказателство" — DGE-PDF, температурен лог, етикет с алергени. |
| 3 | **Мобилно първо** | 70 % от кадрите са вертикални (9:16). Hero видеата за уебсайта — 16:9. |
| 4 | **Без английски жаргон** | Гласът и текстът са на немски. Английски само за интернационални LinkedIn кампании. |
| 5 | **Тих звук, силна типография** | Без upbeat синтезатори. Меки piano/string подложки + ясни sans-serif текстови карти. |

---

## 2. ВИЗУАЛНА ИДЕНТИЧНОСТ

### Цветова палитра
- **Primary brand:** `#FF3C00` (vivid orange-red — лого, акценти, CTA бутони)
- **Secondary accent:** `#F59E0B` (amber — UI hover, графики)
- **Ink (текст):** `#0A0A0B` (графитно черно)
- **Off-white:** `#FAFAFA` (фон, не чисто бяло)
- **Muted:** `#64748B` (subtitle, captions)

### Шрифтове
- **Headline:** Inter Bold или Geist Bold, голям размер, плътна kerning.
- **Body / captions:** Inter Regular, line-height 1.4.
- **Никога:** comic-sans, script-fonts, all-caps декоративни.

### Логo usage в видео
- В долен-десен ъгъл, 64-128 px на 1080p, прозрачност 80 %.
- На първия и последния кадър — централно, плътно 100 %.
- Никога върху лица, храна или важна информация.

---

## 3. КАМЕРА & КАДРИ

### Кадрова граматика
- **Wide establishing:** кухнята отдалеч, статика, 2-3 секунди — задава мащаба.
- **Medium working:** готвач във фокус, ръце в действие — носи историята.
- **Macro detail:** ръка слага термометър в супата, пръст докосва екрана на таблет — носи "доказателството".
- **UI insert:** screenshot от приложението, наложен half-screen или picture-in-picture.

**Правило 3-3-1:** 3 wide → 3 working → 1 UI insert. Повторение на този ритъм създава познаваем стил.

### Движение
- Бавни, мотивирани pan & tilt (макс. 5 °/сек).
- Никакви whip-pans, glitch-cuts, speed-ramps.
- Слайдер по 30-50 cm при готвач — фокусира действието.
- Drone само за wide establishing на голяма мензa или болница, и то нисък полет (под 10 m).

### Светлина
- **Естествена > изкуствена.** Прозоречна светлина отстрани, soft, с малко контра.
- Цветна температура: 4500-5500 K (натурално дневно).
- Никакви студийни softbox-и; ако е необходимо — 1× LED panel със CTO gel.

---

## 4. СТРУКТУРА НА ВИДЕОТО (3 формата)

### 4.1 Hero видео (16:9, 30-60 сек, за уебсайт + LinkedIn)
```
0-3 сек   Wide establishing на работеща кухня + лого fade-in
3-8 сек   Проблем, casual в немски глас off ("In jeder Küche dasselbe Problem...")
8-25 сек  Решение в 3 къси сегмента (DGE / HACCP / Vorbestellung), всеки 5-7 сек
25-50 сек Резултат с конкретно число (—18 % Foodwaste), на екран
50-60 сек CTA: "kitchenos.de/app/?demo=schule" + лого hold
```

### 4.2 Reels / TikTok / Shorts (9:16, 15-30 сек)
```
0-2 сек   Hook — една шокираща реалност ("4 Stunden pro Woche für Excel — pro Schule")
2-15 сек  3 бързи кадра, всеки 4 сек, всеки с UI insert
15-25 сек One-line solution + screenshot на резултата
25-30 сек CTA + лого
```

### 4.3 Demo / case study (16:9, 90-120 сек, за sales pipeline)
```
0-10 сек  Кухнята + представяне на лицето (име, длъжност, среда)
10-60 сек Интервю в B-roll стил, 2 въпроса:
            "Wie war es vorher?" → 25 сек
            "Was hat sich konkret geändert?" → 25 сек
60-90 сек Конкретни числа и UI screenshots
90-120 сек CTA + лого
```

---

## 5. AI VIDEO PROMPTS — копи-пейст готови

Универсална формула: `[стил] + [сцена] + [движение] + [светлина] + [кадраж] + [негативни]`

### 5.1 Hero видео — отваряща сцена
```
Documentary-style cinematic shot of a busy professional German canteen kitchen
during morning prep. A chef in a clean white apron places a vegetable tray into a
stainless steel oven. Natural soft window light from the left. Camera: slow
4-second dolly-in from medium-wide to medium shot. Color palette: warm amber
highlights, charcoal shadows, off-white walls. Real, unstaged, no actors looking
at camera. Shot on a cinema camera, 35mm equivalent, shallow depth of field.

Negative: studio lighting, glossy reflections, multiple cuts, fast motion,
neon colors, animated graphics, watermark, text overlay, lens flare, slow-motion.

Aspect: 16:9. Duration: 6 sec. Resolution: 1080p.
```

### 5.2 Compliance B-roll (DGE / HACCP)
```
Macro close-up of a hand placing a small Bluetooth thermometer probe into the
center of a steaming pot of soup in a professional German hospital kitchen. In
the background, slightly out of focus, a tablet screen shows a clean charcoal-
and-amber dashboard with a temperature graph. Natural daylight. Camera: locked
off, 4 seconds, no movement. Photorealistic, documentary, calm.

Negative: cartoonish, animated UI, 3D render, gaming aesthetic, dramatic music
implied, rapid cuts.

Aspect: 16:9. Duration: 4 sec.
```

### 5.3 Vorbestellung — гост сценарий
```
Over-the-shoulder shot of a parent in everyday clothes scanning a QR code
displayed on a small wooden sign at a German school entrance using a modern
smartphone. The phone screen shows a clean orange-and-white pre-order menu in
German. Soft morning light, blurred background of children walking to class.
Camera: handheld, very subtle movement, 5 seconds.

Negative: stock-photo cliché, fake smiles, exaggerated reaction, branded
phone case, visible logos other than KItchenOS.

Aspect: 9:16. Duration: 5 sec.
```

### 5.4 KI-Sprach-Assistent (Kios)
```
Medium shot of a German chef working at a stainless steel prep table, hands
covered in flour, head turned slightly toward a small smart speaker on the
counter. The chef is mid-sentence, asking something casually. Steam rises from a
nearby pot. Warm afternoon kitchen light through a high window. Camera: static
medium shot, 4 seconds, no zoom.

Negative: actor mugging, exaggerated mouthing, futuristic neon, sci-fi UI,
robot voice visualization, sound waves on screen.

Aspect: 16:9. Duration: 4 sec.
```

### 5.5 Multi-Standort — sense of scale
```
Aerial top-down drone shot at low altitude (8 meters) over the courtyard of a
German university campus. Multiple students walking in different directions
toward two different cafeteria buildings. Late autumn afternoon, warm directional
light, long shadows, leaves on ground. Camera: very slow vertical descent, 6
seconds. No music implied. Documentary realism.

Negative: ultra-saturated grading, anamorphic lens flare, vehicle traffic,
crowds, summer foliage, vacation atmosphere.

Aspect: 16:9. Duration: 6 sec.
```

### 5.6 Catering-Event setup
```
Medium-wide shot of a small German catering team setting up a clean, minimalist
buffet for a corporate event in a converted Berlin loft space. Two people in
black aprons place LMIV allergen labels next to each dish. Natural light through
industrial windows. Camera: smooth slider move from left to right across the
buffet, 6 seconds. Soft warm color grade.

Negative: lavish wedding decoration, staged smiles, champagne towers, gold
tableware, dramatic chandelier, Christmas decoration, garlands.

Aspect: 16:9. Duration: 6 sec.
```

### 5.7 Resultat / Stat-карта (за края на видео)
```
Macro close-up of a chef's hand swiping across an iPad screen mounted on a
stainless steel kitchen wall. The screen displays a clean dashboard with the
large number "−18 % Foodwaste" in vivid orange-red on a dark charcoal background,
with a small line chart underneath. Natural overhead kitchen light. Camera:
locked off, no movement, 3 seconds.

Negative: animated typography, cartoonish chart, multiple competing numbers,
glitch effects, RGB neon glow, VR overlay.

Aspect: 16:9. Duration: 3 sec.
```

### 5.8 Vertical reel — 9:16 hook
```
Vertical handheld shot of a German school cafeteria worker holding a tablet,
showing the camera a screen with a green checkmark and the German text "DGE
100/100". Brief 2-second hold, then the worker smiles slightly and turns the
tablet away. Bright midday cafeteria light, blurred children in background.
Camera: stable handheld, no zoom, 5 seconds.

Negative: TikTok-style transitions, lip sync, dance, viral filter aesthetic,
fast cuts, color shift, exaggerated emotion.

Aspect: 9:16. Duration: 5 sec.
```

---

## 6. ТЕКСТ В ВИДЕОТО — типографски правила

### Текстови карти (chyrons / lower thirds)
- Position: долна третина, 8 % padding отстрани, 12 % padding отдолу.
- Font: Inter Bold за headline, Inter Regular за подложен текст.
- Color: `#FAFAFA` текст върху `#0A0A0B` 60 % opacity подложка.
- Time on screen: минимум 1.2 сек + 0.3 сек fade-in/out.
- Max 2 реда, max 7 думи на ред.

### CTA (винаги последен кадър, 2-3 сек)
```
[Лого 80 px центрирано]

DEMO TESTEN
kitchenos.de/app/?demo=schule

[Suffix: за коя сегмент е CTA-то]
```

---

## 7. ЗВУК

### Музика
- **Tempo:** 60-90 BPM. Никога над 100.
- **Жанр:** ambient piano, soft strings, leise indie-folk, нискокачествен lo-fi приемлив.
- **Без:** EDM, dubstep, corporate "uplifting" stock, tropical house, jazz lounge.
- **Източници:** Artlist, Musicbed, Epidemic Sound (търси "documentary", "cinematic minimal", "nordic ambient").

### Глас (voiceover)
- Език: немски (Hochdeutsch). За LinkedIn-EN — британски английски.
- Тон: спокоен, делови, никога enthusiastic-presenter.
- Pace: 140-160 думи в минута.
- Pause: задължително 0.5 сек паузи между ключовите числа.

### Звукови ефекти
- Реална кухненска атмосфера (тенджери, нож, пара) — фонов слой -18 dB.
- UI sound effects (tap, ding) — приемливо за screen-recordings, но винаги тихо (-24 dB).

---

## 8. КАДРИ ОТ ПРИЛОЖЕНИЕТО (screen recordings)

### Подготовка
1. Винаги използвай demo акаунт (kantine / schule / catering — `https://kitchenos.de/app/?demo=<variant>`).
2. Изчисти браузъра до празна tabs bar.
3. Засне в 1920×1080 минимум, 60fps.
4. Заобиколи cursor-а с лек halo (Mac: Highlight cursor; Win: Cursor Highlighter).

### Композиция
- Винаги покажи горния header с името на текущата секция — носи контекст.
- Zoom in макс. 1.5× за подчертаване на конкретен бутон.
- Време на 1 кадър минимум 2.5 сек, така че зрителят да прочете.

### Какво да НЕ показваш
- Реални имена на клиенти.
- E-mail адреси, които не са `@kitchenos.de`.
- Невалидни/празни състояния (loading spinner-и > 1 сек).

---

## 9. ПРИМЕРНИ КАМПАНИИ

### Кампания A — "Compliance ohne Excel" (3 видеа)
1. Hero (60 сек) — "Eine Plattform. DGE, LMIV und HACCP. Ohne Excel."
2. Reel (15 сек) — фокус DGE-Score "Knopfdruck → PDF"
3. Reel (15 сек) — фокус HACCP "Bluetooth-Sensor → automatisches Log"

### Кампания B — "Demo direkt im Browser" (1 видео)
- Reel (20 сек), показва: натиск на CTA → отваря demo → клик в табове. Текст overlay: "10 Sekunden. Keine Anmeldung."

### Кампания C — Customer story (1 видео per сегмент)
- 90-секунден интервю стил, за всеки от трите ICP-та (Schule, Klinik, Catering).
- Излизат при NDA с клиент. Без NDA — използвай актьори в реална кухня + надпис "Re-enacted with consent".

---

## 10. КОНТРОЛНИ ВЪПРОСИ ПРЕДИ ПУБЛИКУВАНЕ

Преди да качиш видео в LinkedIn / YouTube / уебсайт, отметни:

- [ ] Лого видимо в първи и последен кадър.
- [ ] CTA URL работи и води към правилно demo.
- [ ] Без оригинален интелектуален имот на трето лице (музика, glyph, бренд).
- [ ] Немският текст е без правописни грешки (провери Duden).
- [ ] Никакви лични данни на реални хора без писмено съгласие (DSGVO).
- [ ] Subtitle файл (.srt) на DE и EN е приложен.
- [ ] Размер на файла под 200 MB за LinkedIn (тяхно ограничение).
- [ ] Aspect ratio съвпада с платформата (16:9 за YouTube/уебсайт, 9:16 за Reels/TikTok/Shorts, 1:1 за Instagram feed).

---

## 11. ANTI-PATTERNS — какво НИКОГА не правим

1. **Stock footage от напълно различна кухня.** Зрителят го разпознава за 0.5 сек и губим доверие.
2. **AI-generated лица в close-up.** Все още имат "uncanny valley" за >25% от хората. Само в medium/wide и без директен поглед.
3. **Stock-music "uplifting corporate".** Това е звукът на 2014 SaaS реклами. Ние сме 2026 documentary brand.
4. **Числа без източник.** Ако кажеш "−18 % Foodwaste" в видео, по-късно те питат "от къде". Винаги пуснат текст в описанието: "Pilot data, Klinikverbund Nord, 350 beds, Q3 2025".
5. **CTA "Sign up free trial".** Ние нямаме free trial — ние имаме live demo. Винаги "Demo testen" не "Sign up".
6. **Анимирано лого spinning / morphing.** Логото е статично винаги. Само fade-in / fade-out.
7. **Бой над 100 BPM в музиката.** Сигнализира за hype. Ние сме calm-confident.

---

Документ версия: 2026-05-05. Поддържа се от продуктовия и маркетинговия екип. При въпроси: hello@kitchenos.de.
