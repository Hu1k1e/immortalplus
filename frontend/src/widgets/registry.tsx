import { TrendingUp, Crosshair, Activity, Award, Skull, Gauge, Swords, ListChecks, Zap, TrendingDown, Flame, Landmark, History, Users2, PieChart, BarChart3, IdCard, Flame as HeroFlame, ListTree } from 'lucide-react';
import type { WidgetDefinition, WidgetInstance, GridLayoutItem, WidgetSize } from './types';
import {
  WinRateStatWidget, KdaStatWidget, GpmStatWidget, DeathsStatWidget,
  PerformanceScoreStatWidget, MmrStatWidget, ActionItemsStatWidget, TotalMatchesStatWidget,
  OverviewPulseWidget,
} from './components/StatWidgets';
import {
  WinRateTrendWidget, KdaTrendWidget, GpmTrendWidget, XpmTrendWidget, DeathsTrendWidget,
  HeroDamageTrendWidget, TowerDamageTrendWidget, MmrHistoryWidget, ImprovementScoreWidget,
} from './components/TrendChartWidgets';
import {
  RecentMatchesWidget, MostPlayedHeroesWidget, ActionItemsWidget, TrendsRingWidget, MetaTopHeroesWidget,
} from './components/ListWidgets';
import {
  LastMatchSpotlightWidget, TopHeroSpotlightWidget, PlayerIdentityWidget, LaneRecordWidget,
} from './components/SpotlightWidgets';
import {
  AiInsightsWidget, AiVoiceCoachWidget, AiDrillsWidget, AiMatchPredictionWidget,
} from './components/CoachWidgets';

const STAT: WidgetSize = { w: 3, h: 4, minW: 2, minH: 3, maxH: 6 };
const CHART: WidgetSize = { w: 4, h: 9, minW: 3, minH: 6 };
const LIST: WidgetSize = { w: 4, h: 11, minW: 3, minH: 6 };
const MINI: WidgetSize = { w: 4, h: 6, minW: 3, minH: 4 };
const SPOTLIGHT: WidgetSize = { w: 4, h: 9, minW: 3, minH: 6 };
const COACH: WidgetSize = { w: 4, h: 6, minW: 3, minH: 5 };

