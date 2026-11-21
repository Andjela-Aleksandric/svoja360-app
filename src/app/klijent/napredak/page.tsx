import { requireClient } from "@/lib/auth";
import { getMeasurements } from "@/lib/data/clients";
import { getCheckinSeries } from "@/lib/data/checkins";
import { getStrengthAnalytics, listExercises } from "@/lib/data/strength";
import { getConsents, listFiles, signFiles } from "@/lib/data/questionnaire";
import { t } from "@/lib/i18n/sr";
import { PageHeader } from "@/components/ui/page-header";
import { LinkTabs } from "@/components/ui/tabs";
import { MeasurementsPanel } from "@/components/measurements/measurements-panel";
import { StrengthAnalyticsView } from "@/components/strength/strength-analytics";
import { CheckinTrends } from "@/components/checkins/checkin-trends";
import { ProgressPhotos } from "./progress-photos";
import { getClientWeek } from "@/lib/data/client-home";
import { WeekRings } from "@/components/plan/week-rings";
import { RingsHistory } from "@/components/plan/rings-history";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

export const metadata = { title: t.progress.title };

export default async function ProgressPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const viewer = await requireClient();
  const { tab: raw } = await searchParams;
  const tab = ["rings", "body", "strength", "photos", "checkins"].includes(raw ?? "") ? raw! : "rings";
  const items = [
    { key: "rings", label: t.rings.title, href: "/klijent/napredak" },
    { key: "body", label: t.progress.measurements, href: "/klijent/napredak?tab=body" },
    { key: "strength", label: t.progress.strength, href: "/klijent/napredak?tab=strength" },
    { key: "photos", label: t.progress.photos, href: "/klijent/napredak?tab=photos" },
    { key: "checkins", label: t.progress.checkinTrends, href: "/klijent/napredak?tab=checkins" },
  ];
  return (
    <>
      <PageHeader title={t.progress.title} description={t.progress.subtitle} />
      <div className="mb-5"><LinkTabs layoutId="progress-tabs" active={tab} items={items} /></div>
      {tab === "rings" && await (async () => {
        const w = await getClientWeek(viewer.client.id, { snapshot: false, historyWeeks: 8, startDate: viewer.client.start_date });
        return (
          <div className="grid gap-4 [&>*]:min-w-0">
            <section className="band rounded-[26px] p-5 sm:p-7">
              <div className="eyebrow eyebrow-line mb-1 text-band-muted">{t.rings.title}</div>
              <p className="mb-5 text-sm text-band-muted">{t.rings.help}</p>
              {w.history[0] && <WeekRings week={w.history[0]} size={200} />}
            </section>
            <Card><CardHeader title={t.rings.history} /><CardBody className="pt-3"><RingsHistory rows={w.history} /></CardBody></Card>
          </div>
        );
      })()}
      {tab === "body" && <MeasurementsPanel clientId={viewer.client.id} rows={await getMeasurements(viewer.client.id)} />}
      {tab === "strength" && await (async () => {
        const [{ analytics }, ex] = await Promise.all([getStrengthAnalytics(viewer.client.id), listExercises(true)]);
        return <StrengthAnalyticsView data={analytics} names={Object.fromEntries(ex.map((e) => [e.id, e.name]))} />;
      })()}
      {tab === "photos" && await (async () => {
        const [files, consents] = await Promise.all([listFiles({ clientId: viewer.client.id, kinds: ["progress_photo", "assessment_photo"] }), getConsents(viewer.client.id)]);
        return <ProgressPhotos files={await signFiles(files)} consent={consents.photos_videos} />;
      })()}
      {tab === "checkins" && <CheckinTrends series={await getCheckinSeries(viewer.client.id, 26)} />}
    </>
  );
}
