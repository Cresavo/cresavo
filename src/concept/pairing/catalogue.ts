import { z } from "zod";
import { field } from "../tools/define";
import { MAX_PRICE } from "../services/edit";
import type { OwnerWorkspace } from "./owner-workspace";
import { blockReasons, cancelReasons, fictionalNames, replyTemplates } from "./changes";
import type { SCOPES } from "./policy";
import type { MessageKey } from "../i18n";

type Scope = typeof SCOPES[number];
export type ToolScope = Scope | readonly Scope[];
export const permitted = (required: ToolScope, scopes: string[]) =>
  typeof required === "string" ? scopes.includes(required) : required.some(s => scopes.includes(s));

export interface ToolContext {
  grant: { clientId: string; scopes: string };
  workspace: Omit<OwnerWorkspace, "decide">;
}
export type ToolName = Extract<MessageKey, `pair.tool.${string}`> extends `pair.tool.${infer Name}` ? Name : never;
export type RegisterTool = <S extends z.ZodObject>(name: ToolName, scope: ToolScope, schema: S,
  run: (ctx: ToolContext, input: z.output<S>) => unknown, readOnly?: boolean) => void;

export function registerCatalogue(tool: RegisterTool) {
  const id = z.uuid();
  const ref = z.string().min(1).max(128);
  const date = z.iso.date();
  const paging = { offset: z.int().min(0).optional(), limit: z.int().min(1).max(50).optional() };
  const range = { from: date, to: date, staffId: ref.optional(), ...paging };
  const write = { idempotencyKey: z.string().min(8).max(128).regex(/^[\w.:-]+$/) };
  const query = z.string().trim().max(80);

  tool("get_workday_brief", "bookings:read", z.strictObject({}), ({ workspace }) => workspace.brief());
  tool("list_inbox_items", "inbox:read", z.strictObject(paging), ({ workspace }, p) => workspace.inbox(p));
  tool("get_inbox_thread", "inbox:read", z.strictObject({ itemId: id }), ({ workspace }, p) => workspace.thread(p.itemId));
  tool("get_booking_details", "bookings:read", z.strictObject({ bookingId: id }), ({ workspace }, p) => workspace.booking(p.bookingId));
  tool("find_bookings", "bookings:read", z.strictObject({ date: date.optional(), query: query.optional(), ...paging }),
    ({ workspace }, { date, query, ...p }) => workspace.bookings(date, query, p));
  tool("find_reschedule_options", "bookings:read", z.strictObject({ bookingId: id, date: date.optional(), ...paging }),
    ({ workspace }, { bookingId, date, ...p }) => workspace.slots(bookingId, date, p));
  tool("list_calendar_window", "bookings:read", z.strictObject(range), ({ workspace }, p) => workspace.calendar(p));
  tool("find_bookable_times", "bookings:read", z.strictObject({ serviceId: ref, ...range }), ({ workspace }, p) => workspace.bookable(p));

  tool("propose_reschedule_booking", "bookings:propose", z.strictObject({ bookingId: id, date, time: field.time, ...write }),
    ({ grant, workspace }, { idempotencyKey, ...p }) => workspace.propose(grant.clientId, idempotencyKey, p), false);
  tool("propose_block_time", "bookings:propose", z.strictObject({ staffId: ref, date, from: field.time, to: field.time, reason: z.enum(blockReasons), ...write }),
    ({ grant, workspace }, { idempotencyKey, ...p }) => workspace.propose(grant.clientId, idempotencyKey, { kind: "block", ...p }), false);
  tool("propose_new_booking", "bookings:propose", z.strictObject({ serviceId: ref, staffId: ref, date, time: field.time,
    customerId: ref.optional(), newCustomerName: z.enum(fictionalNames).optional(), ...write }),
    ({ grant, workspace }, { idempotencyKey, ...p }) => workspace.propose(grant.clientId, idempotencyKey, { kind: "book", ...p }), false);
  tool("propose_cancel_booking", "bookings:propose", z.strictObject({ bookingId: id, reason: z.enum(cancelReasons), ...write }),
    ({ grant, workspace }, { idempotencyKey, ...p }) => workspace.propose(grant.clientId, idempotencyKey, { kind: "cancel", ...p }), false);

  tool("find_customers", "customers:read", z.strictObject({ query, ...paging }), ({ workspace }, { query, ...p }) => workspace.customers(query, p));
  tool("get_visit_history", "customers:read", z.strictObject({ customerId: ref, ...paging }), ({ workspace }, { customerId, ...p }) => workspace.history(customerId, p));
  tool("list_due_back_customers", "customers:read", z.strictObject(paging), ({ workspace }, p) => workspace.dueBack(p));
  tool("propose_reply_to_inbox_item", "inbox:propose", z.strictObject({ itemId: id, template: z.enum(replyTemplates).optional(),
    replyText: z.string().trim().min(1).max(320).optional(), ...write }),
    ({ grant, workspace }, { idempotencyKey, ...p }) => workspace.propose(grant.clientId, idempotencyKey, { kind: "reply", ...p }), false);

  tool("list_treatments", "catalog:read", z.strictObject(paging), ({ workspace }, p) => workspace.treatments(p));
  tool("propose_change_treatment_price", "catalog:propose", z.strictObject({ serviceId: ref, newPrice: z.int().min(0).max(MAX_PRICE * 100), ...write }),
    ({ grant, workspace }, { idempotencyKey, ...p }) => workspace.propose(grant.clientId, idempotencyKey, { kind: "price", ...p }), false);
  tool("propose_change_treatment_availability", "catalog:propose", z.strictObject({ serviceId: ref, visible: z.boolean(), ...write }),
    ({ grant, workspace }, { idempotencyKey, ...p }) => workspace.propose(grant.clientId, idempotencyKey, { kind: "visibility", ...p }), false);

  tool("list_staff", "staff:read", z.strictObject(paging), ({ workspace }, p) => workspace.staff(p));
  tool("get_staff_schedule", "staff:read", z.strictObject({ staffId: ref, week: date, ...paging }),
    ({ workspace }, { staffId, week, ...p }) => workspace.schedule(staffId, week, p));
  tool("get_finance_summary", "finance:read", z.strictObject({ period: z.enum(["day", "week", "month", "year"]) }),
    ({ workspace }, { period }) => workspace.finance(period));
  tool("get_proposal_status", ["bookings:propose", "catalog:propose", "inbox:propose"], z.strictObject({ proposalId: id }),
    ({ workspace, grant }, p) => workspace.proposal(p.proposalId, grant.scopes.split(" ")));
}
