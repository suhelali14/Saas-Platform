import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowLeft, ArrowUp, ImagePlus, Pencil, Plus, Sparkles, Trash2, Upload } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

/*
 * Growth's AI models (Growth's D55): the faces owners choose to wear their
 * jewellery and clothes. Who each one is, how they look, how they carry
 * themselves on camera, how they are styled, which shops they suit, their
 * portrait and their examples. Every model is made by AI; none is a real
 * person. The roster lives on Growth's server; changes reach owners at once.
 */

type Kind = "jeweller" | "clothing" | "general";

interface Example {
  id: string;
  caption: string;
  kind: Kind;
  thumb?: string;
}

interface Model {
  id: string;
  name: string;
  gender: "woman" | "man";
  age: number;
  line: string;
  skin: string;
  build: string;
  hair: string;
  features: string;
  expression: string;
  pose: string;
  styling: string;
  note: string;
  suits: Kind[];
  active: boolean;
  position: number;
  portrait: boolean;
  side: boolean;
  full: boolean;
  look: string;
  manner: string;
  thumb?: string;
  thumbSide?: string;
  thumbFull?: string;
  examples: Example[];
  photos: number;
}

interface Roster {
  models: Model[];
  pictures: boolean;
  imageModel: string;
}

const KIND_NAMES: Record<Kind, string> = { jeweller: "Jewellers", clothing: "Clothing shops", general: "Other shops" };

type Angle = "front" | "side" | "full";
/** A model's reference photos. One front portrait says nothing of the side of the face or the body; Google's image models keep a person from several references (4 on Gemini 3.1 Flash Image, 5 on 3 Pro). */
const ANGLES: { angle: Angle; name: string; use: string }[] = [
  { angle: "front", name: "Front", use: "Who they are. Made from the description." },
  { angle: "side", name: "Three-quarter", use: "For earrings and turned shots." },
  { angle: "full", name: "Full length", use: "For clothing: height and build." },
];

const blank: Model = {
  id: "", name: "", gender: "woman", age: 28, line: "", skin: "", build: "", hair: "", features: "", expression: "", pose: "", styling: "", note: "",
  suits: ["jeweller", "clothing"], active: true, position: 0, portrait: false, side: false, full: false, look: "", manner: "", examples: [], photos: 0,
};

/** What Growth's image model reads, as Growth composes it (imagegen.Person.Look and Manner). */
function describe(m: Model) {
  const parts = [`an Indian ${m.gender === "man" ? "man" : "woman"} of about ${m.age}`];
  if (m.skin.trim()) parts.push(`${m.skin.trim()} skin`);
  for (const s of [m.build, m.hair, m.features]) if (s.trim()) parts.push(s.trim());
  if (m.expression.trim()) parts.push(`a ${m.expression.trim()} expression`);
  const manner = [m.pose.trim() && `On camera: ${m.pose.trim()}.`, m.styling.trim() && `Styling: ${m.styling.trim()}.`, m.note.trim()].filter(Boolean).join(" ");
  return { look: parts.join(", "), manner };
}

const slug = (name: string) => name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

/** A picture made small in the browser (1024px JPEG), so it travels well under Growth's 1 MB. */
async function smallPicture(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => bad(new Error("That file is not a picture."));
      i.src = url;
    });
    const scale = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    const g = c.getContext("2d");
    if (!g) throw new Error("This browser cannot prepare the picture.");
    g.fillStyle = "#fff";
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.86);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const errorText = (err: unknown) => (err instanceof ApiError || err instanceof Error ? err.message : "Growth did not answer.");

