import { matchPhaseLabels } from "./match-store";
import type { AutoKnockoutPlan } from "./auto-knockout";

export function AutomaticKnockoutPanel({
  onCreate,
  onReplace,
  plan,
}: {
  onCreate: () => void;
  onReplace?: () => void;
  plan: AutoKnockoutPlan;
}) {
  const canUsePrimaryAction = plan.canCreate || Boolean(onReplace && plan.canReplace);

  return (
    <section className="mt-5 rounded-lg border border-white/10 bg-[#0F172A] p-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_180px] xl:items-start">
        <div>
          <h4 className="text-lg font-black text-white">
            Automatski knockout
          </h4>
          <p className="mt-1 text-sm font-bold text-[#FACC15]">
            {plan.message}
          </p>
        </div>
        <button
          className="h-11 rounded-md bg-[#F97316] px-4 text-sm font-black text-[#111827] transition hover:bg-[#FACC15] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-[#64748B]"
          disabled={!canUsePrimaryAction}
          onClick={plan.canReplace && onReplace ? onReplace : onCreate}
          type="button"
        >
          {plan.canReplace ? "Zameni knockout" : "Napravi knockout"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-5">
        <Metric
          label="Grupne"
          value={`${plan.groupMatches - plan.unfinishedGroupMatches}/${plan.groupMatches}`}
        />
        <Metric
          label="Ekipe"
          value={plan.qualifiedTeams.length.toString()}
        />
        <Metric
          label="Faza"
          value={plan.phase ? matchPhaseLabels[plan.phase] : "-"}
        />
        <Metric
          label="Knockout"
          value={plan.existingKnockoutMatches.toString()}
        />
        <Metric
          label="Zakljucano"
          value={plan.lockedKnockoutMatches.toString()}
        />
      </div>

      {plan.pairings.length > 0 && (
        <div className="mt-4 grid gap-2">
          {plan.pairings.map((pairing, index) => (
            <div
              className="grid gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-bold text-white sm:grid-cols-[34px_minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center"
              key={`${pairing.teamA.id}-${pairing.teamB.id}`}
            >
              <span className="text-[#FACC15]">{index + 1}.</span>
              <span className="truncate">
                {pairing.seedA}. {pairing.teamA.name}
              </span>
              <span className="text-center text-[#94A3B8]">protiv</span>
              <span className="truncate">
                {pairing.seedB}. {pairing.teamB.name}
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
