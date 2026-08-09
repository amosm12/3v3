import Link from "next/link";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/teams", label: "Teams & Roster" },
  { href: "/admin/checkin-overview", label: "Check-in Overview" },
  { href: "/admin/format", label: "Format & Generation" },
  { href: "/admin/schedule", label: "Schedule" },
  { href: "/admin/refs", label: "Refs" },
  { href: "/admin/seeding", label: "Knockout Seeding" },
  { href: "/admin/knockout-refs", label: "Knockout Ref Assignments" },
  { href: "/admin/matches", label: "Match Overrides" },
  { href: "/admin/settings", label: "Phase & Reset" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800 bg-neutral-900">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <h1 className="text-lg font-bold">Admin — Bethlehem SDA 3v3</h1>
          <nav className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-neutral-300 hover:text-white hover:underline"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
