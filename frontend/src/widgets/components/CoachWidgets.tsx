import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Sparkles, Mic, Target, Brain } from 'lucide-react';
import './CoachWidgets.css';

function makeComingSoonWidget(Icon: LucideIcon, blurb: string): ComponentType<{ instanceId: string }> {
  return function ComingSoonWidget() {
    return (
      <div className="coach-widget">
        <div className="coach-widget-icon"><Icon size={26} /></div>
        <div className="coach-widget-blurb">{blurb}</div>
        <span className="coach-widget-badge">Coming Soon</span>
      </div>
    );
  };
}

export const AiInsightsWidget = makeComingSoonWidget(
  Brain,
  'A rolling digest of what the AI Coach noticed across your last few matches — recurring mistakes, patterns forming, and what to fix next.',
);

export const AiVoiceCoachWidget = makeComingSoonWidget(
  Mic,
  'Live, spoken callouts during the game via GSI — rotations to watch, timings to hit — without ever touching game memory.',
);

export const AiDrillsWidget = makeComingSoonWidget(
  Target,
  'Personalized practice drills generated from your actual mistakes (last-hitting, positioning, itemization) instead of generic tips.',
);

export const AiMatchPredictionWidget = makeComingSoonWidget(
  Sparkles,
  'Pre-game win probability and matchup breakdown for your current draft, modeled on your own hero pool and the live meta.',
);
