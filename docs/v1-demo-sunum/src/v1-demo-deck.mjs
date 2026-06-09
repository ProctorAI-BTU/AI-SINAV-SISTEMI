import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  Presentation,
  PresentationFile,
  row,
  column,
  grid,
  layers,
  panel,
  text,
  image,
  shape,
  rule,
  fill,
  hug,
  fixed,
  wrap,
  grow,
  fr,
  auto,
} from "@oai/artifact-tool";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(workspaceDir, "..", "..");
const scratchDir = path.join(workspaceDir, "scratch");
const previewDir = path.join(scratchDir, "previews");
const outputDir = path.join(workspaceDir, "output");
const posterPath = path.join(repoRoot, "docs", "poster.png");
const posterDataUrl = `data:image/png;base64,${(await readFile(posterPath)).toString("base64")}`;
const pptxPath = path.join(outputDir, "AI_Sinav_Sistemi_V1_Demo_20_Mayis_2026.pptx");
const notesPath = path.join(outputDir, "V1_Demo_Konusma_Notlari.md");
const inspectPath = path.join(scratchDir, "layout-inspect.ndjson");
const parityInspectPath = path.join(scratchDir, "pptx-reimport-inspect.ndjson");

const W = 1920;
const H = 1080;
const C = {
  ink: "#0F172A",
  muted: "#475569",
  faint: "#64748B",
  canvas: "#F8FAFC",
  panel: "#FFFFFF",
  border: "#CBD5E1",
  soft: "#E2E8F0",
  deep: "#07111F",
  deep2: "#0B1F33",
  blue: "#2563EB",
  cyan: "#0891B2",
  teal: "#0F766E",
  green: "#16A34A",
  amber: "#D97706",
  red: "#DC2626",
  violet: "#7C3AED",
};

const slideMeta = [];

function t(value, options = {}) {
  return text(value, {
    width: options.width ?? fill,
    height: options.height ?? hug,
    name: options.name,
    columnSpan: options.columnSpan,
    rowSpan: options.rowSpan,
    style: {
      fontSize: options.size ?? 28,
      color: options.color ?? C.ink,
      bold: options.bold ?? false,
      italic: options.italic ?? false,
      fontFace: "Aptos",
      ...options.style,
    },
  });
}

function bg(color) {
  return shape({ name: "background", fill: color, width: fill, height: fill });
}

function compose(slide, content, background = C.canvas) {
  slide.compose(
    layers({ name: "slide-layers", width: fill, height: fill }, [bg(background), content]),
    { frame: { left: 0, top: 0, width: W, height: H }, baseUnit: 8 },
  );
}

function footer(index, dark = false) {
  return row(
    {
      name: "footer",
      width: fill,
      height: hug,
      align: "center",
      justify: "between",
    },
    [
      t("AI Destekli Online Sınav Sistemi", {
        name: "footer-title",
        width: hug,
        size: 18,
        color: dark ? "#B8C7DA" : C.faint,
      }),
      t(`V1 Demo  |  ${String(index).padStart(2, "0")}/10`, {
        name: "footer-slide",
        width: hug,
        size: 18,
        color: dark ? "#B8C7DA" : C.faint,
      }),
    ],
  );
}

function titleStack(title, subtitle, options = {}) {
  const dark = options.dark ?? false;
  return column(
    { name: "title-stack", width: fill, height: hug, gap: 14 },
    [
      t(title, {
        name: "slide-title",
        width: options.width ?? fill,
        size: options.size ?? 56,
        bold: true,
        color: dark ? "#FFFFFF" : C.ink,
      }),
      rule({
        name: "title-rule",
        width: fixed(options.ruleWidth ?? 190),
        stroke: options.accent ?? C.blue,
        weight: 5,
      }),
      subtitle
        ? t(subtitle, {
            name: "slide-subtitle",
            width: options.subtitleWidth ?? wrap(1320),
            size: options.subtitleSize ?? 28,
            color: dark ? "#B8C7DA" : C.muted,
          })
        : null,
    ].filter(Boolean),
  );
}

