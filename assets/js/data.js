// ============================================
// DATA FILE: All structured data for Sonnaع
// ============================================

// Plan limits for the Verified (subscribed) tier. Free/unverified factories
// stay locked (no media, no RFQ replies) until they subscribe. Tweak these
// numbers freely — every limit in the app reads from here.
window.PLAN_LIMITS = {
  mediaImages: 10,   // gallery photos a verified factory may keep
  mediaVideos: 2,    // gallery videos a verified factory may keep
  rfqPerMonth: 15    // buyer quote-requests a verified factory may answer / calendar month
};

const INDUSTRIES = [
  { id: "textile", en: "Textile & Apparel", ar: "المنسوجات والملابس", icon: ICONS.textile, g: ["#0E6B5E", "#12897A"] },
  { id: "packaging", en: "Packaging & Printing", ar: "التعبئة والطباعة", icon: ICONS.box, g: ["#C98A2B", "#E0A94F"] },
  { id: "furniture", en: "Furniture", ar: "الأثاث", icon: ICONS.furniture, g: ["#7A4E2D", "#A06B42"] },
  { id: "food", en: "Food Manufacturing", ar: "الصناعات الغذائية", icon: ICONS.food, g: ["#B5541C", "#D97A3D"] },
  { id: "plastics", en: "Plastics", ar: "البلاستيك", icon: ICONS.plastics, g: ["#2563A8", "#3B82C9"] },
  { id: "metal", en: "Metal Fabrication", ar: "تشكيل المعادن", icon: ICONS.gear, g: ["#475569", "#64748B"] },
  { id: "chemicals", en: "Chemicals", ar: "الكيماويات", icon: ICONS.chemicals, g: ["#6D28A8", "#8B44C9"] },
  { id: "cosmetics", en: "Cosmetics", ar: "مستحضرات التجميل", icon: ICONS.cosmetics, g: ["#B02A6A", "#D14C8B"] },
  { id: "construction", en: "Construction Materials", ar: "مواد البناء", icon: ICONS.construction, g: ["#8A4B2F", "#B06A45"] },
  { id: "medical", en: "Medical Supplies", ar: "المستلزمات الطبية", icon: ICONS.medical, g: ["#0E7490", "#22A3BF"] },
  { id: "promo", en: "Promotional Products", ar: "منتجات دعائية", icon: ICONS.promo, g: ["#B45309", "#D97706"] },
  { id: "electronics", en: "Electronics", ar: "الإلكترونيات", icon: ICONS.electronics, g: ["#1E40AF", "#3B5FD9"] },
  { id: "agriculture", en: "Agriculture", ar: "الصناعات الزراعية", icon: ICONS.agriculture, g: ["#3F6212", "#5C8A1E"] },
  { id: "automotive", en: "Automotive Components", ar: "مكونات السيارات", icon: ICONS.automotive, g: ["#334155", "#52657E"] }
];

const GOVS = [
  { en: "Cairo", ar: "القاهرة" },
  { en: "Giza", ar: "الجيزة" },
  { en: "Alexandria", ar: "الإسكندرية" },
  { en: "Port Said", ar: "بورسعيد" },
  { en: "Damietta", ar: "دمياط" },
  { en: "Sharqia (10th of Ramadan)", ar: "الشرقية (العاشر من رمضان)" },
  { en: "Gharbia (El Mahalla)", ar: "الغربية (المحلة)" },
  { en: "Suez", ar: "السويس" },
  { en: "Ismailia", ar: "الإسماعيلية" },
  { en: "Dakahlia (Mansoura)", ar: "الدقهلية (المنصورة)" },
  { en: "Menoufia (Sadat City)", ar: "المنوفية (مدينة السادات)" },
  { en: "Qalyubia", ar: "القليوبية" },
  { en: "Beheira (Borg El Arab)", ar: "البحيرة (برج العرب)" },
  { en: "Fayoum", ar: "الفيوم" },
  { en: "Beni Suef", ar: "بني سويف" },
  { en: "Assiut", ar: "أسيوط" }
];

