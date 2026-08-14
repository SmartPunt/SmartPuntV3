import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import SubscriberCalculatorLivePicks from "@/components/subscriber-calculator-live-picks";
import { loadSubscriberLivePicksData } from "@/lib/subscriber-live-picks-data";
import { syncVaultNotifications } from "@/lib/vault-matching";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{
    raceId?: string;
  }>;
}) {
  const resolvedSearchParams = await searchParams;
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

const livePicksData = await loadSubscriberLivePicksData({
  userId: profile.id,
  includeCalculatorPredictions: true,
});

const vaultResult = await syncVaultNotifications({
  userId: profile.id,
  liveData: {
    dayDates: {
      today: livePicksData.dayDates.today,
      tomorrow: livePicksData.dayDates.tomorrow,
    },
    currentMeetings: livePicksData.meetings,
    currentRaces: livePicksData.races,
    currentRunners: livePicksData.runners,
    horses: livePicksData.horses,
  },
});

return (
<SubscriberCalculatorLivePicks
  currentUser={profile}
  races={livePicksData.races}
  runners={livePicksData.runners}
  horses={livePicksData.horses}
  meetings={livePicksData.meetings}
  jockeyProfiles={livePicksData.jockeyProfiles}
  calculatorTips={livePicksData.calculatorTips}
  calculatorPredictions={livePicksData.calculatorPredictions}
officialTips={livePicksData.officialTips}
watchSuggestions={livePicksData.watchSuggestions}
getOnEarlyBets={livePicksData.getOnEarlyBets}
maverickExoticTips={livePicksData.maverickExoticTips}
activeUserBets={livePicksData.activeUserBets}
vaultMatches={vaultResult.matches}
dayDates={livePicksData.dayDates}
initialRaceId={resolvedSearchParams?.raceId ?? ""}
/>
  );
}
