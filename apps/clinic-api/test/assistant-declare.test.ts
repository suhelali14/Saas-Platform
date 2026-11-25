import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { forTesting, jsonSchemaOf, told } from "../src/lib/assistant/declare.js";
import { relevant, SEND_ALL_UP_TO } from "../src/lib/assistant/relevant.js";
import type { Action } from "../src/lib/assistant/registry.js";

test("a route's schema becomes what the model is shown", () => {
  const schema = z.object({
    name: z.string().describe("What it is called."),
    price: z.number().nonnegative(),
    count: z.number().int().optional(),
    kind: z.enum(["PROCEDURE", "LAB"]).optional(),
    urgent: z.boolean().nullable(),
  });
  assert.deepEqual(jsonSchemaOf(schema), {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: "string", description: "What it is called." },
      price: { type: "number" },
      count: { type: "integer" },
      kind: { type: "string", enum: ["PROCEDURE", "LAB"] },
      urgent: { type: "boolean" },
    },
    // Only what the route cannot do without.
    required: ["name", "price"],
  });
});

test("a route that says nothing about its name is named from its address", () => {
  assert.equal(forTesting.nameFrom("POST", "/api/clinic/service-items"), "add_service_items");
  assert.equal(forTesting.nameFrom("POST", "/api/clinic/drugs/:id/batches"), "add_drugs_batches");
  assert.equal(forTesting.nameFrom("PATCH", "/api/clinic/appointments/:id"), "change_appointments");
  assert.equal(forTesting.labelOf("defaultPrice"), "Default price");
  assert.equal(forTesting.labelOf("batchNumber"), "Batch number");
});

test("a declared route is an action: a change that waits for a yes, kept off the list of those who cannot use it", () => {
  const action = forTesting.actionFrom("POST", "/api/clinic/things", told({
    summary: "Adds a thing.",
    asks: z.object({ name: z.string() }),
    title: (a) => `Add ${a.name}?`,
    roles: ["DOCTOR"],
  }));
  assert.equal(action.kind, "write");
  assert.equal(action.name, "add_things");
  assert.equal(action.needsPatient, false);
  assert.equal(action.allowed({ userId: "u", role: "DOCTOR", isAdmin: false, name: "" }), true);
  assert.equal(action.allowed({ userId: "u", role: "NURSE", isAdmin: false, name: "" }), false);
  assert.equal(action.allowed({ userId: "u", role: "NURSE", isAdmin: true, name: "" }), true);
  // It can only describe itself; saving is a separate step, after a yes.
  assert.equal(typeof action.preview, "function");
  const bound = forTesting.actionFrom("POST", "/api/clinic/patients/:id/things", told({ summary: "x", asks: z.object({}), title: () => "x", bind: { id: "patient" } }));
  assert.equal(bound.needsPatient, true);
});

test("a long list of actions is narrowed to those the request could mean", () => {
  const make = (name: string, summary: string): Action => ({ name, summary, kind: "read", schema: z.object({}), jsonSchema: { type: "object", properties: {} }, allowed: () => true, run: async () => ({ kind: "sorry", say: "" }) });
  const filler = Array.from({ length: SEND_ALL_UP_TO + 20 }, (_, i) => make(`thing_${i}`, `Does unrelated thing number ${i} with widgets.`));
  const all = [
    ...filler,
    make("add_stock", "Adds stock of a medicine that has arrived at the pharmacy."),
    make("give_discount", "Takes an amount off the patient's bill."),
    make("find_patient", "Finds a patient by name."),
    make("enter_lab_result", "Writes in the result of a lab test."),
  ];
  const names = (request: string, mentioned: string[] = []) => relevant(all, request, mentioned).map((a) => a.name);

  assert.ok(names("naya stock aaya hai metformin ka").includes("add_stock"));
  assert.ok(names("bill mein 200 kam karo").includes("give_discount"));
  assert.ok(names("रिपोर्ट आला आहे").includes("enter_lab_result"));
  // Finding somebody is always possible.
  assert.ok(names("something nobody anticipated").includes("find_patient"));
  // A correction is about the action it corrects, whatever its words.
  assert.ok(names("no, make it 300", ["give_discount"]).includes("give_discount"));
  assert.ok(names("anything").length <= 25);
  // A short list is sent whole.
  assert.equal(relevant(all.slice(0, 10), "anything").length, 10);
});