const PREFIX = [
  { en: "El Nil", ar: "النيل" },
  { en: "Delta", ar: "الدلتا" },
  { en: "Misr", ar: "مصر" },
  { en: "Pyramids", ar: "الأهرام" },
  { en: "Lotus", ar: "اللوتس" },
  { en: "Horus", ar: "حورس" },
  { en: "Golden Star", ar: "النجمة الذهبية" },
  { en: "Modern", ar: "الحديثة" },
  { en: "United", ar: "المتحدة" },
  { en: "National", ar: "الوطنية" },
  { en: "Crown", ar: "التاج" },
  { en: "Oasis", ar: "الواحة" },
  { en: "Sphinx", ar: "أبو الهول" },
  { en: "Papyrus", ar: "البردي" },
  { en: "Cleopatra", ar: "كليوباترا" },
  { en: "Rosetta", ar: "رشيد" },
  { en: "Canal", ar: "القناة" },
  { en: "Ramses", ar: "رمسيس" }
];

const IND_WORD = {
  textile: { en: "Textiles", ar: "للمنسوجات" },
  packaging: { en: "Pack", ar: "للتعبئة والتغليف" },
  furniture: { en: "Furniture", ar: "للأثاث" },
  food: { en: "Foods", ar: "للصناعات الغذائية" },
  plastics: { en: "Plast", ar: "للبلاستيك" },
  metal: { en: "Metal Works", ar: "للصناعات المعدنية" },
  chemicals: { en: "Chem", ar: "للكيماويات" },
  cosmetics: { en: "Cosmetics", ar: "لمستحضرات التجميل" },
  construction: { en: "Building Materials", ar: "لمواد البناء" },
  medical: { en: "Medical", ar: "للمستلزمات الطبية" },
  promo: { en: "Promo Gifts", ar: "للهدايا الدعائية" },
  electronics: { en: "Electronics", ar: "للإلكترونيات" },
  agriculture: { en: "Agro", ar: "للصناعات الزراعية" },
  automotive: { en: "Auto Parts", ar: "لمكونات السيارات" }
};

const IND_CODE = {
  textile: "TXT", packaging: "PKG", furniture: "FRN", food: "FOD",
  plastics: "PLS", metal: "MTL", chemicals: "CHM", cosmetics: "CSM",
  construction: "CON", medical: "MED", promo: "PRM", electronics: "ELC",
  agriculture: "AGR", automotive: "AUT"
};

const IND_PRODUCTS = {
  textile: {
    en: ["T-shirts & polos", "Denim garments", "Home textiles", "Uniforms & workwear"],
    ar: ["تيشيرتات وبولو", "ملابس جينز", "مفروشات منزلية", "زي موحد وملابس عمل"]
  },
  packaging: {
    en: ["Corrugated boxes", "Flexible pouches", "Printed labels", "Paper bags"],
    ar: ["كراتين مضلعة", "أكياس مرنة", "ملصقات مطبوعة", "أكياس ورقية"]
  },
  furniture: {
    en: ["Office furniture", "Wooden bedrooms", "Upholstered sofas", "Café & hotel furniture"],
    ar: ["أثاث مكتبي", "غرف نوم خشبية", "أنتريهات منجدة", "أثاث كافيهات وفنادق"]
  },
  food: {
    en: ["Baked goods", "Frozen vegetables", "Tomato paste & sauces", "Tahini & halva"],
    ar: ["مخبوزات", "خضروات مجمدة", "صلصة ومعجون طماطم", "طحينة وحلاوة"]
  },
  plastics: {
    en: ["Injection-molded parts", "PET bottles", "Household plasticware", "Plastic pallets"],
    ar: ["قطع حقن بلاستيك", "زجاجات PET", "أدوات منزلية بلاستيكية", "بالتات بلاستيك"]
  },
  metal: {
    en: ["Steel structures", "Sheet-metal enclosures", "Aluminum profiles", "Stainless kitchen equipment"],
    ar: ["هياكل معدنية", "صاج مُشكَّل", "قطاعات ألوميتال", "تجهيزات مطابخ استانلس"]
  },
  chemicals: {
    en: ["Detergents", "Industrial adhesives", "Paints & coatings", "Water-treatment chemicals"],
    ar: ["منظفات", "مواد لاصقة صناعية", "دهانات وطلاءات", "كيماويات معالجة مياه"]
  },
  cosmetics: {
    en: ["Skincare creams", "Hair-care products", "Perfumes & body sprays", "Private-label lines"],
    ar: ["كريمات عناية بالبشرة", "منتجات عناية بالشعر", "عطور وبادي سبراي", "خطوط علامة خاصة"]
  },
  construction: {
    en: ["Cement bricks", "Ceramic tiles", "Gypsum boards", "Interlock paving"],
    ar: ["طوب أسمنتي", "سيراميك وبلاط", "ألواح جبس", "إنترلوك"]
  },
  medical: {
    en: ["Disposable gowns & masks", "Syringes", "Cotton & gauze", "Medical furniture"],
    ar: ["أرواب وكمامات", "سرنجات", "قطن وشاش طبي", "أثاث طبي"]
  },
  promo: {
    en: ["Branded mugs & bottles", "Printed notebooks", "Tote bags", "Corporate gift sets"],
    ar: ["أكواب وزجاجات بشعار", "نوت بوك مطبوع", "شنط قماش", "أطقم هدايا شركات"]
  },
  electronics: {
    en: ["LED lighting", "PCB assembly", "Home appliances parts", "Power supplies"],
    ar: ["إضاءة ليد", "تجميع لوحات إلكترونية", "قطع أجهزة منزلية", "وحدات تغذية كهربائية"]
  },
  agriculture: {
    en: ["Dried herbs & spices", "Dates processing", "Frozen fruits", "Animal feed"],
    ar: ["أعشاب وتوابل مجففة", "تصنيع تمور", "فواكه مجمدة", "أعلاف"]
  },
  automotive: {
    en: ["Rubber & plastic parts", "Wire harnesses", "Filters", "Seat components"],
    ar: ["قطع كاوتش وبلاستيك", "ضفائر أسلاك", "فلاتر", "مكونات مقاعد"]
  }
};

