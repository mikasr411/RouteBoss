import { Customer } from "@/types/customer";
import { format, parse, differenceInCalendarDays } from "date-fns";

/** Standard quote amounts for messaging */
export const ONE_STORY_PRICE = 90;
export const TWO_STORY_PRICE = 140;
/** $1/panel promotional add-on (e.g. Meta lead special) */
export const PER_PANEL_SPECIAL_PRICE = 1;

export function formatQuotePrice(dollars: number): string {
  return `$${dollars}`;
}

function normalizeStoryKey(storyType?: string | null): string {
  return (storyType || "").toLowerCase().replace(/[_-]/g, " ");
}

/** Base fee in dollars from story type, or null if unknown */
export function baseFeeDollarsForStoryType(
  storyType?: string | null
): number | null {
  const s = normalizeStoryKey(storyType);
  if (!s) return null;
  if (/\b2\b/.test(s) || s.includes("two")) return TWO_STORY_PRICE;
  if (s.includes("single") || s.includes("one") || s === "1") {
    return ONE_STORY_PRICE;
  }
  return null;
}

/** First whole number in panel count text (e.g. "18", "11-20", "15 panels" → 18, 11, 15) */
export function parsePanelCountNumber(panelCount?: string | null): number | null {
  if (!panelCount?.trim()) return null;
  const match = panelCount.match(/\d+/);
  if (!match) return null;
  const n = parseInt(match[0], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function storyLabelForType(storyType?: string | null): string {
  const s = normalizeStoryKey(storyType);
  if (!s) return "";
  if (/\b2\b/.test(s) || s.includes("two")) return "two-story";
  if (s.includes("single") || s.includes("one") || s === "1") {
    return "single-story";
  }
  return "";
}

export type PromoQuoteParts = {
  baseFeeDollars: number | null;
  panelCountNum: number | null;
  perPanelDollars: number;
  panelFeeDollars: number | null;
  totalDollars: number | null;
};

/** base + (panels × per-panel) for promotional messaging */
export function computePromoQuote(
  storyType: string | undefined,
  panelCountText: string,
  perPanelDollars = PER_PANEL_SPECIAL_PRICE
): PromoQuoteParts {
  const baseFeeDollars = baseFeeDollarsForStoryType(storyType);
  const panelCountNum = parsePanelCountNumber(panelCountText);
  const panelFeeDollars =
    panelCountNum != null ? panelCountNum * perPanelDollars : null;
  const totalDollars =
    baseFeeDollars != null
      ? baseFeeDollars + (panelFeeDollars ?? 0)
      : null;

  return {
    baseFeeDollars,
    panelCountNum,
    perPanelDollars,
    panelFeeDollars,
    totalDollars,
  };
}

/** Read panel count from customer field or legacy notes from Facebook import */
export function resolvePanelCount(customer: Customer): string {
  if (customer.panelCount?.trim()) return customer.panelCount.trim();
  const notes = customer.notes || "";
  const match = notes.match(/Panels:\s*([^·\n]+)/i);
  return match?.[1]?.trim() || "";
}

/** Read story type from customer field or legacy notes from Facebook import */
export function resolveStoryType(customer: Customer): string | undefined {
  if (customer.storyType?.trim()) return customer.storyType.trim();
  const notes = customer.notes || "";
  const match = notes.match(/Story:\s*([^·\n]+)/i);
  return match?.[1]?.trim();
}

/** Pick $90 single vs $140 two-story from lead story type */
export function quotePriceForStoryType(storyType?: string | null): string {
  const base = baseFeeDollarsForStoryType(storyType);
  return base != null ? formatQuotePrice(base) : "";
}

export type TemplateVariables = {
  displayName: string;
  firstName: string;
  fullAddress: string;
  city: string;
  state: string;
  mobileNumber: string;
  lastServiceDate: string;
  nextServiceDate: string;
  daysSinceLastService: string;
  /** Raw panel count from lead (may include text like "15 panels") */
  panelCount: string;
  /** Numeric panel count for templates, e.g. "18" in "18-panel" */
  panelCountNum: string;
  /** Human label: single-story / two-story */
  storyLabel: string;
  /** Base fee from story: $90 or $140 (same as {baseFee}) */
  story: string;
  baseFee: string;
  oneStoryPrice: string;
  twoStoryPrice: string;
  /** Per-panel promo rate, e.g. $1 */
  perPanelPrice: string;
  /** panels × perPanelPrice, e.g. $18 */
  panelFee: string;
  /** baseFee + panelFee, e.g. $108 */
  totalPrice: string;
};

/**
 * Build template variables from a customer
 */
export function buildTemplateVariables(customer: Customer): TemplateVariables {
  let lastServiceDateFormatted = "";
  let daysSinceLastService = "";
  let nextServiceDateFormatted = "";

  // Format last service date
  if (customer.lastServiceDate) {
    try {
      const lastDate = parse(customer.lastServiceDate, "yyyy-MM-dd", new Date());
      lastServiceDateFormatted = format(lastDate, "MMM d, yyyy");
      
      // Calculate days since last service
      const today = new Date();
      const daysDiff = differenceInCalendarDays(today, lastDate);
      daysSinceLastService = daysDiff.toString();
    } catch {
      // Invalid date, leave empty
    }
  }

  // Format next service date
  if (customer.nextServiceDate) {
    try {
      const nextDate = parse(customer.nextServiceDate, "yyyy-MM-dd", new Date());
      nextServiceDateFormatted = format(nextDate, "MMM d, yyyy");
    } catch {
      // Invalid date, leave empty
    }
  }

  const storyType = resolveStoryType(customer);
  const panelCountText = resolvePanelCount(customer);
  const promo = computePromoQuote(storyType, panelCountText);
  const baseFee =
    promo.baseFeeDollars != null ? formatQuotePrice(promo.baseFeeDollars) : "";

  return {
    displayName: customer.displayName || "",
    // Falls back to display name so "Hey {firstName}," never comes out empty
    firstName: customer.firstName?.trim() || customer.displayName || "",
    fullAddress: customer.fullAddress || "",
    city: customer.city || "",
    state: customer.state || "",
    mobileNumber: customer.mobileNumber || "",
    lastServiceDate: lastServiceDateFormatted,
    nextServiceDate: nextServiceDateFormatted,
    daysSinceLastService,
    panelCount: panelCountText,
    panelCountNum:
      promo.panelCountNum != null ? String(promo.panelCountNum) : "",
    storyLabel: storyLabelForType(storyType),
    story: baseFee,
    baseFee,
    oneStoryPrice: formatQuotePrice(ONE_STORY_PRICE),
    twoStoryPrice: formatQuotePrice(TWO_STORY_PRICE),
    perPanelPrice: formatQuotePrice(PER_PANEL_SPECIAL_PRICE),
    panelFee:
      promo.panelFeeDollars != null
        ? formatQuotePrice(promo.panelFeeDollars)
        : "",
    totalPrice:
      promo.totalDollars != null ? formatQuotePrice(promo.totalDollars) : "",
  };
}

/**
 * Apply a template string to template variables (plain text — bold markers stripped)
 */
export function applyTemplate(
  template: string,
  variables: TemplateVariables
): string {
  return applyTemplatePlain(template, variables);
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Convert legacy **bold** to [b]bold[/b] for editing */
export function normalizeBoldSyntax(template: string): string {
  return template.replace(/\*\*(.+?)\*\*/g, "[b]$1[/b]");
}

function substituteTemplateVariables(
  template: string,
  variables: TemplateVariables,
  escapeValues: boolean
): string {
  return template.replace(/\{(\w+)\}/g, (_match, key) => {
    const value = variables[key as keyof TemplateVariables];
    const str = value !== undefined ? String(value) : "";
    return escapeValues ? escapeHtml(str) : str;
  });
}

/** Remove [b] markers — for SMS / plain-text copy */
export function stripBoldMarkup(text: string): string {
  return normalizeBoldSyntax(text).replace(
    /\[b\]([\s\S]*?)\[\/b\]/gi,
    "$1"
  );
}

/** [b] markers → HTML bold + line breaks */
export function boldMarkupToHtml(text: string): string {
  return normalizeBoldSyntax(text)
    .replace(/\[b\]([\s\S]*?)\[\/b\]/gi, "<b>$1</b>")
    .replace(/\n/g, "<br>");
}

export function applyTemplatePlain(
  template: string,
  variables: TemplateVariables
): string {
  const filled = substituteTemplateVariables(template, variables, false);
  return stripBoldMarkup(filled);
}

export function applyTemplateHtml(
  template: string,
  variables: TemplateVariables
): string {
  const filled = substituteTemplateVariables(template, variables, true);
  return boldMarkupToHtml(filled);
}

/** Copy plain + HTML so paste into Notes/Mail keeps bold; SMS apps use plain */
export async function copyMessageToClipboard(
  plain: string,
  htmlBody: string
): Promise<void> {
  const htmlDoc = `<!DOCTYPE html><html><body>${htmlBody}</body></html>`;
  try {
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": new Blob([plain], { type: "text/plain" }),
          "text/html": new Blob([htmlDoc], { type: "text/html" }),
        }),
      ]);
      return;
    }
  } catch {
    // Rich clipboard blocked — fall back to plain text
  }
  await navigator.clipboard.writeText(plain);
}

