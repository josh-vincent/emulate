import type { RouteContext } from "@emulators/core";
import { getSimproStore } from "../store.js";
import {
  simproError,
  simproPaginate,
  parseSimproBody,
  parseId,
} from "../helpers.js";
import { formatSchedule } from "../formatters.js";
import type { ScheduleBlock } from "../entities.js";

const C = "/api/v1.0/companies/:c";

export function scheduleRoutes(ctx: RouteContext): void {
  const { app, store } = ctx;
  const ss = () => getSimproStore(store);

  // List schedules — filter: Job.ID, Staff.ID, Date, DateRange.From/To
  app.get(`${C}/schedules/`, (c) => {
    const jobIdStr = c.req.query("Job.ID");
    const staffIdStr = c.req.query("Staff.ID");
    const dateFilter = c.req.query("Date");
    const dateFrom = c.req.query("DateRange.From");
    const dateTo = c.req.query("DateRange.To");

    let schedules = ss().schedules.all();
    if (jobIdStr) {
      const jobId = parseInt(jobIdStr, 10);
      if (!isNaN(jobId)) schedules = schedules.filter((s) => s.job_id === jobId);
    }
    if (staffIdStr) {
      const staffId = parseInt(staffIdStr, 10);
      if (!isNaN(staffId)) schedules = schedules.filter((s) => s.staff_id === staffId);
    }
    if (dateFilter) schedules = schedules.filter((s) => s.date === dateFilter);
    if (dateFrom) schedules = schedules.filter((s) => s.date >= dateFrom);
    if (dateTo) schedules = schedules.filter((s) => s.date <= dateTo);

    const s = ss();
    return simproPaginate(c, schedules, (sched) => formatSchedule(sched, s));
  });

  // Create schedule
  app.post(`${C}/schedules/`, async (c) => {
    const body = await parseSimproBody(c);
    const s = ss();

    const jobRef = body.Job as Record<string, unknown> | undefined;
    const staffRef = body.Staff as Record<string, unknown> | undefined;
    const ccRef = body.CostCenter as Record<string, unknown> | undefined;

    const schedule = s.schedules.insert({
      job_id: jobRef?.ID ? parseInt(String(jobRef.ID), 10) : 0,
      cost_center_id: ccRef?.ID ? parseInt(String(ccRef.ID), 10) : null,
      cost_center_name: (ccRef?.Name as string) ?? "",
      staff_id: staffRef?.ID ? parseInt(String(staffRef.ID), 10) : null,
      date: (body.Date as string) ?? "",
      blocks: (body.Blocks as ScheduleBlock[]) ?? [],
      notes: (body.Notes as string) ?? "",
    });
    return c.json(formatSchedule(schedule, s), 201);
  });

  // Get schedule
  app.get(`${C}/schedules/:id`, (c) => {
    const id = parseId(c.req.param("id"));
    if (!id) return simproError(c, 400, "Invalid ID");
    const s = ss();
    const schedule = s.schedules.get(id);
    if (!schedule) return simproError(c, 404, "Schedule not found");
    return c.json(formatSchedule(schedule, s));
  });

  // Update schedule
  app.put(`${C}/schedules/:id`, async (c) => {
    const id = parseId(c.req.param("id"));
    if (!id) return simproError(c, 400, "Invalid ID");
    const s = ss();
    const existing = s.schedules.get(id);
    if (!existing) return simproError(c, 404, "Schedule not found");

    const body = await parseSimproBody(c);
    const jobRef = body.Job as Record<string, unknown> | undefined;
    const staffRef = body.Staff as Record<string, unknown> | undefined;
    const ccRef = body.CostCenter as Record<string, unknown> | undefined;

    const updated = s.schedules.update(id, {
      job_id: jobRef?.ID ? parseInt(String(jobRef.ID), 10) : existing.job_id,
      cost_center_id: ccRef?.ID ? parseInt(String(ccRef.ID), 10) : existing.cost_center_id,
      cost_center_name: (ccRef?.Name as string) ?? existing.cost_center_name,
      staff_id: staffRef?.ID ? parseInt(String(staffRef.ID), 10) : existing.staff_id,
      date: (body.Date as string) ?? existing.date,
      blocks: (body.Blocks as ScheduleBlock[]) ?? existing.blocks,
      notes: (body.Notes as string) ?? existing.notes,
    });
    return c.json(formatSchedule(updated!, s));
  });

  // Delete schedule
  app.delete(`${C}/schedules/:id`, (c) => {
    const id = parseId(c.req.param("id"));
    if (!id) return simproError(c, 400, "Invalid ID");
    const deleted = ss().schedules.delete(id);
    if (!deleted) return simproError(c, 404, "Schedule not found");
    return c.json({ ID: id });
  });
}
