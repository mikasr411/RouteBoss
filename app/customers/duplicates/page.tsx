"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useCustomerStore } from "@/store/customer-store";
import { useRouteHistoryStore } from "@/store/route-history-store";
import { formatDate } from "@/lib/utils";
import {
  findDuplicateGroups,
  suggestedKeepId,
} from "@/lib/customer-duplicates";
import PhoneContactLinks from "@/components/PhoneContactLinks";

export default function DuplicateReviewPage() {
  const customers = useCustomerStore((s) => s.customers);
  const dismissedDuplicateKeys = useCustomerStore(
    (s) => s.dismissedDuplicateKeys
  );
  const mergeDuplicateCustomers = useCustomerStore(
    (s) => s.mergeDuplicateCustomers
  );
  const dismissDuplicateGroup = useCustomerStore(
    (s) => s.dismissDuplicateGroup
  );
  const remapSavedRouteIds = useRouteHistoryStore((s) => s.remapCustomerIds);

  const groups = useMemo(
    () => findDuplicateGroups(customers, dismissedDuplicateKeys ?? []),
    [customers, dismissedDuplicateKeys]
  );

  const [index, setIndex] = useState(0);
  const [keepId, setKeepId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const safeIndex = groups.length === 0 ? 0 : Math.min(index, groups.length - 1);
  const group = groups[safeIndex];
  const selectedKeep =
    keepId && group?.members.some((m) => m.id === keepId)
      ? keepId
      : group
        ? suggestedKeepId(group.members)
        : null;

  const goNext = () => {
    setKeepId(null);
    setIndex((i) => i + 1);
  };

  const handleMerge = () => {
    if (!group || !selectedKeep) return;
    const absorb = group.members
      .map((m) => m.id)
      .filter((id) => id !== selectedKeep);
    const kept = group.members.find((m) => m.id === selectedKeep);
    mergeDuplicateCustomers(selectedKeep, absorb);
    remapSavedRouteIds(absorb, selectedKeep);
    setNotice(`Merged into ${kept?.displayName ?? "one contact"}.`);
    window.setTimeout(() => setNotice(null), 2500);
    setKeepId(null);
  };

  const handleNotDuplicates = () => {
    if (!group) return;
    dismissDuplicateGroup(group.key);
    setKeepId(null);
  };

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-6 sm:py-8 w-full min-w-0">
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-100">
              Review duplicates
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Same phone, same address, or same last name + street number.
              Pick who to keep — Housecall history and Facebook specials combine
              onto that one card.
            </p>
          </div>
          <Link
            href="/customers"
            className="text-sm text-blue-300 hover:text-blue-200 underline"
          >
            Back to customers
          </Link>
        </div>

        {notice && (
          <div className="mb-4 text-sm text-green-400">{notice}</div>
        )}

        {groups.length === 0 ? (
          <p className="text-slate-300">
            No similar customers left to review. Import still auto-merges by
            phone when it can.
          </p>
        ) : (
          <>
            <p className="text-slate-400 text-sm mb-4">
              Group {safeIndex + 1} of {groups.length}
              {group ? (
                <span className="text-slate-500">
                  {" "}
                  · {group.reasons.join(", ")}
                </span>
              ) : null}
            </p>

            {group && (
              <div className="space-y-3 mb-5">
                {group.members.map((c) => {
                  const selected = selectedKeep === c.id;
                  return (
                    <label
                      key={c.id}
                      className={`block rounded-lg border p-3 cursor-pointer transition-colors ${
                        selected
                          ? "border-emerald-500 bg-emerald-950/40"
                          : "border-slate-600 bg-slate-700/50 hover:border-slate-500"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="keep"
                          className="mt-1"
                          checked={selected}
                          onChange={() => setKeepId(c.id)}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-slate-100">
                            {c.displayName}
                            {selected ? (
                              <span className="ml-2 text-xs font-medium text-emerald-300">
                                Keep this one
                              </span>
                            ) : null}
                          </div>
                          <div className="text-sm text-slate-300 mt-0.5">
                            {c.fullAddress || `${c.city}, ${c.state}`}
                          </div>
                          <div className="mt-1">
                            <PhoneContactLinks
                              mobileNumber={c.mobileNumber}
                              homeNumber={c.homeNumber}
                              showEmpty={false}
                            />
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-400 mt-1">
                            <span>
                              Last service: {formatDate(c.lastServiceDate)}
                            </span>
                            {c.leadSpecial ? (
                              <span className="text-amber-300/90">
                                {c.leadSpecial}
                              </span>
                            ) : null}
                            {c.leadSource ? <span>{c.leadSource}</span> : null}
                            {c.isSelectedForRoute ? (
                              <span className="text-emerald-300">On route</span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            <div className="flex flex-col sm:flex-row flex-wrap gap-2">
              <button
                type="button"
                onClick={handleMerge}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded font-semibold text-sm"
              >
                Merge into selected
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={safeIndex >= groups.length - 1}
                className="bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-100 px-4 py-2 rounded text-sm"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={handleNotDuplicates}
                className="border border-slate-500 text-slate-300 hover:bg-slate-700 px-4 py-2 rounded text-sm"
              >
                Not duplicates
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