function callout(label, body, accent, options = {}) {
  return panel(
    {
      name: options.name,
      width: options.width ?? fill,
      height: options.height ?? hug,
      fill: options.fill ?? C.panel,
      borderRadius: 8,
      padding: { x: 28, y: 24 },
      line: { color: options.line ?? C.soft, width: 1.2 },
    },
    column({ width: fill, height: hug, gap: 10 }, [
      row({ width: fill, height: hug, align: "center", gap: 12 }, [
        shape({ geometry: "rect", fill: accent, width: fixed(8), height: fixed(38), borderRadius: 4 }),
        t(label, { width: fill, size: options.labelSize ?? 28, bold: true, color: options.labelColor ?? C.ink }),
      ]),
      t(body, { width: fill, size: options.bodySize ?? 22, color: options.bodyColor ?? C.muted }),
    ]),
  );
}

function bulletLine(body, accent = C.blue, options = {}) {
  return row(
    { name: options.name, width: fill, height: hug, align: "start", gap: 14 },
    [
      shape({ geometry: "ellipse", fill: accent, width: fixed(12), height: fixed(12) }),
      t(body, {
        width: fill,
        size: options.size ?? 25,
        color: options.color ?? C.muted,
        bold: options.bold ?? false,
      }),
    ],
  );
}

function archNode(title, body, accent, options = {}) {
  return panel(
    {
      name: options.name,
      width: fill,
      height: fill,
      fill: options.fill ?? C.panel,
      borderRadius: 8,
      padding: { x: 26, y: 22 },
      line: { color: options.line ?? C.soft, width: 1 },
    },
    column({ width: fill, height: fill, gap: 12, justify: "center" }, [
      t(title, { width: fill, size: 29, bold: true, color: options.dark ? "#FFFFFF" : C.ink }),
      rule({ width: fixed(96), stroke: accent, weight: 5 }),
      t(body, { width: fill, size: 21, color: options.dark ? "#C9D7E8" : C.muted }),
    ]),
  );
}

function statBand(value, label, accent) {
  return panel(
    {
      width: fill,
      height: hug,
      fill: "#F8FAFC",
      borderRadius: 8,
      padding: { x: 22, y: 18 },
      line: { color: C.soft, width: 1 },
    },
    row({ width: fill, height: hug, align: "center", gap: 16 }, [
      t(value, { width: fixed(82), size: 34, bold: true, color: accent }),
      t(label, { width: fill, size: 22, color: C.muted }),
    ]),
  );
}

function tableRow(cells, options = {}) {
  return grid(
    {
      name: options.name,
      width: fill,
      height: hug,
      columns: options.columns ?? [fr(0.85), fr(1.9), fr(0.7), fr(1.25)],
      columnGap: 12,
      padding: { x: 18, y: options.header ? 15 : 13 },
    },
    cells.map((cell, idx) =>
      t(cell, {
        width: fill,
        size: options.header ? 20 : 19,
        bold: options.header,
        color: options.header ? C.ink : idx === 2 ? options.riskColor ?? C.amber : C.muted,
      }),
    ),
  );
}

function addSlide(presentation, title, builder) {
  const slide = presentation.slides.add();
  slideMeta.push({ index: slideMeta.length + 1, title });
  builder(slide, slideMeta.length);
  return slide;
}

const deck = Presentation.create({
  slideSize: { width: W, height: H },
});

addSlide(deck, "Kapak", (slide, index) => {
  compose(
    slide,
    grid(
      {
        name: "cover-root",
        width: fill,
        height: fill,
        columns: [fr(1.08), fr(0.92)],
        columnGap: 52,
        padding: { x: 84, y: 70 },
      },
      [
        column({ name: "cover-copy", width: fill, height: fill, justify: "between" }, [
          column({ width: fill, height: hug, gap: 24 }, [
            t("AI Destekli Online Sınav Sistemi", {
              name: "cover-eyebrow",
              width: fill,
              size: 26,
              bold: true,
              color: "#7DD3FC",
            }),
            t("V1 Demo", {
              name: "cover-title",
              width: fill,
              size: 112,
              bold: true,
              color: "#FFFFFF",
            }),
            t("Girişten risk raporuna kadar uçtan uca gözetimli sınav akışı", {
              name: "cover-subtitle",
              width: wrap(940),
              size: 35,
              color: "#C8D7EA",
            }),
            rule({ width: fixed(260), stroke: C.green, weight: 6 }),
            row({ width: fill, height: hug, gap: 18 }, [
              statBand("20", "Mayıs 2026 canlı demo", C.cyan),
              statBand("V1", "Sınav + ihlal + rapor akışı", C.green),
            ]),
          ]),
          column({ width: fill, height: hug, gap: 8 }, [
            t("Hazırlayan: Koray Garip ve ekip", { size: 23, color: "#B8C7DA" }),
            footer(index, true),
          ]),
        ]),
        panel(
          {
            name: "cover-poster-frame",
            width: fill,
            height: fill,
            fill: "#102034",
            borderRadius: 8,
            padding: 0,
            line: { color: "#1E3A5F", width: 1.2 },
          },
          image({
            name: "project-poster",
            dataUrl: posterDataUrl,
            contentType: "image/png",
            width: fill,
            height: fill,
            fit: "cover",
            alt: "AI destekli online sınav sistemi poster görseli",
          }),
        ),
      ],
    ),
    C.deep,
  );
});

