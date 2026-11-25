# The assistant — ad script

The assistant's own advert: a helper inside the clinic's software that
does what it is told, by voice or typing, and listens to a consultation
to draft the note. About 100 seconds. The narrator is the same voice as
the plan adverts (Prabhat). Two scenes carry their own sound instead of
only the narrator: the doctor talking to the assistant, and a doctor and
a patient in a consultation. Those voices are made in
`assistant-voices.py` and are played into the real microphone path, so
what the screen does is what the product did on hearing them.

Rendered by `assistant-ad.mjs`, which reads this table through `tts.py`.
The scene column names a scene in that file.

It says only what has been tried. No "never wrong", no price, and it says
the assistant is in trial, because it is not yet at a paying clinic.

| t     | voice-over                                                                                     | b-roll        | hold
|---    |---                                                                                             |---            |---
| 0:00  | A clinic day is mostly typing. Names, tokens, bills, notes.                                    | card-title    | 5s
| 0:05  | The doctor types. The desk types. The patient waits.                                           | card-problem  | 5s
| 0:10  | Now the clinic has an assistant.                                                               | card-promise  | 3s
| 0:13  | One tap, and it listens. Say what you need.                                                    | call          | 30s
| 0:43  | Ask in English, Hindi or Marathi, the way people really mix them.                              | hindi         | 7s
| 0:50  | Payments, lab results, medicines given out. One sentence, then one yes.                        | payment       | 8s
| 0:58  | And each login can do only what that person is allowed to do.                                  | limits        | 7s
| 1:05  | In the consulting room, it listens to the visit.                                               | consult       | 25s
| 1:30  | And drafts the note, the medicines and the tests, for the doctor to check.                     | draft         | 8s
| 1:38  | Every second of this was recorded from the real product. It is in trial now.                   | card-proof    | 6s
| 1:44  | Nayaversse. Ask for a walkthrough at nayaversse dot in.                                        | card-cta      | 5s
