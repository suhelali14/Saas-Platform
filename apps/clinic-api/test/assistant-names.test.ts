import { test } from "node:test";
import assert from "node:assert/strict";
import { nameFit, soundKey } from "../src/lib/assistant/names.js";
import { route } from "../src/lib/assistant/router.js";

test("a name sounds the same however it was spelt", () => {
  assert.equal(soundKey("Sayyed"), soundKey("Syed"));
  assert.equal(soundKey("Sayyed"), soundKey("Saiyad"));
  assert.equal(soundKey("Sayyed"), soundKey("सय्यद"));
  assert.equal(soundKey("Fatima"), soundKey("Fatema"));
  assert.equal(soundKey("Fatima"), soundKey("फातिमा"));
  assert.equal(soundKey("Deshpande"), soundKey("Deshpandey"));
  assert.equal(soundKey("Gaikwad"), soundKey("Gaykwad"));
  assert.equal(soundKey("Zubair"), soundKey("Jubair"));
  assert.equal(soundKey("Phadke"), soundKey("Fadke"));
  assert.equal(soundKey("Wagh"), soundKey("Vagh"));
  assert.equal(soundKey("Joshi"), soundKey("जोशी"));
  assert.equal(soundKey("Kulkarni"), soundKey("कुलकर्णी"));
});

test("a spoken name fits the name on file", () => {
  // The owner's own request, as the speech engine wrote it.
  assert.equal(nameFit("Fatima Syed", "Fatima Sayyed"), 1);
  assert.equal(nameFit("फातिमा सय्यद", "Fatima Sayyed"), 1);
  assert.equal(nameFit("Ramesh Joshi", "Mr. Ramesh Joshi"), 1);
  assert.equal(nameFit("Joshi", "Ramesh Joshi"), 1);
  // One sound out is still them, but less surely.
  assert.ok(nameFit("Kavita Gaikwar", "Kavita Gaikwad") >= 0.6);
  assert.ok(nameFit("Kavita Gaikwar", "Kavita Gaikwad") < 1);
  // The start of a name.
  assert.ok(nameFit("Ram", "Ramesh Joshi") >= 0.6);
});

test("a different person is not a fit", () => {
  assert.equal(nameFit("Fatima Syed", "Fatima Shaikh"), 0);
  assert.equal(nameFit("Ramesh Joshi", "Suresh Joshi"), 0);
  assert.equal(nameFit("Vikram More", "Vikram Patil"), 0);
  assert.equal(nameFit("", "Vikram Patil"), 0);
});

test("the queue is worked by voice, by rule", () => {
  const anywhere = { today: new Date(2026, 10, 25, 12), hasPatient: false };
  assert.deepEqual(route("call the next patient", anywhere), { action: "open_next_patient", params: {} });
  assert.deepEqual(route("agla patient bulao", anywhere), { action: "open_next_patient", params: {} });
  assert.deepEqual(route("पुढचा पेशंट बोलवा", anywhere), { action: "open_next_patient", params: {} });
  assert.deepEqual(route("open token 5", anywhere), { action: "find_patient", params: { query: "token 5" } });
  assert.deepEqual(route("token 12", anywhere), { action: "find_patient", params: { query: "token 12" } });
  assert.deepEqual(route("टोकन 7 खोलो", anywhere), { action: "find_patient", params: { query: "token 7" } });
  // Asking who it is, is still a question.
  assert.deepEqual(route("who is next", anywhere), { action: "queue_summary", params: {} });
  assert.deepEqual(route("next patient", anywhere), { action: "queue_summary", params: {} });
});