addSlide(deck, "Neden Bu Sistem?", (slide, index) => {
  compose(
    slide,
    column({ name: "problem-root", width: fill, height: fill, padding: { x: 86, y: 68 }, gap: 42 }, [
      titleStack(
        "Online sınavda güven sorunu gerçek zamanlı çözülmeli",
        "V1, öğrenciyi sınavdan koparmadan izleyen ve eğitmene kanıtlı rapor üreten bir gözetim akışı sunar.",
        { accent: C.cyan },
      ),
      grid(
        { width: fill, height: fill, columns: [fr(1.05), fr(0.95)], columnGap: 44 },
        [
          column({ width: fill, height: fill, gap: 22, justify: "center" }, [
            callout("Problem", "Klasik online sınavlar çoğunlukla sınav bittikten sonra incelenir; canlı ihlal yönetimi zayıftır.", C.red),
            callout("V1 hedefi", "Yüz, bakış, ses ve tam ekran olaylarını aynı oturum mantığında takip edip risk raporuna bağlamak.", C.blue),
            callout("Demo mesajı", "Sistem yalnızca uyarı vermez; öğrencinin devam edip edemeyeceğine ve rapora ne yazılacağına karar akışıyla yaklaşır.", C.green),
          ]),
          panel(
            {
              width: fill,
              height: fill,
              fill: "#FFFFFF",
              borderRadius: 8,
              padding: { x: 42, y: 38 },
              line: { color: C.soft, width: 1 },
            },
            column({ width: fill, height: fill, justify: "center", gap: 28 }, [
              t("V1 başarı kriteri", { size: 31, bold: true, color: C.ink }),
              t("Öğrenci sınava güvenli şekilde başlar, koparsa kaldığı yerden döner, ihlal limiti dolarsa sınav kontrollü biter.", {
                size: 42,
                bold: true,
                color: C.ink,
              }),
              rule({ width: fill, stroke: C.soft, weight: 2 }),
              bulletLine("Biten sınava aynı kişi aynı kodla tekrar giremez.", C.green, { size: 24 }),
              bulletLine("Aktif sınavda bağlantı koparsa oturum devam eder.", C.blue, { size: 24 }),
              bulletLine("Yüz görünmeden sınav başlatılamaz.", C.amber, { size: 24 }),
            ]),
          ),
        ],
      ),
      footer(index),
    ]),
  );
});

