"""Building height heuristic (levels from footprint area + class) with light calibration.

Prior table  ->  shrink each (class-group, area-bin) cell toward the median of the buildings that DO have
a height / level count:   levels = (n * median_known + K * prior) / (n + K), K = SHRINK_K.
Estimated height = levels * LEVEL_M.  The known set is biased to notable OSM-mapped buildings (tall
condos, shophouse rows) so the prior keeps most of the weight in thin cells.
"""
import statistics

LEVEL_M = 3.2
SHRINK_K = 8
AREA_BINS = [0, 40, 80, 150, 400, 1000, 3000, float("inf")]

# levels per area bin ("none" = no class known)
PRIOR = {
    "none":       [1, 2, 3, 3, 4, 4, 2],
    "house":      [1, 2, 2, 2, 3, 3, 3],
    "residential": [1, 2, 2, 3, 4, 6, 8],
    "terrace":    [2, 4, 4, 4, 4, 4, 4],   # Thai shophouse / townhouse rows are typically 3-5 storeys
    "apartments": [3, 4, 5, 5, 8, 12, 15],
    "commercial": [1, 2, 3, 4, 4, 5, 3],   # large footprints = low malls / big boxes
    "hotel":      [2, 3, 4, 5, 8, 10, 10],
    "industrial": [1, 1, 2, 2, 2, 2, 2],   # factory / warehouse: ~6 m eaves
    "minor":      [1, 1, 1, 1, 1, 1, 1],   # sheds, carports, roofs, kiosks
    "parking":    [1, 1, 1, 2, 4, 5, 5],
    "education":  [1, 2, 2, 3, 3, 3, 3],
    "medical":    [2, 3, 3, 4, 6, 8, 8],
    "religious":  [1, 2, 2, 2, 2, 2, 2],
    "civic":      [1, 2, 3, 3, 3, 3, 3],
    "transport":  [1, 2, 2, 2, 2, 3, 3],
}
CLASS_GROUP = {}
for g, names in {
    "house": "house detached semidetached_house bungalow cabin static_caravan farm dormitory_house",
    "residential": "residential dormitory",
    "terrace": "terrace",
    "apartments": "apartments",
    "commercial": "commercial retail office supermarket kiosk_commercial mixed_use service",
    "hotel": "hotel",
    "industrial": "industrial warehouse factory manufacturing storage_tank agricultural barn stable farm_auxiliary hangar",
    "minor": "shed garage garages carport roof shelter hut kiosk greenhouse cowshed pavilion gazebo outbuilding "
             "service container toilets canopy",
    "parking": "parking",
    "education": "school college university kindergarten education",
    "medical": "hospital clinic medical",
    "religious": "temple church mosque shrine religious chapel cathedral synagogue",
    "civic": "civic government public fire_station police townhall",
    "transport": "train_station transportation bridge",
}.items():
    for n in names.split():
        CLASS_GROUP[n] = g
SUBTYPE_GROUP = {"residential": "residential", "commercial": "commercial", "education": "education",
                 "medical": "medical", "religious": "religious", "civic": "civic", "transportation": "transport",
                 "industrial": "industrial", "agricultural": "industrial", "outbuilding": "minor",
                 "entertainment": "commercial", "service": "commercial"}


def area_bin(a):
    for i in range(len(AREA_BINS) - 1):
        if a < AREA_BINS[i + 1]:
            return i
    return len(AREA_BINS) - 2


def group_of(cls, subtype):
    if cls and cls in CLASS_GROUP:
        return CLASS_GROUP[cls]
    if subtype and subtype in SUBTYPE_GROUP:
        return SUBTYPE_GROUP[subtype]
    return "none"


class Estimator:
    def __init__(self, known=None):
        """known: iterable of (area_m2, cls, subtype, height_m)."""
        self.table = {g: [float(v) for v in row] for g, row in PRIOR.items()}
        self.cell_n = {}
        if known:
            cells = {}
            for a, c, s, h in known:
                cells.setdefault((group_of(c, s), area_bin(a)), []).append(h / LEVEL_M)
            for (g, b), v in cells.items():
                n = len(v)
                self.cell_n[(g, b)] = n
                self.table[g][b] = (n * statistics.median(v) + SHRINK_K * self.table[g][b]) / (n + SHRINK_K)

    def levels(self, area, cls=None, subtype=None):
        return max(1, round(self.table[group_of(cls, subtype)][area_bin(area)]))

    def height(self, area, cls=None, subtype=None):
        return round(self.levels(area, cls, subtype) * LEVEL_M, 1)


def evaluate(known):
    """known: list of (area, cls, subtype, true_h). Returns dict of error stats (metres)."""
    def mae(pairs):
        e = [abs(p - t) for p, t in pairs]
        return round(statistics.median(e), 2) if e else None
    est = Estimator(known)
    in_sample = [(est.height(a, c, s), h) for a, c, s, h in known]
    prior_only = Estimator(None)
    cv = []
    for k in range(5):
        train = [x for i, x in enumerate(known) if i % 5 != k]
        e = Estimator(train)
        cv += [(e.height(a, c, s), h) for i, (a, c, s, h) in enumerate(known) if i % 5 == k]
    med = statistics.median(h for *_, h in known)
    return {
        "n_known": len(known),
        "median_abs_error_m_in_sample": mae(in_sample),
        "median_abs_error_m_5fold_cv": mae(cv),
        "median_abs_error_m_prior_only": mae([(prior_only.height(a, c, s), h) for a, c, s, h in known]),
        "median_abs_error_m_constant_median_baseline": mae([(med, h) for *_, h in known]),
        "median_abs_error_levels_in_sample": round(statistics.median(abs(p - t) / LEVEL_M for p, t in in_sample), 2),
        "known_median_height_m": round(med, 1),
        "known_under_30m_median_abs_error_m": mae([(p, t) for p, t in in_sample if t < 30]),
        "mean_abs_error_m_in_sample": round(statistics.mean(abs(p - t) for p, t in in_sample), 2),
        "share_within_1_level_in_sample": round(sum(abs(p - t) <= LEVEL_M + 0.05 for p, t in in_sample) / len(in_sample), 3),
        "share_within_1_level_5fold_cv": round(sum(abs(p - t) <= LEVEL_M + 0.05 for p, t in cv) / len(cv), 3),
    }