export const WIDGET_REGISTRY: WidgetDefinition[] = [
  // ── Overview stats ──────────────────────────────────────────────
  { id: 'stat-overview-pulse', title: 'Overview Pulse', description: 'Win Rate, Avg GPM, Avg Deaths, and Performance Score together in one colorful quadrant card.', category: 'overview', defaultSize: { w: 6, h: 8, minW: 4, minH: 5 }, icon: Gauge, chromeless: true, singleton: true, Component: OverviewPulseWidget },
  { id: 'stat-winrate', title: 'Win Rate (Last 20)', description: 'Recent win rate with change vs. the prior 20 games.', category: 'overview', defaultSize: STAT, icon: TrendingUp, chromeless: true, singleton: true, Component: WinRateStatWidget },
  { id: 'stat-kda', title: 'Avg KDA', description: 'Rolling average KDA over your last 20 matches.', category: 'overview', defaultSize: STAT, icon: Crosshair, chromeless: true, singleton: true, Component: KdaStatWidget },
  { id: 'stat-gpm', title: 'Avg GPM', description: 'Rolling average gold-per-minute over your last 20 matches.', category: 'overview', defaultSize: STAT, icon: Activity, chromeless: true, singleton: true, Component: GpmStatWidget },
  { id: 'stat-deaths', title: 'Avg Deaths', description: 'Rolling average deaths per game, lower is better.', category: 'overview', defaultSize: STAT, icon: Skull, chromeless: true, singleton: true, Component: DeathsStatWidget },
  { id: 'stat-performance', title: 'Performance Score', description: 'Average AI-computed performance score across your last 10 analyzed matches.', category: 'overview', defaultSize: STAT, icon: Gauge, chromeless: true, singleton: true, Component: PerformanceScoreStatWidget },
  { id: 'stat-mmr', title: 'MMR Estimate', description: "Your current estimated MMR.", category: 'overview', defaultSize: STAT, icon: Swords, chromeless: true, singleton: true, Component: MmrStatWidget },
  { id: 'stat-action-items', title: 'Action Items', description: 'Count of open coaching action items still to complete.', category: 'overview', defaultSize: STAT, icon: Award, chromeless: true, singleton: true, Component: ActionItemsStatWidget },
  { id: 'stat-total-matches', title: 'Total Matches', description: 'All-time synced match count with overall win/loss record.', category: 'overview', defaultSize: STAT, icon: ListChecks, chromeless: true, singleton: true, Component: TotalMatchesStatWidget },

  // ── Trend graphs ─────────────────────────────────────────────────
  { id: 'trend-winrate', title: 'Win Rate (%)', description: 'Line graph of your rolling win rate over recent matches.', category: 'trends', defaultSize: CHART, icon: TrendingUp, singleton: true, Component: WinRateTrendWidget },
  { id: 'trend-kda', title: 'KDA', description: 'Line graph of your rolling KDA over recent matches.', category: 'trends', defaultSize: CHART, icon: Crosshair, singleton: true, Component: KdaTrendWidget },
  { id: 'trend-gpm', title: 'GPM', description: 'Line graph of your rolling gold-per-minute over recent matches.', category: 'trends', defaultSize: CHART, icon: Activity, singleton: true, Component: GpmTrendWidget },
  { id: 'trend-xpm', title: 'XPM', description: 'Line graph of your rolling experience-per-minute.', category: 'trends', defaultSize: CHART, icon: Zap, singleton: true, Component: XpmTrendWidget },
  { id: 'trend-deaths', title: 'Deaths', description: 'Line graph of your rolling deaths per game.', category: 'trends', defaultSize: CHART, icon: TrendingDown, singleton: true, Component: DeathsTrendWidget },
  { id: 'trend-hero-damage', title: 'Hero Damage', description: 'Line graph of your rolling hero damage per game.', category: 'trends', defaultSize: CHART, icon: Flame, singleton: true, Component: HeroDamageTrendWidget },
  { id: 'trend-tower-damage', title: 'Tower Damage', description: 'Line graph of your rolling tower/objective damage per game.', category: 'trends', defaultSize: CHART, icon: Landmark, singleton: true, Component: TowerDamageTrendWidget },
  { id: 'trend-mmr-history', title: 'MMR History', description: 'Estimated MMR over time from daily progress snapshots.', category: 'trends', defaultSize: CHART, icon: BarChart3, singleton: true, Component: MmrHistoryWidget },
  { id: 'trend-improvement-score', title: 'Improvement Score History', description: "The app's composite improvement score over time.", category: 'trends', defaultSize: CHART, icon: TrendingUp, singleton: true, Component: ImprovementScoreWidget },

  // ── Matches & columns ────────────────────────────────────────────
  { id: 'list-recent-matches', title: 'Recent Matches', description: 'A scrollable column of your most recent matches with result and KDA. Click the title to open full Match History.', category: 'matches', defaultSize: LIST, icon: History, titleLink: '/matches', singleton: true, Component: RecentMatchesWidget },
  { id: 'list-action-items', title: 'Open Action Items', description: 'Column of open coaching action items -- click to mark complete.', category: 'matches', defaultSize: CHART, icon: ListTree, singleton: true, Component: ActionItemsWidget },
  { id: 'matches-lane-record', title: 'Lane Record & Queue Mix', description: 'Safe/off lane win-loss record plus party queue and unranked %.', category: 'matches', defaultSize: MINI, icon: Users2, singleton: true, Component: LaneRecordWidget },

  // ── Heroes ───────────────────────────────────────────────────────
  { id: 'list-most-played-heroes', title: 'Most Played Heroes', description: 'Column ranking your most-played heroes by games and win rate.', category: 'heroes', defaultSize: LIST, icon: HeroFlame, singleton: true, Component: MostPlayedHeroesWidget },
  { id: 'heroes-trends-ring', title: 'Hero & Position Trends', description: 'Donut chart of your recent hero picks and role distribution.', category: 'heroes', defaultSize: LIST, icon: PieChart, singleton: true, Component: TrendsRingWidget },

  // ── Meta ─────────────────────────────────────────────────────────
  { id: 'meta-top-heroes', title: 'Meta Top Heroes', description: 'Top-tier heroes right now from the Dota2ProTracker meta hub.', category: 'meta', defaultSize: CHART, icon: TrendingUp, singleton: true, Component: MetaTopHeroesWidget },

  // ── Spotlight cards ──────────────────────────────────────────────
  { id: 'spotlight-last-match', title: 'Last Match', description: 'A 3D hero model card for your most recent match: result, KDA, performance, items, and the full lineup.', category: 'spotlight', defaultSize: { ...SPOTLIGHT, w: 5, h: 16, minH: 13 }, chromeless: true, singleton: true, Component: LastMatchSpotlightWidget },
  { id: 'spotlight-top-hero', title: 'Top Hero Spotlight', description: 'A 3D hero model card for your single most-played hero.', category: 'spotlight', defaultSize: { ...SPOTLIGHT, h: 11, minH: 8 }, chromeless: true, singleton: true, Component: TopHeroSpotlightWidget },
  { id: 'spotlight-player-identity', title: 'Player Identity', description: 'Avatar, rank medal, last-10 win/loss record, and recent-games strip.', category: 'spotlight', defaultSize: { ...SPOTLIGHT, w: 3, h: 16, minH: 12 }, icon: IdCard, chromeless: true, singleton: true, Component: PlayerIdentityWidget },

  // ── Personal AI Coach (future) ────────────────────────────────────
  { id: 'coach-ai-insights', title: 'AI Insights Digest', description: 'Rolling digest of what the AI Coach has noticed across recent matches.', category: 'coach', defaultSize: COACH, singleton: true, Component: AiInsightsWidget },
  { id: 'coach-ai-voice', title: 'AI Voice Coach', description: 'Live, spoken in-game callouts driven by GSI.', category: 'coach', defaultSize: COACH, singleton: true, Component: AiVoiceCoachWidget },
  { id: 'coach-ai-drills', title: 'Personalized Drills', description: 'Practice drills generated from your own recurring mistakes.', category: 'coach', defaultSize: COACH, singleton: true, Component: AiDrillsWidget },
  { id: 'coach-ai-prediction', title: 'Match Prediction', description: 'Pre-game win probability modeled on your hero pool and the live meta.', category: 'coach', defaultSize: COACH, singleton: true, Component: AiMatchPredictionWidget },
];