addSlide(deck, "V1 Ürün Sözü", (slide, index) => {
  compose(
    slide,
    column({ name: "promise-root", width: fill, height: fill, padding: { x: 86, y: 68 }, gap: 44 }, [
      titleStack(
        "Öğrenci başlar, sistem izler, eğitmen raporlar",
        "Canlı demoda göstereceğimiz ana değer: sınav akışı, proctoring kararları ve rapor aynı üründe kapanıyor.",
        { accent: C.green },
      ),
      grid(
        { width: fill, height: fill, columns: [fr(1), auto, fr(1), auto, fr(1)], columnGap: 22 },
        [
          archNode("1. Başlatma", "Kod girilir, kamera ve yüz onayı alınır, tam ekran sağlanır.", C.cyan),
          column({ width: fixed(54), height: fill, justify: "center", align: "center" }, [
            t(">", { width: hug, size: 54, bold: true, color: C.faint }),
          ]),
          archNode("2. Gözetim", "Cevaplar korunur; yüz, bakış, ses ve tam ekran olayları işlenir.", C.blue),
          column({ width: fixed(54), height: fill, justify: "center", align: "center" }, [
            t(">", { width: hug, size: 54, bold: true, color: C.faint }),
          ]),
          archNode("3. Rapor", "İhlaller, risk puanı ve olay zaman çizelgesi eğitmen ekranında görünür.", C.green),
        ],
      ),
      panel(
        {
          width: fill,
          height: hug,
          fill: "#ECFDF5",
          borderRadius: 8,
          padding: { x: 30, y: 22 },
          line: { color: "#BBF7D0", width: 1 },
        },
        t("Demo sırasında tek cümlelik anlatım: V1 artık sınavı başlatma, sürdürme, ihlal yönetme ve raporlama zincirini koparmadan gösterebiliyor.", {
          size: 27,
          bold: true,
          color: "#14532D",
        }),
      ),
      footer(index),
    ]),
  );
});

addSlide(deck, "Canlı Demo Akışı", (slide, index) => {
  const steps = [
    ["Öğrenci paneli", "Kod girilir; sistem doğrudan boş kod ekranına düşmez.", C.cyan],
    ["Ön kontrol", "Kamera, mikrofon, yüz ve tam ekran onayı alınır.", C.green],
    ["Sınav odası", "Soru gezintisi, önceki butonu ve cevap koruma gösterilir.", C.blue],
    ["İhlal yönetimi", "Tam ekrandan çıkışta 1/3, 2/3, 3/3 popup akışı denenir.", C.amber],
    ["Rapor", "Yüz, bakış, ses ve tam ekran olayları risk puanıyla incelenir.", C.red],
  ];
  compose(
    slide,
    column({ name: "demo-flow-root", width: fill, height: fill, padding: { x: 74, y: 64 }, gap: 34 }, [
      titleStack("Yarınki demo 5 kısa sahneden oluşsun", "Her sahne tek bir ürün kararını kanıtlar; anlatım kısa, tıklama akışı net kalır.", {
        accent: C.amber,
      }),
      row(
        { width: fill, height: fill, gap: 18, align: "stretch" },
        steps.map(([label, body, accent], i) =>
          panel(
            {
              name: `demo-step-${i + 1}`,
              width: fill,
              height: fill,
              fill: C.panel,
              borderRadius: 8,
              padding: { x: 22, y: 24 },
              line: { color: C.soft, width: 1 },
            },
            column({ width: fill, height: fill, gap: 18 }, [
              t(String(i + 1), { width: fixed(64), size: 40, bold: true, color: accent }),
              rule({ width: fill, stroke: accent, weight: 5 }),
              t(label, { width: fill, size: 28, bold: true, color: C.ink }),
              t(body, { width: fill, size: 22, color: C.muted }),
            ]),
          ),
        ),
      ),
      footer(index),
    ]),
  );
});

addSlide(deck, "Mimari", (slide, index) => {
  compose(
    slide,
    column({ name: "architecture-root", width: fill, height: fill, padding: { x: 78, y: 62 }, gap: 30 }, [
      titleStack("V1 mimarisi modüler servisler üzerine kurulu", "Frontend, Node servisleri ve Python AI servisleri aynı sınav oturumu etrafında konuşur.", {
        accent: C.blue,
      }),
      grid(
        { width: fill, height: fill, columns: [fr(1), fixed(42), fr(1), fixed(42), fr(1), fixed(42), fr(0.82)], columnGap: 10 },
        [
          archNode("React istemci", "Öğrenci ve eğitmen panelleri, WebRTC kamera/mikrofon, Socket.IO olayları.", C.cyan),
          column({ width: fill, height: fill, justify: "center", align: "center" }, [t(">", { width: hug, size: 44, bold: true, color: C.faint })]),
          archNode("Node API servisleri", "Auth, exam, proctoring ve reporting servisleri. JWT, REST ve WebSocket katmanı.", C.blue),
          column({ width: fill, height: fill, justify: "center", align: "center" }, [t(">", { width: hug, size: 44, bold: true, color: C.faint })]),
          archNode("Python AI servisleri", "Face detection, eye tracking, audio analysis ve risk scoring mikroservisleri.", C.green),
          column({ width: fill, height: fill, justify: "center", align: "center" }, [t(">", { width: hug, size: 44, bold: true, color: C.faint })]),
          archNode("MongoDB", "Kullanıcı, sınav, oturum, cevap ve rapor kayıtları.", C.amber),
        ],
      ),
      panel(
        {
          width: fill,
          height: hug,
          fill: "#EFF6FF",
          borderRadius: 8,
          padding: { x: 26, y: 18 },
          line: { color: "#BFDBFE", width: 1 },
        },
        t("Demo notu: Audio tarafı için REST mi WebSocket mi kararı V1 sonrası netleştirilecek; canlı akış gereksinimi ağır basarsa WebSocket hattı tercih edilmeli.", {
          size: 23,
          color: "#1E3A8A",
        }),
      ),
      footer(index),
    ]),
  );
});

