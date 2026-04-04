"use client";

import {
  digitsForTel,
  formatPhoneDisplay,
  pickPhoneNumber,
} from "@/lib/phone";

type Props = {
  mobileNumber?: string;
  homeNumber?: string;
  /** When false, only show call/text controls (no standalone "—") */
  showEmpty?: boolean;
  className?: string;
  compact?: boolean;
};

export default function PhoneContactLinks({
  mobileNumber,
  homeNumber,
  showEmpty = true,
  className = "",
  compact = false,
}: Props) {
  const raw = pickPhoneNumber({ mobileNumber, homeNumber });
  const digits = digitsForTel(raw);
  const display = raw ? formatPhoneDisplay(raw) : "";

  if (!digits) {
    if (!showEmpty) return null;
    return <span className="text-slate-500">—</span>;
  }

  const btn =
    "inline-flex items-center justify-center rounded border border-slate-500/80 bg-slate-700/80 text-slate-100 hover:bg-slate-600 hover:border-slate-400 transition-colors";

  if (compact) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <a
          href={`tel:${digits}`}
          className={`${btn} size-8 text-sm`}
          title="Call"
          aria-label={`Call ${display}`}
        >
          📞
        </a>
        <a
          href={`sms:${digits}`}
          className={`${btn} size-8 text-sm`}
          title="Text"
          aria-label={`Text ${display}`}
        >
          💬
        </a>
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${className}`}>
      <a
        href={`tel:${digits}`}
        className="text-blue-300 hover:text-blue-200 hover:underline font-medium tabular-nums"
      >
        {display}
      </a>
      <span className="flex items-center gap-1 shrink-0">
        <a
          href={`tel:${digits}`}
          className={`${btn} px-2 py-0.5 text-xs`}
          aria-label={`Call ${display}`}
        >
          Call
        </a>
        <a
          href={`sms:${digits}`}
          className={`${btn} px-2 py-0.5 text-xs`}
          aria-label={`Text ${display}`}
        >
          Text
        </a>
      </span>
    </div>
  );
}
