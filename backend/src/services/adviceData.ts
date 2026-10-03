/**
 * Static Shimla (Himachal Pradesh) apple knowledge base.
 * Content follows HP Horticulture Department extension guidance in general
 * terms; always confirm spray products and rates with your Circle
 * Horticulture Development Officer and the product label.
 */

export interface DiseaseInfo {
  code: string;
  name: string;
  category: 'fungal' | 'pest' | 'bacterial' | 'environmental' | 'nutritional';
  signs: string;
  window: string;
  organic: string[];
  chemical: string[];
}

export const DISEASES: DiseaseInfo[] = [
  {
    code: 'apple-scab',
    name: 'Apple scab',
    category: 'fungal',
    signs: 'Olive-green to dark brown blotches on leaves and fruit; fruit lesions crack and cork as they grow. Worst in wet monsoon weather.',
    window: 'Pink bud → monsoon (mid-March to August). Primary infections from bud break; repeat cycles every 12-15 wet days.',
    organic: ['Dormant sanitation: urea 5% on leaf litter post-harvest', 'Sulphur 80 WP 0.25% in low-pressure periods', 'Remove and destroy infected shoots promptly'],
    chemical: ['Mancozeb 75 WP 0.25% protectant at pink bud', 'Carbendazim 50 WP 0.05% or Thiophanate-methyl 70 WP after petal fall', 'Hexaconazole 5 EC 0.05% when lesions active; rotate groups'],
  },
  {
    code: 'powdery-mildew',
    name: 'Powdery mildew',
    category: 'fungal',
    signs: 'White powdery coating on young leaves and shoots; leaves crinkle, curl and become brittle; stunted terminal growth.',
    window: 'Petal fall → June. Warm dry days with cool nights favour it.',
    organic: ['Sulphur 80 WP 0.25% (also works for mites)', 'Prune out infected terminals in early summer and burn'],
    chemical: ['Hexaconazole 5 EC 0.05%', 'Myclobutanil 10 WP 0.05% (rotate with sulphur)'],
  },
  {
    code: 'alternaria-blotch',
    name: 'Alternaria leaf blotch',
    category: 'fungal',
    signs: 'Circular brown spots with purple margin on leaves; premature yellowing and heavy leaf fall in June-July; fruit spots near harvest.',
    window: 'Late May → September, worst in humid monsoon.',
    organic: ['Improve air movement by pruning; avoid water stress', 'Collect and compost fallen leaves'],
    chemical: ['Mancozeb 75 WP 0.3% on a 15-day cycle', 'Ziram 80 WP 0.3% alternated with Captan 50 WP'],
  },
  {
    code: 'marssonina-leaf-fall',
    name: 'Marssonina leaf fall',
    category: 'fungal',
    signs: 'Small dark brown spots that enlarge; leaves yellow and drop in large numbers by August, weakening next year\'s buds.',
    window: 'Monsoon (July-August).',
    organic: ['Urea 5% post-harvest sanitation spray', 'Orchard floor hygiene'],
    chemical: ['Captan 50 WP 0.3%', 'Mancozeb 75 WP 0.3% monsoon cycle'],
  },
  {
    code: 'collar-rot',
    name: 'Collar rot / Phytophthora',
    category: 'fungal',
    signs: 'Dark sunken bark at the base; gummosis; leaves pale and small; tree declines over seasons. Worst in waterlogged basins.',
    window: 'Any time; check after heavy rains or over-irrigation.',
    organic: ['Improve drainage, keep water away from the trunk', 'Bordopaste trunks in November', 'Expose and dry the collar region'],
    chemical: ['Metalaxyl + Mancozeb 72 WP soil drench near collar as per label', 'Copper oxychloride paste on affected bark after scraping'],
  },
  {
    code: 'fire-blight',
    name: 'Fire blight (suspected - report it)',
    category: 'bacterial',
    signs: 'Shoot tips wilt into a shepherd\'s crook and look scorched; bacterial ooze in humid weather. NOTIFIABLE - report to the Horticulture Department.',
    window: 'Bloom → early summer, spread by rain, insects, pruning tools.',
    organic: ['Cut 30 cm below visible damage; sterilise tools between cuts (70% alcohol)', 'Avoid excess nitrogen'],
    chemical: ['Streptomycin sulphate spray during bloom in confirmed outbreaks (dept. advice)'],
  },
  {
    code: 'woolly-aphid',
    name: 'Woolly aphid',
    category: 'pest',
    signs: 'Cottony white masses on wounds, branch crotches and roots; galls on branches; sticky honeydew with black sooty mould.',
    window: 'Peaks May-June and again Sep-Oct; overwinters in bark crevices.',
    organic: ['Dormant oil 2% in Jan-Feb', 'Scrape loose bark; prune out galled wood', 'Avoid excess nitrogen that drives succulent growth'],
    chemical: ['Imidacloprid 17.8 SL 0.3 ml/L when colonies active', 'Thiamethoxam 25 WG as alternative'],
  },
  {
    code: 'san-jose-scale',
    name: 'San José scale',
    category: 'pest',
    signs: 'Grey-brown scales on bark and fruit; red rings on fruit where feeding; branch dieback in heavy infestations.',
    window: 'Dormant spray controls crawlers; generations April-October.',
    organic: ['Dormant oil 2% - the single most effective control', 'Prune and burn heavily crusted wood'],
    chemical: ['Dormant oil + chlorpyrifos only for heavy infestations (label rate)', 'Buprofezin 25 SC for crawler stage in May'],
  },
  {
    code: 'codling-moth',
    name: 'Codling moth',
    category: 'pest',
    signs: 'Fruit with entry holes and frass; larvae tunnel to the core; premature drop. Classic "wormy apples".',
    window: '1st gen after petal fall; 2nd gen July; monitor with pheromone traps.',
    organic: ['Corrugated cardboard trunk bands; remove weekly', 'Remove infested drops promptly', 'Pheromone mating disruption at 500 dispensers/ha'],
    chemical: ['Chlorantraniliprole 18.5 SC 0.3 ml/L when traps exceed 5 moths/week', 'Deltamethrin 2.8 EC 0.5 ml/L (2nd gen)'],
  },
  {
    code: 'blossom-thrips',
    name: 'Blossom thrips',
    category: 'pest',
    signs: 'Scarred, russeted fruit skin from feeding at bloom; petals browning and distortion.',
    window: 'Pink bud → petal fall only (bee-safe timing essential).',
    organic: ['Avoid orchard-edge weedy hosts flowering simultaneously', 'Blue sticky traps for monitoring'],
    chemical: ['Thiamethoxam 25 WG 0.025% at pink bud ONLY if thrips confirmed; spray after 6 pm to protect bees'],
  },
  {
    code: 'spider-mites',
    name: 'Spider mites',
    category: 'pest',
    signs: 'Fine stippling on leaves, bronzing, webbing on shoots under heavy pressure; leaf burn in dry spells.',
    window: 'May-August, peaks in hot dry weather.',
    organic: ['Sulphur 80 WP 0.25%', 'Avoid broad-spectrum insecticides that kill predatory mites', 'Dust roads near orchards worsen mites - keep dust down'],
    chemical: ['Propargite 57 EC 0.1%', 'Fenazaquin 10 EC as per label'],
  },
  {
    code: 'hail-damage',
    name: 'Hail damage',
    category: 'environmental',
    signs: 'Bruised and split fruit, shredded leaves, bark wounds on upper branches.',
    window: 'March-June hail corridor (Shimla belt).',
    organic: ['Anti-hail nets are the only real protection (16% shade net)', 'Remove badly damaged fruit to prevent rot', 'Bordopaste bark wounds'],
    chemical: ['Captan 50 WP after hail to prevent rot entry points'],
  },
  {
    code: 'sunscald',
    name: 'Sunscald / heat stress',
    category: 'environmental',
    signs: 'Water-soaked then sunken bark patches on southwest side; fruit surface browning in extreme heat.',
    window: 'Summer heat spells; young trees most at risk.',
    organic: ['Whitewash young trunks (lime 1 : water 10 with glue)', 'Keep basins mulched and watered', 'Avoid hard summer pruning that exposes bark'],
    chemical: [],
  },
  {
    code: 'nutrient-deficiency',
    name: 'Nutrient deficiency (Ca / Zn / B / N)',
    category: 'nutritional',
    signs: 'Chlorotic yellow leaves with green veins (Fe/Zn), bitter pit spots in stored fruit (Ca), dieback and poor fruit set (B), pale small leaves overall (N).',
    window: 'Visible May-September; correct next season via soil test.',
    organic: ['Apply well-rotted FYM 40-60 kg/mature tree in Dec-Jan', 'Foliar compost teas as supplements'],
    chemical: ['Calcium chloride 0.6% × 2-3 for bitter pit (Jul-Aug)', 'ZnSO4 0.3% + lime at petal fall for zinc', 'Borax 0.2% pre-bloom for boron', 'Balanced NPK per soil test report (SKUAST-YSPUHF or HP Horticulture soil testing lab)'],
  },
];