const IND_CAPS = {
  textile: {
    en: ["Knitting & weaving", "Dyeing & finishing", "Embroidery & printing", "Full CMT production"],
    ar: ["تريكو ونسيج", "صباغة وتجهيز", "تطريز وطباعة", "تشغيل كامل CMT"]
  },
  packaging: {
    en: ["Offset & flexo printing", "Die cutting", "Lamination", "Custom structural design"],
    ar: ["طباعة أوفست وفلكسو", "تقطيع بالقوالب", "سلوفان ولامينيشن", "تصميم هيكلي مخصص"]
  },
  furniture: {
    en: ["CNC wood cutting", "Veneer & lacquer finishing", "Upholstery", "Custom joinery"],
    ar: ["قص خشب CNC", "قشرة ودوكو", "تنجيد", "نجارة حسب الطلب"]
  },
  food: {
    en: ["Automated filling lines", "Cold storage", "Private labeling", "HACCP production"],
    ar: ["خطوط تعبئة آلية", "تخزين مبرد", "تعبئة بعلامة خاصة", "إنتاج وفق HACCP"]
  },
  plastics: {
    en: ["Injection molding", "Blow molding", "Mold design & making", "Recycled material lines"],
    ar: ["حقن بلاستيك", "نفخ بلاستيك", "تصميم وتصنيع اسطمبات", "خطوط خامات معاد تدويرها"]
  },
  metal: {
    en: ["Laser cutting", "CNC bending", "MIG/TIG welding", "Powder coating"],
    ar: ["قص ليزر", "ثني CNC", "لحام ميج/تيج", "دهان إلكتروستاتيك"]
  },
  chemicals: {
    en: ["Batch blending", "Filling & bottling", "Formulation lab", "Custom formulations"],
    ar: ["خلط دفعات", "تعبئة وتغليف", "معمل تركيبات", "تركيبات حسب الطلب"]
  },
  cosmetics: {
    en: ["Emulsion production", "Filling & capping", "Stability testing", "Private-label development"],
    ar: ["إنتاج مستحلبات", "تعبئة وغلق", "اختبارات ثبات", "تطوير علامات خاصة"]
  },
  construction: {
    en: ["Automated pressing", "Kiln firing", "Quality lab testing", "Bulk delivery"],
    ar: ["كبس آلي", "حرق بالأفران", "اختبارات معملية", "توريد بالجملة"]
  },
  medical: {
    en: ["Cleanroom production", "ETO sterilization", "Automated assembly", "Batch traceability"],
    ar: ["إنتاج بغرف نظيفة", "تعقيم بغاز ETO", "تجميع آلي", "تتبع التشغيلات"]
  },
  promo: {
    en: ["Screen & pad printing", "Laser engraving", "Sublimation", "Custom packaging"],
    ar: ["طباعة سلك سكرين وباد", "حفر ليزر", "طباعة سبليميشن", "تغليف مخصص"]
  },
  electronics: {
    en: ["SMT assembly", "Through-hole soldering", "Functional testing", "Enclosure assembly"],
    ar: ["تجميع SMT", "لحام يدوي", "اختبار وظيفي", "تجميع نهائي"]
  },
  agriculture: {
    en: ["Sorting & grading", "Drying & dehydration", "IQF freezing", "Fumigation"],
    ar: ["فرز وتدريج", "تجفيف", "تجميد سريع IQF", "تبخير"]
  },
  automotive: {
    en: ["Rubber compression molding", "Precision machining", "Assembly lines", "PPAP documentation"],
    ar: ["كبس كاوتش", "تشغيل دقيق", "خطوط تجميع", "توثيق PPAP"]
  }
};

