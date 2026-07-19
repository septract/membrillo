// Goal-log derivation. Objectives are pure functions of state — nothing is
// ever stored as "done", so the log cannot drift from what is actually true.

import type { State, Story } from './types.ts';
import { checkAll } from './rules.ts';

export interface ObjectiveView {
  id: string;
  text: string;
  done: boolean;
}

/** Objectives currently worth showing, with their live completion status. */
export function objectiveViews(story: Story, state: State): ObjectiveView[] {
  return story.objectives
    .filter((o) => checkAll(state, o.active))
    .map((o) => ({
      id: o.id,
      text: o.text,
      done: o.done !== undefined && checkAll(state, o.done),
    }));
}