export interface AdviceArticle {
  id: string;
  month: number; // 1-12, or 0 = all year
  category: string;
  title: string;
  body: string;
}

export const ADVICE_ARTICLES: AdviceArticle[] = [
  { id: 'jan-pruning-start', month: 1, category: 'Pruning', title: 'Start winter pruning in the low blocks', body: 'January is safe for pruning in the lower and mid belts (below ~2200 m). Work block by block: first remove dead, diseased and crossing wood, then thin crowded spurs. Keep the modified-leader structure with 45° scaffold angles on mature Delicious trees. Seal cuts over 2 cm with wound paint. Sterilise tools with 70% alcohol between trees wherever canker or dieback was seen last year.' },
  { id: 'jan-fym', month: 1, category: 'Nutrition', title: 'Apply farmyard manure now', body: 'December-January is FYM season: 40-60 kg per mature tree (20-30 kg for young trees), spread under the canopy drip line and lightly forked in. Well-rotted manure improves the water-holding capacity of hill soils before the dry months. If you skipped it in December, do it before bud break. This is also the time to collect a soil sample (6-8 spots per block, 30 cm deep) for the HP Horticulture soil testing lab.' },
  { id: 'feb-oil', month: 2, category: 'Spraying', title: 'Finish the dormant oil spray before bud break', body: 'The 2% horticultural mineral oil spray (4 L per 200 L water) must be on before green tip. It smothers overwintering woolly aphid colonies, San José scale crawlers and mite eggs - the cheapest, least toxic spray of the year. Choose a dry morning above 4°C and drench stems and crotches thoroughly. Never mix oil with sulphur or apply it to water-stressed trees.' },
  { id: 'feb-pruning-high', month: 2, category: 'Pruning', title: 'Upper belt: prune before the snow fully lifts', body: 'Above ~2200 m (Kotkhai, Chopal, high Thanedar) February is the main pruning month. Prioritise blocks that showed weak canopy or heavy bare wood in your app survey - renewal pruning over 2-3 seasons works far better than one severe cut. Train young trees (1-5 years) to a modified leader; retain feathers at good angles rather than cutting everything back.' },
  { id: 'mar-pink-bud', month: 3, category: 'Spraying', title: 'Pink bud: the scab spray you cannot miss', body: 'From green tip to pink bud, scab ascospores start launching with every rain. The pink-bud mancozeb 0.25% spray is the highest-ROI spray of the season for the Shimla belt. If more than 12 hours of wet foliage follows, plan a repeat once leaves dry. Use 400-600 L spray solution per hectare for full coverage of mature trees.' },
  { id: 'mar-bees', month: 3, category: 'Pollination', title: 'Book your beehives for bloom', body: 'Royal Delicious and most coloured strains are self-incompatible - without pollinizers and bees you get poor set. Place 2 strong Apis mellifera boxes per hectare at 10% bloom, ideally in groups on the upwind edge. Check pollinizer placement: one pollinizer (Golden Delicious, Vance Delicious, Tydeman\'s, or crab apple) for every 8-9 Delicious trees, or a full pollinizer row every 5th row. Never spray insecticides during bloom.' },
  { id: 'apr-frost', month: 4, category: 'Weather', title: 'Bloom-time frost protection', body: 'April radiation frosts (clear calm nights, -2°C at blossom stage) can wipe out a crop. Watch forecasts at full bloom and petal fall. Practical protections for hill orchards: overhead sprinkler irrigation started before frost settles (ice protects at -1 to -2°C), smudge fires/bale fires on the lower edge at 2-4 am, and keeping basins moist - wet soil holds more night heat than dry.' },
  { id: 'apr-petal-fall', month: 4, category: 'Spraying', title: 'Petal fall: scab + moth + first thinning decisions', body: 'Once 90% of petals are down, apply the petal-fall spray (carbendazim 0.05% for scab + sulphur for mildew/mites). Hang codling moth pheromone traps now - 5 traps per hectare at canopy height - and record weekly counts in your notes; spray only above 5 moths per trap per week. Start assessing fruit set: heavy set blocks need hand thinning in May.' },
  { id: 'may-thinning', month: 5, category: 'Crop load', title: 'Hand-thin within 40 days of full bloom', body: 'Thinning before the 40-day mark returns its full benefit to fruit size and return bloom. Keep one fruit per cluster (the king fruit if well placed), spaced 15 cm apart. A mature Delicious tree should carry roughly 150-250 fruit after thinning - more means small fruit, biennial bearing and broken limbs. Over-thinned trees produce bitter-prone fruit; under-thinned trees exhaust themselves.' },
  { id: 'may-drop-control', month: 5, category: 'Crop load', title: 'One NAA spray for pre-harvest drop', body: 'For Royal Delicious blocks with a history of fruit drop in August winds, a single NAA 10 ppm spray 10-14 days after petal fall also improves return bloom. Later stop-drop sprays (2 weeks before expected drop) are a rescue option - but note the pre-harvest interval on the label carefully.' },
  { id: 'jun-irrigation', month: 6, category: 'Water', title: 'June irrigation decides fruit size', body: 'Final fruit size is largely set by cell division in the 40-45 days after bloom - a dry June permanently caps it. Give mature trees 600-800 L per week in dry spells (drip: 60-80 L/day/tree in two pulses). Mulch basins with 10 cm of dry grass or straw, keeping the trunk clear. Hill slopes shed water - build small basins and check them after every storm.' },
  { id: 'jun-hail', month: 6, category: 'Weather', title: 'Hail season: nets up, drains clear', body: 'The pre-monsoon hail corridor runs March-June in the Shimla belt. If you have anti-hail net, re-tension it now and fix tears - a loose net does more damage than none in wind. Clear the drainage channels along terraces so a cloudburst sheets water off without gouging. Prop heavy scaffold limbs before storms; a loaded limb cracked at the crotch is a permanent loss.' },
  { id: 'jul-monsoon-spray', month: 7, category: 'Spraying', title: 'Hold the 12-15 day monsoon spray cycle', body: 'Through the monsoon, every 12+ hour wet-foliage period is a scab and Alternaria infection window. Keep captan/mancozeb on a 12-15 day rotation for late varieties; early varieties should be clear of pesticides and on calcium only. Walk the block weekly - the app\'s photo survey is a quick way to record where leaf fall is starting.' },
  { id: 'jul-leaf-analysis', month: 7, category: 'Nutrition', title: 'Leaf analysis window: 15 Jul - 15 Aug', body: 'Leaf sampling now (mid-shoot leaves, 30-40 per block, submitted to YSPUHF/HP Horticulture lab) tells you exactly what to correct next season - much more reliable than guesswork. Sample trees of the same age and variety, avoid sprayed/hailed leaves, and send within a day. Pair the report with your soil test for a full picture.' },
  { id: 'aug-harvest-early', month: 8, category: 'Harvest', title: 'Early varieties: pick by index, not colour', body: 'Colour comes before maturity in the hills - picking on red alone costs sweetness and storage life. Use maturity indices: 140-150 days from full bloom (Royal Delicious), starch-iodine test 2-3, firmness 15-17 lb, and background colour turning from green to yellowish. Pick into padded crates in the cool hours; fruit picked warm must be pre-cooled within 24 hours.' },
  { id: 'aug-calcium', month: 8, category: 'Nutrition', title: 'Last calcium sprays for bitter pit', body: 'Finish the calcium chloride 0.6% series (2-3 sprays, 10 days apart) before harvest on bitter-pit-prone blocks - light crops, Royal Delicious, and young vigorous trees are the classic cases. Never mix calcium with pesticides; evening spraying avoids leaf burn. Fruit calcium at harvest decides whether your stored fruit comes out clean in December.' },
  { id: 'sep-harvest-main', month: 9, category: 'Harvest', title: 'Main harvest: grading pays the bills', body: 'Grade in the shade, the day you pick: the Theog/Dhalli market pays for size and colour class separation, not averages. Handle fruit like eggs - every bruise is a storage rot. Line picking bags, never drop fruit, and keep field heat down (pre-cool or at least night-ventilate the store). Record harvest weights per block in the app so next year\'s yield survey has a baseline.' },
  { id: 'sep-post-harvest', month: 9, category: 'Spraying', title: 'Post-harvest urea on late blocks', body: 'As soon as the last late-variety fruit is off, spray 5% urea on the trees AND the fallen leaves. This softens leaves, speeds decomposition and cuts next spring\'s scab ascospore load dramatically - one of the highest-value sanitation actions in the whole year. Remove mummy fruit and bury or hot-compost leaf litter away from the block.' },
  { id: 'oct-storage', month: 10, category: 'Post-harvest', title: 'Store check and orchard close-out', body: 'Check stored fruit every 2-3 weeks for rot and scald; sort out affected fruit before it spreads. In the orchard: finish urea sanitation on late blocks, remove tree props, repair terraces and channels after the monsoon, and complete the app\'s harvest survey summary so pruning priorities are ready for winter.' },
  { id: 'nov-winter-prep', month: 11, category: 'Weather', title: 'Winter-proof the orchard', body: 'Paint lower trunks with bordopaste (collar rot and bark-borer protection), scrape loose bark where woolly aphid hides first. Repair anti-hail nets, tree guards and fences before snowload. Young trees: stake them straight and wrap the lower trunk against rodents. Service the spray machine, flush the pump, and store nozzles clean - a February breakdown costs you the oil spray.' },
  { id: 'dec-planning', month: 12, category: 'Planning', title: 'Plan winter work from your survey data', body: 'Before pruning starts, review the year: app harvest summaries show which blocks over- or under-cropped; photo health trends show where canopies declined; the spray log shows what worked. Convert this into a block-by-block winter plan: renewal blocks, replants needed, pollinizer gaps to fill, and the spray shopping list for next season.' },
  { id: 'all-record-keeping', month: 0, category: 'Practice', title: 'Records are the cheapest technology you own', body: 'A photo of every tree with a health note, dated, costs minutes - and after two seasons it is worth more than any consultant visit: spray dates vs disease onset, yields per block vs pruning intensity, which corner of the orchard always lags. Use the 360 capture for each tree once per season (or when problems appear) and the harvest survey every year.' },
  { id: 'all-spray-safety', month: 0, category: 'Safety', title: 'Spray safety basics', body: 'Full sleeves, gloves, goggles and a mask - every spray, every time. Mix outdoors, never with bare hands, and never near a watercourse (hill springs feed the whole village). Follow the pre-harvest interval on the label strictly; export and local buyers both test. Triple-rinse empty containers and dispose via the dealer take-back - never burn or bury them. Keep children and animals out of the block for the label re-entry period.' },
  { id: 'all-bee-safety', month: 0, category: 'Safety', title: 'Protect pollinators - they are your crop', body: 'No insecticides from 10% bloom until petal fall. If a spray is unavoidable, apply after 6 pm when bees have stopped flying, inform neighbouring beekeepers, and choose the least toxic option. Even outside bloom, evening spraying protects wild pollinators and predators that keep mites and aphids down for free.' },
];