addSlide(deck, "Gözetim Sinyalleri", (slide, index) => {
  compose(
    slide,
    column({ name: "signals-root", width: fill, height: fill, padding: { x: 82, y: 64 }, gap: 34 }, [
      titleStack(
        "İhlal değil, kanıtlı risk sinyali topluyoruz",
        "Her olay hem öğrencinin akışına hem eğitmen raporuna etki eder; amaç ölçülebilir ve açıklanabilir risk puanı üretmek.",
        { accent: C.red },
      ),
      grid({ width: fill, height: fill, columns: [fr(1.25), fr(0.75)], columnGap: 42 }, [
        grid(
          { width: fill, height: fill, columns: [fr(1), fr(1)], rows: [fr(1), fr(1)], columnGap: 22, rowGap: 22 },
          [
            callout("Yüz / kamera", "Yüz görünmezse sınav başlamaz; sınav içinde yüz kaybolursa ekran kilitlenir ve kamera bağlantısı beklenir.", C.green, { height: fill }),
            callout("Bakış", "Ekran dışına bakışlar rapora olay olarak düşer; küçük risk katkıları birikimli değerlendirilir.", C.cyan, { height: fill }),
            callout("Ses", "2-3 saniye yüksek ses veya konuşma tespitinde raporda 'ses riski' olarak işaretlenir.", C.amber, { height: fill }),
            callout("Tam ekran", "Girişte ihlal sayılmaz; tam ekrandan çıkınca popup gösterilir, 3/3 olduğunda sınav sonlanır.", C.red, { height: fill }),
          ],
        ),
        panel(
          {
            width: fill,
            height: fill,
            fill: C.panel,
            borderRadius: 8,
            padding: { x: 34, y: 30 },
            line: { color: C.soft, width: 1 },
          },
          column({ width: fill, height: fill, gap: 24, justify: "center" }, [
            t("Risk puanı örneği", { size: 31, bold: true, color: C.ink }),
            statBand("+18", "Yüz algılanmadı", C.red),
            statBand("+8", "Yüksek ses 3 sn", C.amber),
            statBand("+6", "Bakış ekran dışında", C.cyan),
            statBand("1/3", "Tam ekran ihlali", C.blue),
            t("Puanlar tek başına karar değil; raporun kanıt satırlarıdır.", { size: 21, color: C.faint }),
          ]),
        ),
      ]),
      footer(index),
    ]),
  );
});

