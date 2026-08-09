"use client";

import { usePolling } from "@/components/usePolling";
import type { Team } from "@/lib/types";

export default function AdminCheckinOverviewPage() {
  const { data: teams, loading } = usePolling<Team[]>("/api/teams");

  const checkedIn = teams?.filter((t) => t.checkedIn).length ?? 0;
  const paid = teams?.filter((t) => t.paid).length ?? 0;
  const total = teams?.length ?? 0;

  return (
    <div className="max-w-3xl space-y-4">
      <h2 className="text-xl font-bold">Check-in Overview</h2>
      <p className="text-neutral-400">
        Read-only mirror of /checkin — {loading ? "loading…" : `${checkedIn} / ${total} checked in, ${paid} / ${total} paid`}
      </p>

      <div className="overflow-x-auto rounded-lg border border-neutral-800">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="bg-neutral-900 text-left text-neutral-400">
            <tr>
              <th className="px-3 py-2">Team</th>
              <th className="px-3 py-2">Checked in</th>
              <th className="px-3 py-2">Paid</th>
              <th className="px-3 py-2">Players checked in</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {teams?.map((t) => (
              <tr key={t.id}>
                <td className="px-3 py-2 font-medium">{t.name}</td>
                <td className="px-3 py-2">
                  <span className={t.checkedIn ? "text-green-400" : "text-neutral-500"}>
                    {t.checkedIn ? "Yes" : "No"}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className={t.paid ? "text-green-400" : "text-amber-400"}>
                    {t.paid ? "Yes" : "No"}
                  </span>
                </td>
                <td className="px-3 py-2 text-neutral-400">
                  {t.players.filter((p) => p.checkedIn).length} / {t.players.length}
                </td>
              </tr>
            ))}
            {teams?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-neutral-500">
                  No teams yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