export interface VarietyInfo {
  name: string;
  type: 'main' | 'pollinizer' | 'early' | 'late';
  note: string;
}

export const VARIETIES: VarietyInfo[] = [
  { name: 'Royal Delicious', type: 'main', note: 'The Shimla belt classic. Self-incompatible - needs pollinizers. Harvest 140-150 days after full bloom (mid-Aug to mid-Sep). Prone to bitter pit on light crops.' },
  { name: 'Red Delicious (ordinary strain)', type: 'main', note: 'Traditional strain, taller trees. Needs pollinizers and heavier pruning discipline.' },
  { name: 'Red Chief', type: 'main', note: 'Spur-type, compact, well-coloured. Harvest with Royal Delicious.' },
  { name: 'Scarlet Spur', type: 'main', note: 'Spur-type, early colour; good for high-density on M-106/M-111.' },
  { name: 'Rich-a-Red', type: 'main', note: 'Coloured spur strain popular in the mid belt.' },
  { name: 'Vance Delicious', type: 'pollinizer', note: 'Good pollinizer for Delicious blocks; also a marketable crop.' },
  { name: 'Golden Delicious', type: 'pollinizer', note: 'Excellent pollinizer; susceptible to scab and bitter pit - watch calcium.' },
  { name: 'Tydeman\'s Early Worcester', type: 'pollinizer', note: 'Early pollinizer; its own fruit ripens mid-July to early Aug.' },
  { name: 'Michal', type: 'early', note: 'Very early (July); useful for early market cash flow.' },
  { name: 'Crab apple', type: 'pollinizer', note: 'Long bloom = reliable pollinizer overlap; plant every 8-9 trees or as full row every 5th.' },
  { name: 'Other / local variety', type: 'main', note: 'Record the name in notes if not listed.' },
];

export function diseasesByCodes(codes: string[]): DiseaseInfo[] {
  const set = new Set(codes);
  return DISEASES.filter((d) => set.has(d.code));
}