addSlide(deck, "V1'de Kapatılan Açıklar", (slide, index) => {
  const rows = [
    ["Tekrar giriş", "Biten sınava aynı kişi aynı kodla yeniden giremez; aktif oturum koparsa devam eder."],
    ["İhlal sayacı", "İhlal girişte değil, tam ekrandan çıkışta sayılır. 1/3, 2/3, 3/3 popup akışı vardır."],
    ["Kamera / yüz", "Yüz onayı gelmeden sınav başlamaz; yüz kaybolursa devam kilitlenir."],
    ["Bitiş davranışı", "Sınav bittiğinde logout yapılmaz; öğrenci ekranına geri dönülür."],
    ["Soru gezintisi", "Önceki butonu ve soru seçimi cevapları kaybetmeden çalışır."],
    ["Oturum dayanıklılığı", "JWT süresi uzatıldı; şifremi unuttum ve yardım akışları iyileştirildi."],
  ];
  compose(
    slide,
    column({ name: "fixes-root", width: fill, height: fill, padding: { x: 82, y: 62 }, gap: 26 }, [
      titleStack("V1 demo öncesi kritik kullanıcı akışı toparlandı", "Bu slayt, önceki sorun listesinin demoda nasıl kapatıldığını açıkça anlatmak için.", {
        accent: C.green,
      }),
      panel(
        {
          width: fill,
          height: fill,
          fill: "#FFFFFF",
          borderRadius: 8,
          padding: { x: 26, y: 18 },
          line: { color: C.soft, width: 1 },
        },
        column(
          { width: fill, height: fill, gap: 0 },
          [
            tableRow(["Alan", "V1 davranışı"], {
              header: true,
              columns: [fr(0.55), fr(2.45)],
            }),
            rule({ width: fill, stroke: C.soft, weight: 2 }),
            ...rows.flatMap(([a, b], i) => [
              tableRow([a, b], {
                name: `fix-row-${i + 1}`,
                columns: [fr(0.55), fr(2.45)],
              }),
              i < rows.length - 1 ? rule({ width: fill, stroke: "#E5E7EB", weight: 1 }) : null,
            ]).filter(Boolean),
          ],
        ),
      ),
      footer(index),
    ]),
  );
});

addSlide(deck, "Raporlama", (slide, index) => {
  const reportRows = [
    ["00:34", "Yüz algılanmadı", "+18", "Ekran bekletildi"],
    ["01:12", "Bakış ekran dışında", "+6", "Rapora işlendi"],
    ["02:05", "Yüksek ses 3 sn", "+8", "Ses riski"],
    ["04:22", "Tam ekran çıkışı", "1/3", "Popup gösterildi"],
    ["06:40", "Sınav sonlandırıldı", "3/3", "Oturum kapandı"],
  ];
  compose(
    slide,
    column({ name: "reporting-root", width: fill, height: fill, padding: { x: 82, y: 64 }, gap: 30 }, [
      titleStack("Rapor artık yalnız skor değil, olay kanıtı taşıyor", "Eğitmen sınav sonrası riskin neden oluştuğunu zaman çizelgesiyle görebilmeli.", {
        accent: C.cyan,
      }),
      grid({ width: fill, height: fill, columns: [fr(0.7), fr(1.3)], columnGap: 42 }, [
        panel(
          {
            width: fill,
            height: fill,
            fill: "#0F172A",
            borderRadius: 8,
            padding: { x: 36, y: 34 },
          },
          column({ width: fill, height: fill, justify: "center", gap: 26 }, [
            t("Risk skoru", { size: 31, bold: true, color: "#C8D7EA" }),
            t("72", { width: hug, size: 130, bold: true, color: "#FBBF24" }),
            t("Orta-yüksek risk", { size: 34, bold: true, color: "#FFFFFF" }),
            rule({ width: fill, stroke: "#334155", weight: 2 }),
            bulletLine("Yüz ve tam ekran olayları daha ağır.", C.red, { size: 23, color: "#C8D7EA" }),
            bulletLine("Bakış ve ses küçük katkılarla eklenir.", C.cyan, { size: 23, color: "#C8D7EA" }),
          ]),
        ),
        panel(
          {
            width: fill,
            height: fill,
            fill: C.panel,
            borderRadius: 8,
            padding: { x: 28, y: 24 },
            line: { color: C.soft, width: 1 },
          },
          column(
            { width: fill, height: fill, gap: 0 },
            [
              tableRow(["Zaman", "Olay", "Risk", "Aksiyon"], { header: true }),
              rule({ width: fill, stroke: C.soft, weight: 2 }),
              ...reportRows.flatMap((r, i) => [
                tableRow(r, {
                  name: `report-row-${i + 1}`,
                  riskColor: r[2].includes("/") ? C.blue : r[2] === "+18" ? C.red : C.amber,
                }),
                i < reportRows.length - 1 ? rule({ width: fill, stroke: "#E5E7EB", weight: 1 }) : null,
              ]).filter(Boolean),
            ],
          ),
        ),
      ]),
      footer(index),
    ]),
  );
});

