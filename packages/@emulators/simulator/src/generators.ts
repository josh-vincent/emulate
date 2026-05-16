import type { Provider } from "./scenario.js";

// Each generator emits a record/payload shaped like the provider's *real* API
// object, so the consumer's production code paths exercise unchanged. Output is
// deterministic in `seq` for reproducible runs and assertions.

export type GeneratedTick =
  | { kind: "sync"; model: string; record: Record<string, unknown> }
  | { kind: "forward"; payload: Record<string, unknown> };

const SUBJECTS = [
  "AS1851 inspection due",
  "Pump test results",
  "Re: site access",
  "Quarterly compliance report",
  "Defect raised on Level 3",
  "Schedule confirmation",
];
const SENDERS = ["ops@acme.test", "scheduler@acme.test", "field@acme.test", "compliance@acme.test"];
const BODIES = [
  "Heads up — the inspection window moved to next Tuesday.",
  "Results attached. One minor defect, see notes.",
  "Confirming the team will be on site at 8am.",
  "Please review and sign off when you get a chance.",
];

const pick = <T>(arr: readonly T[], seq: number): T => arr[seq % arr.length];

function gmail(seq: number, now: Date): GeneratedTick {
  const subject = pick(SUBJECTS, seq);
  const from = pick(SENDERS, seq);
  return {
    kind: "sync",
    model: "messages",
    record: {
      id: `sim-gm-${seq}`,
      threadId: `sim-th-${seq}`,
      labelIds: ["INBOX", "UNREAD"],
      snippet: pick(BODIES, seq),
      internalDate: String(now.getTime()),
      payload: {
        headers: [
          { name: "Subject", value: subject },
          { name: "From", value: from },
          { name: "Date", value: now.toUTCString() },
        ],
      },
    },
  };
}

function graphMail(seq: number, now: Date): GeneratedTick {
  const from = pick(SENDERS, seq);
  return {
    kind: "sync",
    model: "messages",
    record: {
      id: `sim-gmail-${seq}`,
      subject: pick(SUBJECTS, seq),
      bodyPreview: pick(BODIES, seq),
      isRead: false,
      receivedDateTime: now.toISOString(),
      from: { emailAddress: { address: from, name: from.split("@")[0] } },
    },
  };
}

function teams(seq: number, now: Date): GeneratedTick {
  return {
    kind: "sync",
    model: "messages",
    record: {
      id: `sim-tm-${seq}`,
      messageType: "message",
      createdDateTime: now.toISOString(),
      from: { user: { id: `u-${seq % 4}`, displayName: pick(["Sam Ops", "Jess Field", "Priya Lead"], seq) } },
      body: { contentType: "html", content: `<p>${pick(BODIES, seq)}</p>` },
    },
  };
}

function drive(seq: number, now: Date): GeneratedTick {
  const exts = [
    ["report.pdf", "application/pdf"],
    ["photos.zip", "application/zip"],
    ["notes.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ] as const;
  const [name, mimeType] = pick(exts, seq);
  return {
    kind: "sync",
    model: "files",
    record: {
      kind: "drive#file",
      id: `sim-dr-${seq}`,
      name: `${seq}-${name}`,
      mimeType,
      modifiedTime: now.toISOString(),
      createdTime: now.toISOString(),
    },
  };
}

function calendar(seq: number, now: Date): GeneratedTick {
  const start = new Date(now.getTime() + 3600_000);
  const end = new Date(start.getTime() + 1800_000);
  return {
    kind: "sync",
    model: "events",
    record: {
      id: `sim-ev-${seq}`,
      status: "confirmed",
      summary: pick(SUBJECTS, seq),
      start: { dateTime: start.toISOString(), timeZone: "UTC" },
      end: { dateTime: end.toISOString(), timeZone: "UTC" },
      created: now.toISOString(),
    },
  };
}

function whatsapp(seq: number, now: Date): GeneratedTick {
  const from = `6140000${String(1000 + (seq % 9000))}`;
  return {
    kind: "forward",
    payload: {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA_SIM",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { display_phone_number: "61400000000", phone_number_id: "PNID_SIM" },
                contacts: [{ profile: { name: pick(["Sam", "Jess", "Priya"], seq) }, wa_id: from }],
                messages: [
                  {
                    from,
                    id: `wamid.sim-${seq}`,
                    timestamp: String(Math.floor(now.getTime() / 1000)),
                    type: "text",
                    text: { body: pick(BODIES, seq) },
                  },
                ],
              },
            },
          ],
        },
      ],
    },
  };
}

const GENERATORS: Record<Provider, (seq: number, now: Date) => GeneratedTick> = {
  gmail,
  "graph-mail": graphMail,
  teams,
  drive,
  calendar,
  whatsapp,
};

/** Build one provider-faithful tick. Deterministic in `seq`. */
export function generate(provider: Provider, seq: number, now: Date): GeneratedTick {
  const fn = GENERATORS[provider];
  if (!fn) throw new Error(`[emulate-sim] no generator for provider "${provider}"`);
  return fn(seq, now);
}