/** Simple left-to-right, top-to-bottom bin packer for a default layout --
 * wraps to a new row once the running column offset would exceed 12. */
function packLayout(ids: string[]): GridLayoutItem[] {
  const cols = 12;
  const byId = new Map(WIDGET_REGISTRY.map((w) => [w.id, w]));
  let x = 0;
  let y = 0;
  let rowH = 0;
  const out: GridLayoutItem[] = [];
  for (const widgetId of ids) {
    const def = byId.get(widgetId);
    if (!def) continue;
    const size = def.defaultSize;
    if (x + size.w > cols) {
      x = 0;
      y += rowH;
      rowH = 0;
    }
    out.push({
      i: `default-${widgetId}`, x, y, w: size.w, h: size.h,
      minW: size.minW, minH: size.minH, maxW: size.maxW, maxH: size.maxH,
    });
    x += size.w;
    rowH = Math.max(rowH, size.h);
  }
  return out;
}

const DEFAULT_DASHBOARD_WIDGET_IDS = [
  'stat-overview-pulse', 'stat-kda', 'stat-action-items',
  'spotlight-last-match', 'spotlight-player-identity', 'spotlight-top-hero',
  'trend-winrate', 'trend-kda', 'trend-gpm',
  'list-recent-matches', 'heroes-trends-ring', 'list-most-played-heroes',
  'matches-lane-record', 'coach-ai-insights', 'coach-ai-drills',
];

export const DEFAULT_DASHBOARD_INSTANCES: WidgetInstance[] = DEFAULT_DASHBOARD_WIDGET_IDS.map((widgetId) => ({
  instanceId: `default-${widgetId}`,
  widgetId,
}));

export const DEFAULT_DASHBOARD_LAYOUT: GridLayoutItem[] = packLayout(DEFAULT_DASHBOARD_WIDGET_IDS);