addSlide(deck, "Demo Scripti", (slide, index) => {
  const scriptSteps = [
    "Öğrenci hesabıyla gir: ana ekran, kod alanı ve yardım bağlantılarını göster.",
    "Kod gir: ön kontrol sayfasında kamera ve yüz onayı gelmeden başlatma butonunu beklet.",
    "Sınavı başlat: soru değiştir, önceki butonuna bas, cevap seçimini koruduğunu göster.",
    "Tam ekrandan çık: 1/3 popup göster; ikinci denemede 2/3 akışını anlat.",
    "Sayfayı yenile: aktif sınavın kaldığı yerden açıldığını göster.",
    "3/3 ihlal veya bitir: öğrenci ekranına dönüşü ve eğitmen raporunu aç.",
  ];
  compose(
    slide,
    grid(
      {
        name: "script-root",
        width: fill,
        height: fill,
        columns: [fr(1.18), fr(0.82)],
        columnGap: 48,
        padding: { x: 82, y: 64 },
      },
      [
        column({ width: fill, height: fill, gap: 30 }, [
          titleStack("Canlı anlatımı bu sırayla yap", "Tıklama sayısı az, ürün kararı net, riskli alanların yedeği hazır.", {
            accent: C.amber,
          }),
          column(
            { width: fill, height: fill, gap: 15 },
            scriptSteps.map((step, i) =>
              row({ width: fill, height: hug, gap: 18, align: "start" }, [
                t(`${i + 1}.`, { width: fixed(46), size: 27, bold: true, color: C.blue }),
                t(step, { width: fill, size: 25, color: C.muted }),
              ]),
            ),
          ),
          footer(index),
        ]),
        panel(
          {
            width: fill,
            height: fill,
            fill: "#FFF7ED",
            borderRadius: 8,
            padding: { x: 34, y: 34 },
            line: { color: "#FDBA74", width: 1 },
          },
          column({ width: fill, height: fill, gap: 22 }, [
            t("Yedek plan", { size: 34, bold: true, color: "#9A3412" }),
            bulletLine("AI servisleri çalışmazsa kamera/yüz bekleme ekranını ve rapor mock verisini göster.", C.amber, { size: 24, color: "#7C2D12" }),
            bulletLine("Tam ekran API tarayıcıda izin istemezse önce manuel tam ekrana alıp sonra ihlal akışını tetikle.", C.amber, { size: 24, color: "#7C2D12" }),
            bulletLine("Ağ kopması için sayfa yenileme demosu yeterli; gerçek offline senaryoyu açıklama olarak geç.", C.amber, { size: 24, color: "#7C2D12" }),
            rule({ width: fill, stroke: "#FDBA74", weight: 2 }),
            t("Kapanış cümlesi", { size: 27, bold: true, color: "#9A3412" }),
            t("V1, sınavı sadece başlatan değil; gözeten, karar veren ve kanıtlı raporlayan bir akışa geldi.", {
              size: 26,
              bold: true,
              color: "#7C2D12",
            }),
          ]),
        ),
      ],
    ),
  );
});

addSlide(deck, "Kapanış", (slide, index) => {
  compose(
    slide,
    grid(
      {
        name: "closing-root",
        width: fill,
        height: fill,
        columns: [fr(1.05), fr(0.95)],
        columnGap: 48,
        padding: { x: 82, y: 64 },
      },
      [
        column({ width: fill, height: fill, justify: "between" }, [
          column({ width: fill, height: hug, gap: 24 }, [
            t("V1 demo mesajı", { size: 30, bold: true, color: "#7DD3FC" }),
            t("Uçtan uca sınav gözetimi artık gösterilebilir durumda.", {
              width: wrap(880),
              size: 66,
              bold: true,
              color: "#FFFFFF",
            }),
            t("Başlatma, sınav içi ihlal yönetimi, devam etme ve raporlama zinciri tek canlı akışta anlatılacak.", {
              width: wrap(850),
              size: 30,
              color: "#C8D7EA",
            }),
          ]),
          footer(index, true),
        ]),
        column({ width: fill, height: fill, gap: 22, justify: "center" }, [
          callout("Demo için hazır", "Öğrenci sınav akışı, ihlal popup'ları, yüz/kamera bekleme ve bitiş sonrası öğrenci ekranına dönüş.", C.green, {
            fill: "#F8FAFC",
          }),
          callout("Rapor için hazır", "Yüksek ses, bakış dışarıda, yüz kaybı ve tam ekran olayları risk satırı olarak gösterilebilir.", C.cyan, {
            fill: "#F8FAFC",
          }),
          callout("V1 sonrası kararlar", "Audio taşıma yolu, risk eşik kalibrasyonu, prod deploy profili ve daha geniş test matrisi.", C.amber, {
            fill: "#F8FAFC",
          }),
        ]),
      ],
    ),
    C.deep,
  );
});

