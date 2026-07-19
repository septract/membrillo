// Unit tests for the pure engine core (node --test).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  applyRule,
  checkCondition,
  firstMatch,
  initialState,
  parseCondition,
  stateKey,
} from '../engine/core/rules.ts';
import {
  act,
  applyItem,
  availableVerbs,
  chooseOption,
  combine,
  DEFAULT_TEXT,
  useExit,
  visibleHotspots,
} from '../engine/core/verbs.ts';
import type { Scene, State, Story } from '../engine/core/types.ts';

function state(partial: Partial<State> = {}): State {
  return { scene: 'room', flags: [], inventory: [], companions: [], ...partial };
}

test('parseCondition accepts the three kinds and negation', () => {
  assert.deepEqual(parseCondition('flag:door_open'), { negated: false, kind: 'flag', id: 'door_open' });
  assert.deepEqual(parseCondition('!item:rope'), { negated: true, kind: 'item', id: 'rope' });
  assert.equal(parseCondition('companion:ada').kind, 'companion');
});

test('parseCondition rejects malformed conditions', () => {
  for (const bad of ['torch', 'flags:x', 'flag:', ':x', '!', 'item']) {
    assert.throws(() => parseCondition(bad), new RegExp('Malformed'), bad);
  }
});

test('checkCondition looks in the right pool and honours negation', () => {
  const s = state({ flags: ['lit'], inventory: ['rope'], companions: ['ada'] });
  assert.equal(checkCondition(s, 'flag:lit'), true);
  assert.equal(checkCondition(s, 'item:rope'), true);
  assert.equal(checkCondition(s, 'companion:ada'), true);
  assert.equal(checkCondition(s, 'flag:rope'), false); // right id, wrong pool
  assert.equal(checkCondition(s, '!flag:lit'), false);
  assert.equal(checkCondition(s, '!item:lens'), true);
});

test('firstMatch takes the first passing rule; unconditional rule is the fallback', () => {
  const s = state({ flags: ['b'] });
  const bucket = [
    { requires: ['flag:a'], text: 'A' },
    { requires: ['flag:b'], text: 'B' },
    { text: 'fallback' },
  ];
  assert.equal(firstMatch(s, bucket)?.text, 'B');
  assert.equal(firstMatch(state(), bucket)?.text, 'fallback');
  assert.equal(firstMatch(s, undefined), undefined);
});

test('applyRule is immutable and keeps pools sorted and unique', () => {
  const before = state({ inventory: ['rope'] });
  const { state: after } = applyRule(before, {
    setFlags: ['b_flag', 'a_flag', 'b_flag'],
    giveItem: 'lens',
  });
  assert.deepEqual(before, state({ inventory: ['rope'] })); // untouched
  assert.deepEqual(after.flags, ['a_flag', 'b_flag']);
  assert.deepEqual(after.inventory, ['lens', 'rope']);
  const again = applyRule(after, { giveItem: 'lens' }).state;
  assert.deepEqual(again.inventory, ['lens', 'rope']); // no duplicate
});

test('applyRule removes and reports goto/dialogue without applying them', () => {
  const s = state({ flags: ['lit'], inventory: ['rope'] });
  const out = applyRule(s, { removeItem: 'rope', clearFlags: ['lit'], goto: 'hall', dialogue: 'bob' });
  assert.deepEqual(out.state.inventory, []);
  assert.deepEqual(out.state.flags, []);
  assert.equal(out.state.scene, 'room'); // goto is reported, not applied
  assert.equal(out.goto, 'hall');
  assert.equal(out.dialogue, 'bob');
});

test('applyRule passes the speaker hint through', () => {
  assert.equal(applyRule(state(), { text: 'aye', speaker: 'target' }).speaker, 'target');
  assert.equal(applyRule(state(), { text: 'hm' }).speaker, undefined);
});