export function GrowthModels() {
  const toast = useToast();
  const [roster, setRoster] = useState<Roster | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Model | null>(null);

  const load = () =>
    apiFetch<Roster>("/growth/models").then(
      (r) => {
        setRoster(r);
        setError(null);
      },
      (e) => setError(errorText(e)),
    );
  useEffect(() => {
    load();
  }, []);

  const replace = (m: Model) => setRoster((r) => (r ? { ...r, models: r.models.some((x) => x.id === m.id) ? r.models.map((x) => (x.id === m.id ? m : x)) : [...r.models, m] } : r));

  const move = async (i: number, by: -1 | 1) => {
    if (!roster) return;
    const ids = roster.models.map((m) => m.id);
    const j = i + by;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setRoster({ ...roster, models: ids.map((id) => roster.models.find((m) => m.id === id)!) });
    try {
      await apiFetch("/growth/models-order", { method: "PUT", data: { ids } });
    } catch (e) {
      toast.error(errorText(e));
      load();
    }
  };

  const women = roster?.models.filter((m) => m.gender === "woman").length ?? 0;
  const off = roster?.models.filter((m) => !m.active).length ?? 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/growth" className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Nayaverse Growth
          </Link>
          <h1 className="text-xl font-semibold tracking-tight">AI models</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            The faces Growth's jewellers and clothing shops choose to wear their products. Every model is made by AI; none is a real person. Changes reach owners at once, and every photo made after a change follows it.
          </p>
        </div>
        <Button onClick={() => setEditing({ ...blank })}>
          <Plus className="mr-1.5 h-4 w-4" /> Add a model
        </Button>
      </div>

      {error ? (
        <Card>
          <CardContent className="p-5 text-sm">
            <p className="font-medium text-destructive">The roster could not be read from Growth.</p>
            <p className="mt-1 text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={load}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : !roster ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-72 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>
              {roster.models.length} models · {women} women · {roster.models.length - women} men{off ? ` · ${off} turned off` : ""}
            </span>
            <Badge variant={roster.imageModel === "gemini" ? "success" : "warning"}>{roster.imageModel === "gemini" ? "Gemini image model on" : "Image model in sample mode"}</Badge>
            {!roster.pictures && <Badge variant="destructive">Growth has no picture storage yet</Badge>}
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {roster.models.map((m, i) => (
              <li key={m.id}>
                <Card className={m.active ? "" : "opacity-70"}>
                  <CardContent className="p-0">
                    <button type="button" onClick={() => setEditing(m)} className="block w-full text-left" aria-label={`Edit ${m.name}`}>
                      <div className="aspect-[4/5] w-full overflow-hidden rounded-t-lg bg-muted">
                        {m.thumb ? (
                          <img src={m.thumb} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full place-items-center text-4xl font-semibold text-muted-foreground">{m.name.slice(0, 1)}</div>
                        )}
                      </div>
                    </button>
                    <div className="space-y-2 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold">
                            {m.name} <span className="font-normal text-muted-foreground">{m.age}</span>
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{m.line}</p>
                        </div>
                        {!m.active && <Badge variant="outline">Off</Badge>}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {m.suits.map((k) => (
                          <Badge key={k}>{KIND_NAMES[k]}</Badge>
                        ))}
                        {!m.portrait ? <Badge variant="warning">No portrait</Badge> : (!m.side || !m.full) && <Badge variant="warning">{[!m.side && "three-quarter", !m.full && "full length"].filter(Boolean).join(", ")} missing</Badge>}
                        {m.examples.length > 0 && <Badge variant="primary">{m.examples.length} examples</Badge>}
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs text-muted-foreground">{m.photos ? `In ${m.photos} photos` : "Not used yet"}</span>
                        <span className="flex gap-1">
                          <Button variant="ghost" size="icon" aria-label={`Move ${m.name} earlier`} disabled={i === 0} onClick={() => move(i, -1)}>
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" aria-label={`Move ${m.name} later`} disabled={i === roster.models.length - 1} onClick={() => move(i, 1)}>
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="icon" aria-label={`Edit ${m.name}`} onClick={() => setEditing(m)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}

      {editing && (
        <ModelDialog
          model={editing}
          isNew={!roster?.models.some((m) => m.id === editing.id) || !editing.id}
          pictures={roster?.pictures ?? false}
          gemini={roster?.imageModel === "gemini"}
          onSaved={(m) => {
            replace(m);
            setEditing(m);
          }}
          onDeleted={(id) => {
            setRoster((r) => (r ? { ...r, models: r.models.filter((m) => m.id !== id) } : r));
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

/** A labelled field: the label wraps the control, so the two are one for screen readers. */
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="block space-y-1.5">
        <span className="block">{label}</span>
        {children}
      </Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ModelDialog({
  model,
  isNew,
  pictures,
  gemini,
  onSaved,
  onDeleted,
  onClose,
}: {
  model: Model;
  isNew: boolean;
  pictures: boolean;
  gemini: boolean;
  onSaved: (m: Model) => void;
  onDeleted: (id: string) => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const [m, setM] = useState<Model>(model);
  const [idTouched, setIdTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [making, setMaking] = useState<Angle | null>(null);
  const [ex, setEx] = useState<{ image: string; caption: string; kind: Kind }>({ image: "", caption: "", kind: "jeweller" });
  const saved = !isNew;
  const preview = useMemo(() => describe(m), [m]);
  const set = <K extends keyof Model>(k: K) => (v: Model[K]) => setM((x) => ({ ...x, [k]: v }));
  const text = (k: "line" | "skin" | "build" | "hair" | "features" | "expression" | "pose" | "styling" | "note") => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k)(e.target.value);

  const save = async () => {
    const id = m.id || slug(m.name);
    if (!id) return toast.error("Give the model a name.");
    setSaving(true);
    try {
      const { look: _l, manner: _m, thumb: _t, thumbSide: _ts, thumbFull: _tf, side: _s, full: _f, examples: _e, photos: _p, portrait: _po, ...body } = { ...m, id };
      const out = await apiFetch<Model>(`/growth/models/${encodeURIComponent(id)}`, { method: "PUT", data: body });
      toast.success(saved ? `${out.name} is saved.` : `${out.name} is added. Owners can choose them now.`);
      setM(out);
      onSaved(out);
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setSaving(false);
    }
  };

  const withPicture = async (e: ChangeEvent<HTMLInputElement>, then: (img: string) => Promise<void>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      await then(await smallPicture(f));
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const uploadAngle = (angle: Angle) => (e: ChangeEvent<HTMLInputElement>) =>
    withPicture(e, async (image) => {
      const out = await apiFetch<Model>(`/growth/models/${encodeURIComponent(m.id)}/portrait?angle=${angle}`, { method: "PUT", data: { image } });
      setM(out);
      onSaved(out);
      toast.success("Kept. New photos with this model use it.");
    });

  const makeAngle = async (angle: Angle) => {
    setMaking(angle);
    try {
      const out = await apiFetch<Model>(`/growth/models/${encodeURIComponent(m.id)}/portrait/make?angle=${angle}`, { method: "POST", data: {} });
      setM(out);
      onSaved(out);
      toast.success(angle === "front" ? "A new portrait is made from the description." : "Made from the front portrait: the same person, another angle.");
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setMaking(null);
    }
  };
  const has = (a: Angle) => (a === "front" ? m.portrait : a === "side" ? m.side : m.full);
  const thumbOf = (a: Angle) => (a === "front" ? m.thumb : a === "side" ? m.thumbSide : m.thumbFull);

  const addExample = async () => {
    try {
      const out = await apiFetch<Model>(`/growth/models/${encodeURIComponent(m.id)}/examples`, { method: "POST", data: ex });
      setM(out);
      onSaved(out);
      setEx({ image: "", caption: "", kind: ex.kind });
      toast.success("The example is added.");
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const removeExample = async (eid: string) => {
    try {
      const out = await apiFetch<Model>(`/growth/models/${encodeURIComponent(m.id)}/examples/${encodeURIComponent(eid)}`, { method: "DELETE" });
      setM(out);
      onSaved(out);
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const remove = async () => {
    try {
      await apiFetch(`/growth/models/${encodeURIComponent(m.id)}`, { method: "DELETE" });
      toast.success(`${m.name} is deleted.`);
      onDeleted(m.id);
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const toggleSuit = (k: Kind) => set("suits")(m.suits.includes(k) ? m.suits.filter((x) => x !== k) : [...m.suits, k]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{saved ? m.name : "A new model"}</DialogTitle>
          <DialogDescription>Made by AI, not a real person. Describe them plainly: the image model reads every word.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
          <div className="space-y-4">
            {saved ? (
              <>
                {ANGLES.map(({ angle, name, use }) => (
                  <div key={angle} className={angle === "front" ? "space-y-2" : "grid grid-cols-[72px_minmax(0,1fr)] items-start gap-3"}>
                    <div className={`${angle === "front" ? "aspect-[4/5] w-full" : angle === "full" ? "aspect-[2/3] w-[72px]" : "aspect-[4/5] w-[72px]"} overflow-hidden rounded-lg bg-muted`}>
                      {thumbOf(angle) ? (
                        <img src={thumbOf(angle)} alt={`${m.name}, ${name.toLowerCase()}`} className="h-full w-full object-cover" />
                      ) : (
                        <div className={`grid h-full place-items-center font-semibold text-muted-foreground ${angle === "front" ? "text-5xl" : "text-xl"}`}>{(m.name || "?").slice(0, 1)}</div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-sm font-semibold">
                        {name}
                        {!has(angle) && <span className="ml-1.5 text-xs font-normal text-warning">missing</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">{use}</p>
                      <div className="flex flex-wrap gap-1.5">
                        <Button variant="outline" size="sm" asChild disabled={!pictures}>
                          <label className="cursor-pointer">
                            <Upload className="mr-1 h-3.5 w-3.5" /> Upload
                            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={uploadAngle(angle)} disabled={!pictures} aria-label={`Upload ${name.toLowerCase()} photo`} />
                          </label>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => makeAngle(angle)}
                          loading={making === angle}
                          disabled={!pictures || !gemini || making !== null || (angle !== "front" && !m.portrait)}
                          aria-label={`Make the ${name.toLowerCase()} photo with AI`}
                        >
                          <Sparkles className="mr-1 h-3.5 w-3.5" /> Make
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  {!pictures
                    ? "Growth needs picture storage first."
                    : !gemini
                      ? "Making needs Growth's Gemini key; uploading works now."
                      : "Make the front first: the other two are made from it, so they are the same person. About a minute each."}
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Save the model first; then add their reference photos and examples.</p>
            )}
          </div>

          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name">
                <Input
                  value={m.name}
                  maxLength={40}
                  onChange={(e) => {
                    const name = e.target.value;
                    setM((x) => ({ ...x, name, id: saved || idTouched ? x.id : slug(name) }));
                  }}
                />
              </Field>
              <Field label="Id" hint={saved ? "Fixed once saved." : "Used in links; small letters and dashes."}>
                <Input
                  value={m.id}
                  disabled={saved}
                  maxLength={40}
                  onChange={(e) => {
                    setIdTouched(true);
                    set("id")(slug(e.target.value));
                  }}
                />
              </Field>
              <Field label="Woman or man">
                <Select value={m.gender} onValueChange={(v) => set("gender")(v as Model["gender"])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="woman">Woman</SelectItem>
                    <SelectItem value="man">Man</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Age" hint="18 to 80: every model is an adult.">
                <Input type="number" min={18} max={80} value={m.age} onChange={(e) => set("age")(Number(e.target.value))} />
              </Field>
            </div>

            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold">How they look</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Skin tone" hint="In neutral words: light brown to deep brown.">
                  <Input value={m.skin} onChange={text("skin")} placeholder="medium-deep brown" />
                </Field>
                <Field label="Build">
                  <Input value={m.build} onChange={text("build")} placeholder="average build, plus-size build" />
                </Field>
                <Field label="Hair">
                  <Input value={m.hair} onChange={text("hair")} placeholder="black hair tied in a neat low bun" />
                </Field>
                <Field label="Features">
                  <Input value={m.features} onChange={text("features")} placeholder="a neat short beard, wears a hijab" />
                </Field>
              </div>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold">How they carry themselves</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Expression">
                  <Input value={m.expression} onChange={text("expression")} placeholder="warm, confident" />
                </Field>
                <Field label="Styling">
                  <Input value={m.styling} onChange={text("styling")} placeholder="soft bridal makeup" />
                </Field>
              </div>
              <Field label="Pose on camera" hint="How they stand and move in every photo.">
                <Input value={m.pose} onChange={text("pose")} placeholder="stands naturally, turns a little towards the light" />
              </Field>
              <Field label="Anything else for the image model">
                <Textarea rows={2} value={m.note} onChange={text("note")} placeholder="Keeps hands relaxed; never looks away from the product." />
              </Field>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">Offered to</legend>
              <div className="flex flex-wrap gap-4 text-sm">
                {(Object.keys(KIND_NAMES) as Kind[]).map((k) => (
                  <label key={k} className="flex items-center gap-2">
                    <input type="checkbox" className="h-4 w-4" checked={m.suits.includes(k)} onChange={() => toggleSuit(k)} />
                    {KIND_NAMES[k]}
                  </label>
                ))}
              </div>
              <label className="flex items-center gap-2 pt-1 text-sm">
                <input type="checkbox" className="h-4 w-4" checked={m.active} onChange={(e) => set("active")(e.target.checked)} />
                Owners can choose {m.name || "this model"}
              </label>
            </fieldset>

            <Field label="What owners read under the name" hint="Left empty, it is made from the age, skin tone and build.">
              <Input value={m.line} onChange={text("line")} placeholder={`${m.age} · ${m.skin || "skin tone"} · ${m.build || "build"}`} />
            </Field>

            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">What the image model reads</p>
              <p>
                The model: {preview.look}. {preview.manner}
              </p>
            </div>
          </div>
        </div>

        {saved && (
          <section className="space-y-3 border-t pt-5">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-semibold">Examples</h3>
              <span className="text-xs text-muted-foreground">Up to 6. Owners see them when they choose {m.name}.</span>
            </div>
            {m.examples.length > 0 && (
              <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                {m.examples.map((e) => (
                  <li key={e.id} className="space-y-1">
                    <div className="relative aspect-[4/5] overflow-hidden rounded-md bg-muted">
                      {e.thumb && <img src={e.thumb} alt={e.caption} className="h-full w-full object-cover" />}
                      <button type="button" onClick={() => removeExample(e.id)} aria-label={`Remove ${e.caption}`} className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-background/90 hover:bg-background">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="line-clamp-2 text-xs">{e.caption}</p>
                  </li>
                ))}
              </ul>
            )}
            {m.examples.length < 6 && (
              <div className="grid items-end gap-3 sm:grid-cols-[auto_minmax(0,1fr)_160px_auto]">
                <Button variant="outline" size="sm" asChild disabled={!pictures}>
                  <label className="cursor-pointer">
                    <ImagePlus className="mr-1.5 h-4 w-4" /> {ex.image ? "Picture chosen" : "Choose picture"}
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={!pictures} onChange={(e) => withPicture(e, async (image) => setEx((x) => ({ ...x, image })))} />
                  </label>
                </Button>
                <Field label="What it shows">
                  <Input value={ex.caption} maxLength={120} onChange={(e) => setEx((x) => ({ ...x, caption: e.target.value }))} placeholder="Gold temple necklace" />
                </Field>
                <Field label="Kind">
                  <Select value={ex.kind} onValueChange={(v) => setEx((x) => ({ ...x, kind: v as Kind }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="jeweller">Jewellery</SelectItem>
                      <SelectItem value="clothing">Clothing</SelectItem>
                      <SelectItem value="general">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Button size="sm" onClick={addExample} disabled={!ex.image || !ex.caption.trim()}>
                  Add example
                </Button>
              </div>
            )}
          </section>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {saved ? (
            m.photos > 0 ? (
              <p className="text-xs text-muted-foreground">In {m.photos} photos: turn them off instead of deleting.</p>
            ) : (
              <Button variant="ghost" className="text-destructive" onClick={remove}>
                <Trash2 className="mr-1.5 h-4 w-4" /> Delete {m.name}
              </Button>
            )
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Done
            </Button>
            <Button onClick={save} loading={saving} disabled={!m.name.trim()}>
              {saved ? "Save" : "Add the model"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