/**
 * Default message template (customers with service history / due reminders)
 */
export const DEFAULT_TEMPLATE = `Hey {displayName}, it's been {daysSinceLastService} days since we last cleaned your solar panels at {fullAddress}. 

We're switching to a semi-automated system for scheduling routes in your neighborhood and we'll be in your area soon. 

Reply YES to confirm you'd like to be added to this route.`;

/** For contacts with no last service date on file. */
export const LOST_AND_FOUND_TEMPLATE = `Hey {displayName}, this is your solar panel cleaning team reaching out about {fullAddress} in {city}.

We don't have a recent service on file for your home. We're building routes in your area and wanted to see if you'd like to get back on the schedule.

Reply YES if you'd like a quote or to be added to an upcoming route.`;

/** Meta / Facebook $1-per-panel special — pricing auto-calculated from story + panels */
export const SEPTEMBER_SPECIAL_TEMPLATE = `Hey {firstName}, this is Marcos with Ramos Power Wash. I got your request for our [b]September $1 per panel solar cleaning special[/b] and would be happy to help.

For your [b]{panelCountNum}-panel {storyLabel} system[/b], the promotional pricing is a [b]{baseFee} base fee + {perPanelPrice} per panel[/b], bringing the total to [b]{totalPrice}[/b].

We use a [b]solar-safe rotary brush system with purified water[/b] to safely remove dirt, dust, pollen, bird droppings, and buildup without damaging the panels.

[b]No need to be home.[/b] We send [b]before and after pictures[/b] when we're done, and we offer convenient online payments.

I have availability [b]tomorrow[/b] if you'd like to get on the schedule. Just let me know and I can send you an arrival window.`;

export type MessageTemplatePreset =
  | "due-reminder"
  | "lost-and-found"
  | "september-special";

export const MESSAGE_TEMPLATE_PRESET_KEY = "routeboss:messageTemplatePreset";

export function templateForPreset(preset: MessageTemplatePreset): string {
  switch (preset) {
    case "lost-and-found":
      return LOST_AND_FOUND_TEMPLATE;
    case "september-special":
      return SEPTEMBER_SPECIAL_TEMPLATE;
    default:
      return DEFAULT_TEMPLATE;
  }
}

export function applyMessageTemplatePreset(preset: MessageTemplatePreset): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(MESSAGE_TEMPLATE_PRESET_KEY, preset);
  localStorage.setItem("routeboss:messageTemplate", templateForPreset(preset));
}