const CERTS = ["ISO 9001", "ISO 14001", "ISO 22000", "CE", "GMP", "OEKO-TEX", "HACCP", "ISO 13485"];

const IND_SERVICES = {
  textile: {
    en: [
      { icon: ICONS.printer, name: "Fabric Printing" },
      { icon: ICONS.textile, name: "Embroidery" },
      { icon: ICONS.scissors, name: "Pattern Making" },
      { icon: ICONS.box, name: "Private Labeling" },
      { icon: ICONS.palette, name: "Custom Dyeing" }
    ],
    ar: [
      { icon: ICONS.printer, name: "طباعة أقمشة" },
      { icon: ICONS.textile, name: "تطريز" },
      { icon: ICONS.scissors, name: "تصميم باترونات" },
      { icon: ICONS.box, name: "تعبئة بعلامة خاصة" },
      { icon: ICONS.palette, name: "صباغة مخصصة" }
    ]
  },
  packaging: {
    en: [
      { icon: ICONS.palette, name: "Graphic Design" },
      { icon: ICONS.ruler, name: "Structural Design" },
      { icon: ICONS.tag, name: "Barcode Generation" },
      { icon: ICONS.box, name: "Assembly & Fulfillment" }
    ],
    ar: [
      { icon: ICONS.palette, name: "تصميم جرافيك" },
      { icon: ICONS.ruler, name: "تصميم هيكلي" },
      { icon: ICONS.tag, name: "إنشاء باركود" },
      { icon: ICONS.box, name: "تجميع وشحن" }
    ]
  },
  furniture: {
    en: [
      { icon: ICONS.palette, name: "Custom Finishing" },
      { icon: ICONS.ruler, name: "CAD Design" },
      { icon: ICONS.wrench, name: "Assembly Service" },
      { icon: ICONS.truck, name: "Delivery & Installation" }
    ],
    ar: [
      { icon: ICONS.palette, name: "تشطيب مخصص" },
      { icon: ICONS.ruler, name: "تصميم CAD" },
      { icon: ICONS.wrench, name: "خدمة تجميع" },
      { icon: ICONS.truck, name: "توصيل وتركيب" }
    ]
  },
  food: {
    en: [
      { icon: ICONS.tag, name: "Private Labeling" },
      { icon: ICONS.box, name: "Custom Packaging" },
      { icon: ICONS.microscope, name: "Shelf-life Testing" },
      { icon: ICONS.clipboard, name: "Nutritional Labeling" }
    ],
    ar: [
      { icon: ICONS.tag, name: "علامة خاصة" },
      { icon: ICONS.box, name: "تغليف مخصص" },
      { icon: ICONS.microscope, name: "اختبار صلاحية" },
      { icon: ICONS.clipboard, name: "بطاقة غذائية" }
    ]
  },
  plastics: {
    en: [
      { icon: ICONS.gear, name: "Mold Design" },
      { icon: ICONS.palette, name: "Color Matching" },
      { icon: ICONS.box, name: "Assembly" },
      { icon: ICONS.recycle, name: "Recycled Options" }
    ],
    ar: [
      { icon: ICONS.gear, name: "تصميم اسطمبات" },
      { icon: ICONS.palette, name: "مطابقة ألوان" },
      { icon: ICONS.box, name: "تجميع" },
      { icon: ICONS.recycle, name: "خيارات معاد تدويرها" }
    ]
  },
  metal: {
    en: [
      { icon: ICONS.palette, name: "Powder Coating" },
      { icon: ICONS.wrench, name: "Assembly" },
      { icon: ICONS.ruler, name: "CAD/CAM" },
      { icon: ICONS.microscope, name: "Quality Testing" }
    ],
    ar: [
      { icon: ICONS.palette, name: "دهان إلكتروستاتيك" },
      { icon: ICONS.wrench, name: "تجميع" },
      { icon: ICONS.ruler, name: "CAD/CAM" },
      { icon: ICONS.microscope, name: "فحص جودة" }
    ]
  },
  chemicals: {
    en: [
      { icon: ICONS.testtube, name: "Formulation" },
      { icon: ICONS.box, name: "Contract Filling" },
      { icon: ICONS.tag, name: "Private Labeling" },
      { icon: ICONS.microscope, name: "Lab Testing" }
    ],
    ar: [
      { icon: ICONS.testtube, name: "تركيبات" },
      { icon: ICONS.box, name: "تعبئة تعاقدية" },
      { icon: ICONS.tag, name: "علامة خاصة" },
      { icon: ICONS.microscope, name: "فحص معملي" }
    ]
  },
  cosmetics: {
    en: [
      { icon: ICONS.testtube, name: "Formula Development" },
      { icon: ICONS.box, name: "Filling & Packing" },
      { icon: ICONS.tag, name: "White Label" },
      { icon: ICONS.microscope, name: "Stability Testing" }
    ],
    ar: [
      { icon: ICONS.testtube, name: "تطوير تركيبات" },
      { icon: ICONS.box, name: "تعبئة وتغليف" },
      { icon: ICONS.tag, name: "علامة بيضاء" },
      { icon: ICONS.microscope, name: "اختبار ثبات" }
    ]
  },
  construction: {
    en: [
      { icon: ICONS.truck, name: "Bulk Delivery" },
      { icon: ICONS.ruler, name: "Custom Sizes" },
      { icon: ICONS.microscope, name: "Material Testing" },
      { icon: ICONS.clipboard, name: "Technical Support" }
    ],
    ar: [
      { icon: ICONS.truck, name: "توصيل بالجملة" },
      { icon: ICONS.ruler, name: "مقاسات مخصصة" },
      { icon: ICONS.microscope, name: "فحص مواد" },
      { icon: ICONS.clipboard, name: "دعم فني" }
    ]
  },
  medical: {
    en: [
      { icon: ICONS.testtube, name: "Sterilization" },
      { icon: ICONS.box, name: "Cleanroom Packing" },
      { icon: ICONS.tag, name: "Custom Labeling" },
      { icon: ICONS.clipboard, name: "Regulatory Support" }
    ],
    ar: [
      { icon: ICONS.testtube, name: "تعقيم" },
      { icon: ICONS.box, name: "تعبئة نظيفة" },
      { icon: ICONS.tag, name: "ملصقات مخصصة" },
      { icon: ICONS.clipboard, name: "دعم تنظيمي" }
    ]
  },
  promo: {
    en: [
      { icon: ICONS.palette, name: "Graphic Design" },
      { icon: ICONS.printer, name: "Branding" },
      { icon: ICONS.box, name: "Gift Wrapping" },
      { icon: ICONS.truck, name: "Drop Shipping" }
    ],
    ar: [
      { icon: ICONS.palette, name: "تصميم جرافيك" },
      { icon: ICONS.printer, name: "علامة تجارية" },
      { icon: ICONS.box, name: "تغليف هدايا" },
      { icon: ICONS.truck, name: "شحن مباشر" }
    ]
  },
  electronics: {
    en: [
      { icon: ICONS.wrench, name: "PCB Design" },
      { icon: ICONS.box, name: "Enclosure Design" },
      { icon: ICONS.microscope, name: "Functional Testing" },
      { icon: ICONS.clipboard, name: "Certification Support" }
    ],
    ar: [
      { icon: ICONS.wrench, name: "تصميم PCB" },
      { icon: ICONS.box, name: "تصميم هيكل" },
      { icon: ICONS.microscope, name: "اختبار وظيفي" },
      { icon: ICONS.clipboard, name: "دعم شهادات" }
    ]
  },
  agriculture: {
    en: [
      { icon: ICONS.box, name: "Custom Packing" },
      { icon: ICONS.tag, name: "Private Label" },
      { icon: ICONS.microscope, name: "Quality Grading" },
      { icon: ICONS.truck, name: "Cold Chain" }
    ],
    ar: [
      { icon: ICONS.box, name: "تعبئة مخصصة" },
      { icon: ICONS.tag, name: "علامة خاصة" },
      { icon: ICONS.microscope, name: "تدريج جودة" },
      { icon: ICONS.truck, name: "سلسلة تبريد" }
    ]
  },
  automotive: {
    en: [
      { icon: ICONS.wrench, name: "Reverse Engineering" },
      { icon: ICONS.ruler, name: "3D Scanning" },
      { icon: ICONS.microscope, name: "Material Testing" },
      { icon: ICONS.clipboard, name: "PPAP Documentation" }
    ],
    ar: [
      { icon: ICONS.wrench, name: "هندسة عكسية" },
      { icon: ICONS.ruler, name: "مسح ثلاثي" },
      { icon: ICONS.microscope, name: "فحص مواد" },
      { icon: ICONS.clipboard, name: "توثيق PPAP" }
    ]
  }
};

