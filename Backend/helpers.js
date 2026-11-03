// =============================================
// DRIVE EASE - PURE HELPERS (dates, pricing, offer rules)
// =============================================

// Accepts "YYYY-MM-DD", "YYYY-MM-DDTHH:mm", "YYYY-MM-DD HH:mm:ss".
// Returns "YYYY-MM-DD HH:MM:SS" or null when invalid.
function normalizeDateTime(value, defaultTime = "09:00:00") {
    if (typeof value !== "string") return null;
    const match = value.trim().match(
        /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/
    );
    if (!match) return null;

    const [, y, mo, d, h, mi, s] = match;
    const time = h === undefined
        ? defaultTime
        : `${h}:${mi}:${s || "00"}`;
    const text = `${y}-${mo}-${d} ${time}`;

    const parsed = toUtcMs(text);
    if (parsed === null) return null;

    // Reject impossible dates such as 2026-02-31.
    const check = new Date(parsed).toISOString();
    if (check.slice(0, 10) !== `${y}-${mo}-${d}`) return null;
    return text;
}

function toUtcMs(text) {
    const m = String(text).match(
        /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/
    );
    if (!m) return null;
    const ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
    return Number.isNaN(ms) ? null : ms;
}

// Current server time as the same naive text MySQL stores.
function nowText() {
    const n = new Date();
    const p = (v) => String(v).padStart(2, "0");
    return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())} ` +
        `${p(n.getHours())}:${p(n.getMinutes())}:${p(n.getSeconds())}`;
}

// Every started 24 hours counts as one rental day (minimum 1).
function rentalDays(start, end) {
    const hours = (toUtcMs(end) - toUtcMs(start)) / 3600000;
    return Math.max(1, Math.ceil(hours / 24 - 1e-9));
}

const money = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

function calculateDiscount(subtotal, offer) {
    if (!offer) return 0;
    const value = Number(offer.discount_value) || 0;
    const type = String(offer.discount_type || "").toLowerCase();
    let discount = 0;
    if (type === "percentage") discount = subtotal * value / 100;
    else if (type === "fixed") discount = value;
    return money(Math.min(Math.max(discount, 0), subtotal));
}

// ---------------------------------------------------------
// OFFER RULES
// An offer can only be applied to bookings that meet its rule.
//   WELCOME10 - 10% off, customer's FIRST booking only
//   FAMILY10  - 10% off, bookings that include a Car or Minibus
//   SAVE500   - flat Rs.500 off, bookings with subtotal >= Rs.5,000
// Offers added later by the admin have no extra rule (they only
// need to be active and inside their valid dates).
// ---------------------------------------------------------
const SAVE500_MIN_SUBTOTAL = 5000;
const FAMILY_TYPES = ["car", "minibus"];

const OFFER_RULES = {
    WELCOME10: {
        description: "Valid on your first booking only.",
        check: ({ previousBookings }) =>
            previousBookings === 0
                ? null
                : "Welcome Offer is only valid on your first booking."
    },
    FAMILY10: {
        description: "Valid on bookings that include a Car or a Minibus.",
        check: ({ vehicles }) =>
            vehicles.some((v) =>
                FAMILY_TYPES.includes(String(v.type_name).toLowerCase()))
                ? null
                : "Family Pack needs at least one Car or Minibus in your booking."
    },
    SAVE500: {
        description: `Valid on bookings of ₹${SAVE500_MIN_SUBTOTAL.toLocaleString("en-IN")} or more.`,
        check: ({ subtotal }) =>
            subtotal >= SAVE500_MIN_SUBTOTAL
                ? null
                : `Flat ₹500 Off needs a booking subtotal of at least ₹${SAVE500_MIN_SUBTOTAL.toLocaleString("en-IN")}.`
    }
};

function ruleDescription(code) {
    const rule = OFFER_RULES[String(code).toUpperCase()];
    return rule ? rule.description : "Valid on all bookings while the offer is active.";
}

// Returns { eligible, reason, discount } for one offer.
function evaluateOffer(offer, context, nowTextValue = nowText()) {
    const reasonFail = (reason) => ({ eligible: false, reason, discount: 0 });

    if (!offer.is_active) return reasonFail("This offer is not active.");
    if (nowTextValue < offer.valid_from || nowTextValue > offer.valid_to) {
        return reasonFail("This offer is not valid at the moment.");
    }

    const rule = OFFER_RULES[String(offer.offer_code).toUpperCase()];
    if (rule) {
        const failure = rule.check(context);
        if (failure) return reasonFail(failure);
    }

    const discount = calculateDiscount(context.subtotal, offer);
    if (discount <= 0) return reasonFail("No discount applies to this booking.");
    return { eligible: true, reason: null, discount };
}

module.exports = {
    normalizeDateTime, toUtcMs, nowText, rentalDays, money,
    calculateDiscount, OFFER_RULES, ruleDescription, evaluateOffer,
    SAVE500_MIN_SUBTOTAL
};
