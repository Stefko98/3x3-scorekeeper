import type { AutoGroupMatchPlan } from "./auto-group-matches";

export function AutomaticGroupMatchesPanel({
  onCreate,
  plan,
}: {
  onCreate: () => void;
  plan: AutoGroupMatchPlan;
}) {
  return (
    <section className="mt-5 rounded-lg border border-white/10 bg-[#0F172A] p-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px] xl:items-start">
        <div>
          <h4 className="text-lg font-black text-white">
            Automatske grupne utakmice
          </h4>
          <p className="mt-1 text-sm font-bold text-[#FACC15]">
            {plan.message}
          </p>
        </div>
        <button
          className="h-11 rounded-md bg-[#F97316] px-4 text-sm font-black text-[#111827] transition hover:bg-[#FACC15] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-[#64748B]"
          disabled={!plan.canCreate}
          onClick={onCreate}
          type="button"
        >
          Napravi grupne utakmice
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Metric
          label="Postojece"
          value={plan.existingGroupMatches.toString()}
        />
        <Metric label="Nove" value={plan.pairings.length.toString()} />
        <Metric label="Grupe" value={plan.groups.length.toString()} />
      </div>

      {plan.groups.length > 0 && (
        <div className="mt-4 grid gap-2">
          {plan.groups.map((group) => (
            <div
              className="grid gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-bold text-white sm:grid-cols-[minmax(0,1fr)_120px_120px] sm:items-center"
              key={group.groupName}
            >
              <span className="truncate">{group.groupName}</span>
              <span className="text-[#94A3B8]">
                {group.teamCount} ekipa
              </span>
              <span className="text-[#FACC15]">
                {group.missingMatches} novih
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2">
      <p className="text-xs text-[#94A3B8]">{label}</p>
      <p className="mt-1 truncate text-lg font-black text-white">{value}</p>
    </div>
  );
}