// Seeded random number generator
function mulberry(a) {
  return function() {
    a |= 0;
    a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const rng = mulberry(20260706);

// Helper functions for random generation
const pick = arr => arr[Math.floor(rng() * arr.length)];
const MOQS = [50, 100, 200, 300, 500, 1000, 2000, 5000, 10000];

const DESC_T = {
  en: (n, i, g, y) => `${n} is an Egyptian manufacturer specialized in ${i.toLowerCase()}, operating from ${g} since ${y}.`,
  ar: (n, i, g, y) => `${n} مصنع مصري متخصص في مجال ${i}، يعمل من ${g} منذ عام ${y}.`
};

// Generate factory data
const FACTORIES = (function() {
  let pi = 0;
  const factories = [];
  
  for (let i = 0; i < 50; i++) {
    const ind = INDUSTRIES[i % INDUSTRIES.length];
    const pre = PREFIX[pi % PREFIX.length];
    pi += (i % 3 === 0 ? 1 : 2);
    const gov = GOVS[Math.floor(rng() * GOVS.length)];
    const yr = 1985 + Math.floor(rng() * 36);
    const moq = pick(MOQS);
    const exp = rng() > 0.45;
    const certCount = Math.floor(rng() * 3);
    const certs = [...CERTS].sort(() => rng() - 0.5).slice(0, certCount);
    const emp = pick(["10–50", "50–100", "100–250", "250–500", "500+"]);
    const nameEn = `${pre.en} ${IND_WORD[ind.id].en}`;
    const nameAr = `${pre.ar} ${IND_WORD[ind.id].ar}`;
    
    const dailyCapacity = pick([200, 500, 800, 1000, 1500, 2000, 3000, 5000]);
    const monthlyCapacity = dailyCapacity * 26;
    const rating = Math.round((3.5 + rng() * 1.8) * 10) / 10;
    const reviewCount = Math.floor(10 + rng() * 90);
    
    const industryServices = IND_SERVICES[ind.id];
    const allServices = industryServices ? [...industryServices.en] : [];
    const shuffledServices = [...allServices].sort(() => rng() - 0.5);
    const selectedCount = 2 + Math.floor(rng() * (allServices.length - 1));
    const services = shuffledServices.slice(0, Math.min(selectedCount, allServices.length));
    
    factories.push({
      id: "f" + i,
      industry: ind.id,
      gov,
      yr,
      moq,
      exp,
      certs,
      emp,
      name: { en: nameEn, ar: nameAr },
      phone: "+20 10" + String(10000000 + Math.floor(rng() * 89999999)),
      desc: {
        en: DESC_T.en(nameEn, ind.en, gov.en, yr),
        ar: DESC_T.ar(nameAr, ind.ar, gov.ar, yr)
      },
      featured: i < 6,
      dailyCapacity,
      monthlyCapacity,
      rating,
      reviewCount,
      services
    });
  }
  
  return factories;
})();

// Initial requests data
let REQUESTS = [
  {
    id: "r1", icon: ICONS.shirt, days: 0, qty: "5,000", budget: "250,000",
    title: { en: "Cotton polo shirts with embroidered logo", ar: "قمصان بولو قطنية بشعار مطرز" },
    desc: { en: "Looking for 5,000 pique polo shirts (100% Egyptian cotton, 220 gsm) in 4 colors.", ar: "مطلوب ٥٠٠٠ قميص بولو بيكيه (قطن مصري ١٠٠٪، ٢٢٠ جم) بأربعة ألوان." },
    material: { en: "100% Egyptian cotton", ar: "قطن مصري ١٠٠٪" },
    gov: 0, by: { en: "Nour Apparel", ar: "نور للملابس" }, contact: "+20 100 555 0192"
  },
  {
    id: "r2", icon: ICONS.jar, days: 1, qty: "20,000", budget: null,
    title: { en: "Glass jars with printed lids", ar: "برطمانات زجاجية بأغطية مطبوعة" },
    desc: { en: "380 ml glass jars with custom-printed twist-off lids.", ar: "برطمانات زجاج ٣٨٠ مل بأغطية معدنية مطبوعة." },
    material: { en: "Glass, tinplate", ar: "زجاج، صفيح" },
    gov: 2, by: { en: "Karam Foods", ar: "كرم للأغذية" }, contact: "+20 101 444 7736"
  },
  {
    id: "r3", icon: ICONS.furniture, days: 2, qty: "120", budget: "900,000",
    title: { en: "Café furniture set", ar: "أثاث كافيه" },
    desc: { en: "120 chairs and 40 tables with matte lacquer finish.", ar: "١٢٠ كرسي و٤٠ طاولة بتشطيب دوكو مطفي." },
    material: { en: "Beech wood", ar: "خشب زان" },
    gov: 1, by: { en: "Bunn Café", ar: "بُن للكافيهات" }, contact: "+20 106 210 8845"
  },
  {
    id: "r4", icon: ICONS.plastics, days: 3, qty: "50,000", budget: null,
    title: { en: "HDPE bottles 250 ml", ar: "زجاجات HDPE ٢٥٠ مل" },
    desc: { en: "Monthly supply of 50,000 white HDPE bottles.", ar: "توريد شهري ٥٠ ألف زجاجة HDPE بيضاء." },
    material: { en: "HDPE, PP caps", ar: "HDPE وأغطية PP" },
    gov: 5, by: { en: "Sator Clean", ar: "ساتور كلين" }, contact: "+20 122 300 4519"
  },
  {
    id: "r5", icon: ICONS.promo, days: 4, qty: "2,000", budget: "180,000",
    title: { en: "Corporate gift boxes", ar: "علب هدايا شركات" },
    desc: { en: "2,000 gift sets with branded mug and notebook.", ar: "٢٠٠٠ طقم هدايا بمج ونوت بوك بشعار." },
    material: { en: "Rigid board, ceramic", ar: "كرتون مقوى، سيراميك" },
    gov: 0, by: { en: "Meem Marketing", ar: "ميم للتسويق" }, contact: "+20 109 887 2210"
  },
  {
    id: "r6", icon: ICONS.medical, days: 6, qty: "100,000", budget: null,
    title: { en: "Disposable non-woven gowns", ar: "أرواب غير منسوجة" },
    desc: { en: "100k SMS non-woven gowns (35 gsm, EN 13795).", ar: "١٠٠ ألف روب SMS غير منسوج (٣٥ جم)." },
    material: { en: "SMS non-woven", ar: "SMS غير منسوج" },
    gov: 3, by: { en: "PortEx Trading", ar: "بورت إكس" }, contact: "+20 114 652 9903"
  }
];