const story: Story = {
  manifest: { id: 't', title: 'T', start: 'room' },
  items: {
    rope: { id: 'rope', name: 'rope', combine: [{ withItem: 'hook', giveItem: 'grapple', text: 'tied' }] },
    hook: { id: 'hook', name: 'hook' },
    grapple: { id: 'grapple', name: 'grapple' },
  },
  dialogues: {},
  scenes: {
    room: {
      id: 'room',
      name: 'Room',
      walk: { x: 0, y: 100, w: 320, h: 80 },
      start: { x: 10, y: 150 },
      hotspots: [
        {
          id: 'chest',
          name: 'chest',
          region: { x: 0, y: 0, w: 10, h: 10 },
          look: [{ text: 'a chest' }],
          take: [{ text: 'got it', giveItem: 'rope' }],
        },
        {
          id: 'ghost',
          name: 'ghost',
          region: { x: 20, y: 0, w: 10, h: 10 },
          requires: ['flag:seance'],
          look: [{ text: 'boo' }],
        },
        {
          id: 'lock',
          name: 'lock',
          region: { x: 40, y: 0, w: 10, h: 10 },
          use: [{ text: 'It is locked.' }],
          itemUse: [
            { withItem: 'grapple', requires: ['flag:brave'], text: 'hooked!', setFlags: ['door_open'] },
            { withItem: 'grapple', text: 'You hesitate.' },
            { withItem: 'rope', text: 'Too soft to pick a lock.' },
          ],
        },
      ],
      exits: [
        {
          id: 'door',
          name: 'door',
          region: { x: 300, y: 0, w: 20, h: 60 },
          to: 'hall',
          requires: ['flag:door_open'],
        },
      ],
    } as Scene,
    hall: { id: 'hall', name: 'Hall', beats: ['done'], ending: true },
  },
};

test('interact resolves to take when defined, and acting applies its effects', () => {
  const chest = story.scenes['room']!.hotspots![0]!;
  assert.deepEqual(availableVerbs(chest), ['look', 'interact']);
  const out = act(story, state(), 'chest', 'interact');
  assert.equal(out?.text, 'got it');
  assert.deepEqual(out?.state.inventory, ['rope']);
});

test('acting without a matching bucket yields the default text and no change', () => {
  const out = act(story, state(), 'chest', 'talk');
  assert.equal(out?.text, DEFAULT_TEXT.talk);
  assert.equal(stateKey(out!.state), stateKey(state()));
});

test('targets gated by requires are invisible and unactionable', () => {
  assert.equal(visibleHotspots(story.scenes['room']!, state()).length, 2); // chest + lock, not ghost
  assert.equal(act(story, state(), 'ghost', 'look'), null);
  const seeing = state({ flags: ['seance'] });
  assert.equal(act(story, seeing, 'ghost', 'look')?.text, 'boo');
});

test('combine works in either direction, consumes components, gives the result', () => {
  const s = state({ inventory: ['hook', 'rope'] });
  for (const [a, b] of [['rope', 'hook'], ['hook', 'rope']] as const) {
    const out = combine(story, s, a, b);
    assert.equal(out.text, 'tied');
    assert.deepEqual(out.state.inventory, ['grapple']);
  }
  assert.equal(combine(story, s, 'rope', 'rope').text, DEFAULT_TEXT.combine);
  assert.equal(combine(story, state({ inventory: ['rope'] }), 'rope', 'hook').text, DEFAULT_TEXT.combine);
});

test('applyItem: player-chosen item resolves the first matching itemUse rule', () => {
  const holding = state({ inventory: ['grapple', 'rope'] });
  // Ordered rules: gated rule first, flavour fallback for the same item after.
  assert.equal(applyItem(story, holding, 'lock', 'grapple')?.text, 'You hesitate.');
  const brave = state({ inventory: ['grapple'], flags: ['brave'] });
  const out = applyItem(story, brave, 'lock', 'grapple');
  assert.equal(out?.text, 'hooked!');
  assert.deepEqual(out?.state.flags, ['brave', 'door_open']);
  // Wrong-item flavour response, and the default rebuff.
  assert.equal(applyItem(story, holding, 'lock', 'rope')?.text, 'Too soft to pick a lock.');
  assert.equal(applyItem(story, holding, 'chest', 'rope')?.text, DEFAULT_TEXT.apply);
  // Item not actually held → rebuff, no effects.
  assert.equal(applyItem(story, state(), 'lock', 'grapple')?.text, DEFAULT_TEXT.apply);
  // Invisible target → null.
  assert.equal(applyItem(story, holding, 'ghost', 'grapple'), null);
});

test('exits honour their requires gate', () => {
  assert.equal(useExit(story, state(), 'door'), null);
  const open = state({ flags: ['door_open'] });
  assert.equal(useExit(story, open, 'door')?.scene, 'hall');
});

test('dialogue options apply effects and report the next node', () => {
  const step = chooseOption(state(), { text: 'hi', to: 'end', setFlags: ['met'], giveItem: 'rope' });
  assert.deepEqual(step.state.flags, ['met']);
  assert.deepEqual(step.state.inventory, ['rope']);
  assert.equal(step.to, 'end');
});

test('initialState starts empty at the given scene', () => {
  assert.deepEqual(initialState('room'), state());
});