function buildNotes() {
  return `# V1 Demo Konuşma Notları

Tarih: 20 Mayıs 2026

## 1. Kapak
Kısa açılış: "Bugün AI destekli online sınav sisteminin V1 demosunu göstereceğiz. Amaç yalnızca sınav açmak değil; sınavı gözetmek, ihlali yönetmek ve raporu kanıtlı şekilde üretmek."

## 2. Neden Bu Sistem?
Online sınavlarda en kritik sorun canlı güvenilirlik. V1'in farkı, sınav bittikten sonra değil sınav sırasında karar verebilmesi.

## 3. V1 Ürün Sözü
Ana cümle: "Öğrenci başlar, sistem izler, eğitmen raporlar." Bu cümleyi demo boyunca tekrar kullan.

## 4. Canlı Demo Akışı
Beş sahneyi sırayla göster: öğrenci paneli, ön kontrol, sınav odası, ihlal yönetimi, rapor.

## 5. Mimari
Teknik anlatımı kısa tut: React istemci, Node servisleri, Python AI servisleri ve MongoDB aynı oturum etrafında bağlı.

## 6. Gözetim Sinyalleri
Yüz, bakış, ses ve tam ekran olaylarının her biri farklı risk katkısı sağlar. Yüz görünmüyorsa sınav devam etmemeli; ses ve bakış daha küçük riskler olarak rapora işlenmeli.

## 7. V1'de Kapatılan Açıklar
Önceki hata listesini savunma gibi değil, ürün olgunlaşması gibi anlat: tekrar giriş, ihlal sayacı, kamera/yüz, bitiş davranışı, soru gezintisi ve oturum dayanıklılığı toparlandı.

## 8. Raporlama
Eğitmen için önemli olan yalnız skor değil, skorun neden oluştuğu. Zaman, olay, risk ve aksiyon satırları bunu gösterir.

## 9. Demo Scripti
Canlı akışta sapma olursa yedek planı kullan: AI servisleri açık değilse bekleme ekranını ve örnek raporu göster; ağ kopması için sayfa yenileme yeterli.

## 10. Kapanış
Kapanış cümlesi: "V1 artık sınavı sadece başlatan değil; gözeten, karar veren ve kanıtlı raporlayan bir akışa geldi."
`;
}

async function saveBlob(blob, filePath) {
  const data = Buffer.from(await blob.arrayBuffer());
  await writeFile(filePath, data);
}

async function main() {
  await mkdir(previewDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });

  const deckInspect = await deck.inspect({ maxChars: 250000 });
  await writeFile(inspectPath, deckInspect.ndjson ?? JSON.stringify(deckInspect, null, 2), "utf8");

  const pptxBlob = await PresentationFile.exportPptx(deck);
  await pptxBlob.save(pptxPath);

  for (let i = 0; i < deck.slides.count; i += 1) {
    const slide = deck.slides.getItem(i);
    const pngBlob = await deck.export({ slide, format: "png" });
    await saveBlob(pngBlob, path.join(previewDir, `slide-${String(i + 1).padStart(2, "0")}.png`));
  }

  const pptxBytes = await readFile(pptxPath);
  const imported = await PresentationFile.importPptx(pptxBytes);
  const importedInspect = await imported.inspect({ maxChars: 250000 });
  await writeFile(parityInspectPath, importedInspect.ndjson ?? JSON.stringify(importedInspect, null, 2), "utf8");
  await writeFile(notesPath, buildNotes(), "utf8");

  console.log(JSON.stringify({
    pptx: pptxPath,
    notes: notesPath,
    previews: previewDir,
    inspect: inspectPath,
    parityInspect: parityInspectPath,
    slides: slideMeta,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
