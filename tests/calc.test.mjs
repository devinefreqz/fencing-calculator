import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateColourbond,
  calculateTimber,
  clearOpeningM,
  defaultTimberInput,
  equalPostClearance,
  postSpacing,
  stepDown,
  stepRoundingCopy,
} from "../js/calc.js";
import { stepDownDiagram, timberDiagram } from "../js/diagrams.js";

test("baseline 10 m timber paling matches the shipped count", () => {
  const outcome = calculateTimber({
    ...defaultTimberInput(),
    lengthM: 10,
  });
  assert.equal(outcome.state, "ok");
  const r = outcome.result;
  assert.equal(r.posts, 6);
  assert.equal(r.bays, 5);
  assert.equal(r.centresM, 2);
  assert.equal(r.railPieces, 15);
  assert.equal(r.railM, 30);
  assert.equal(r.palings, 80);
  assert.equal(r.back, 40);
  assert.equal(r.front, 40);
  assert.equal(r.nails, 480);
  assert.equal(r.perMetre, 8);
  assert.equal(r.gap, 100);
  assert.equal(r.advance, 125);
  assert.equal(r.pitch, 250);
  assert.equal(r.plinthBoards, 0);
});

test("nails scale with rails and can be turned off", () => {
  const base = { ...defaultTimberInput(), lengthM: 10 };
  const twoRails = calculateTimber({ ...base, rails: 2 });
  assert.equal(twoRails.result.railPieces, 10);
  assert.equal(twoRails.result.nails, 320);
  const noNails = calculateTimber({ ...base, nailsPerRail: 0, plinth: true });
  assert.equal(noNails.result.nails, 0);
  assert.equal(noNails.result.plinthBoards, 5);
});

test("invalid lap or post width is rejected", () => {
  const wideLap = calculateTimber({ ...defaultTimberInput(), lengthM: 10, lapMm: 75 });
  assert.equal(wideLap.state, "error");
  assert.match(wideLap.error.title, /Lap too big/);
  const post = calculateTimber({ ...defaultTimberInput(), lengthM: 10, postMm: 2000 });
  assert.equal(post.state, "error");
  assert.match(post.error.title, /Post wider/);
  const zeroLap = calculateTimber({ ...defaultTimberInput(), lengthM: 10, lapMm: 0 });
  assert.equal(zeroLap.state, "error");
});

test("other paling lengths keep the full-run overlap count", () => {
  const oneBay = calculateTimber({ ...defaultTimberInput(), lengthM: 2.4 });
  assert.equal(oneBay.result.bays, 1);
  assert.equal(oneBay.result.palings, 19);
  assert.equal(oneBay.result.back, 10);
  assert.equal(oneBay.result.front, 9);
  const narrow = calculateTimber({
    ...defaultTimberInput(),
    lengthM: 12.5,
    widthMm: 100,
    lapMm: 20,
    postMm: 90,
  });
  assert.equal(narrow.result.palings, 156);
  assert.equal(narrow.result.gap, 60);
  assert.equal(narrow.result.posts, 7);
});

test("post spacing never exceeds the max bay", () => {
  const spaced = postSpacing(10, 2.4);
  assert.deepEqual(spaced, { bays: 5, centresM: 2, posts: 6 });
  assert.ok(spaced.centresM <= 2.4);
  assert.equal(postSpacing(2.4, 2.4).bays, 1);
  assert.equal(clearOpeningM(2, 100), 1.9);
});

test("colourbond take-off and timber-supported clear bay", () => {
  const outcome = calculateColourbond({
    lengthM: 10,
    postMode: "maxbay",
    maxBayM: 2.4,
    coverMm: 820,
    railsPerBay: 2,
    includeCaps: true,
    timberPosts: true,
    timberSizeMm: 100,
    fixingsPerPost: 4,
    heightMm: 1800,
    useStepDown: true,
    fallMm: 240,
    equalPosts: false,
  });
  assert.equal(outcome.state, "ok");
  const r = outcome.result;
  assert.equal(r.posts, 6);
  assert.equal(r.bays, 5);
  assert.equal(r.centresM, 2);
  assert.equal(r.clearM, 1.9);
  assert.equal(r.panels, 13);
  assert.equal(r.caps, 6);
  assert.equal(r.fixingCount, 24);
  assert.equal(r.railPieces, 10);
  assert.equal(r.railM, 20);
  assert.equal(r.railPieceM, 1.9);
  assert.equal(r.step.steps, 5);
  assert.equal(r.step.roundedStepMm, 48);
  assert.equal(r.step.even, true);
});

test("step-down steps equal bays and posts minus one", () => {
  const step = stepDown(240, 5);
  assert.equal(step.steps, 4);
  assert.equal(step.bays, 4);
  assert.equal(step.roundedStepMm, 60);
  assert.equal(step.even, true);
  assert.equal(stepRoundingCopy(step), null);
  const uneven = stepDown(100, 4);
  assert.equal(uneven.roundedStepMm, 33);
  assert.equal(uneven.remainderMm, 1);
  assert.match(stepRoundingCopy(uneven), /short of the true fall/);
  const over = stepDown(200, 4);
  assert.equal(over.roundedStepMm, 67);
  assert.ok(over.remainderMm < 0);
});

test("equal post height clearance and below-panel warning", () => {
  const ok = equalPostClearance(5, 60, 60, 2100);
  assert.equal(Math.round(ok.clear[0]), 150);
  assert.equal(Math.round(ok.clear[1]), 90);
  assert.equal(ok.flags.some(Boolean), false);
  const low = equalPostClearance(5, 100, 100, 1800);
  assert.ok(low.flags[0]);
  assert.ok(low.suggestedHeightMm > 1800);
});

test("diagrams keep the plinth, soil, and lap geometry labels", () => {
  const step = stepDownDiagram({
    posts: 5,
    roundedStepMm: 60,
    fallMm: 240,
    timberWidthMm: 100,
    equal: equalPostClearance(5, 60, 60, 2100),
  });
  assert.match(step.body, /150 plinth/);
  assert.match(step.body, /#c4a574/);
  assert.match(step.body, /#c4b59a/);
  assert.equal(step.body.includes("NaN"), false);
  const timber = calculateTimber({ ...defaultTimberInput(), lengthM: 10 }).result;
  const diagram = timberDiagram(defaultTimberInput(), timber, "run-1");
  assert.match(diagram.body, /gap 100/);
  assert.match(diagram.body, /lap 25/);
  assert.match(diagram.caption, /100 mm/);
  assert.equal(diagram.body.includes("undefined"), false);
});
