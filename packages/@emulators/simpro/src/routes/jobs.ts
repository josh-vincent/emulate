import type { RouteContext } from "@emulators/core";
import { getSimproStore } from "../store.js";
import type { JobCostCenter, JobSection } from "../entities.js";
import {
  simproError,
  simproPaginate,
  parseSimproBody,
  parseId,
  nextJobOrderNo,
  nextSectionId,
  nextCostCenterId,
} from "../helpers.js";
import { formatJob, formatSection, formatJobCostCenter } from "../formatters.js";

const C = "/api/v1.0/companies/:c";

export function jobRoutes(ctx: RouteContext): void {
  const { app, store } = ctx;
  const ss = () => getSimproStore(store);

  // ---- Jobs CRUD ----

  app.get(`${C}/jobs/`, (c) => {
    const customerIdStr = c.req.query("Customer.ID");
    const stageFilter = c.req.query("Stage");
    const siteIdStr = c.req.query("Site.ID");

    let jobs = ss().jobs.all();

    if (customerIdStr) {
      const custId = parseInt(customerIdStr, 10);
      if (!isNaN(custId)) jobs = jobs.filter((j) => j.customer_id === custId);
    }
    if (stageFilter) jobs = jobs.filter((j) => j.stage === stageFilter);
    if (siteIdStr) {
      const siteId = parseInt(siteIdStr, 10);
      if (!isNaN(siteId)) jobs = jobs.filter((j) => j.site_id === siteId);
    }

    const s = ss();
    return simproPaginate(c, jobs, (j) => formatJob(j, s));
  });

  app.post(`${C}/jobs/`, async (c) => {
    const body = await parseSimproBody(c);
    const s = ss();

    const customerRef = body.Customer as Record<string, unknown> | undefined;
    const siteRef = body.Site as Record<string, unknown> | undefined;

    const custId = customerRef?.ID ? parseInt(String(customerRef.ID), 10) : 0;
    const siteId = siteRef?.ID ? parseInt(String(siteRef.ID), 10) : null;

    const job = s.jobs.insert({
      type: "Job",
      order_no: (body.OrderNo as string) || nextJobOrderNo(s.jobs.all()),
      description: (body.Description as string) ?? "",
      customer_id: custId,
      site_id: siteId,
      stage: (body.Stage as "Pending" | "Progress" | "Complete" | "Void") ?? "Pending",
      status_id: null,
      issued_date: (body.DateIssued as string) ?? new Date().toISOString(),
      due_date: (body.DateDue as string) ?? "",
      total_ex_tax: (body.TotalExTax as number) ?? 0,
      total_inc_tax: (body.TotalIncTax as number) ?? 0,
      sections: (body.Sections as JobSection[]) ?? [],
      tags: (body.Tags as string[]) ?? [],
    });
    return c.json(formatJob(job, s), 201);
  });

  app.get(`${C}/jobs/:id`, (c) => {
    const id = parseId(c.req.param("id"));
    if (!id) return simproError(c, 400, "Invalid ID");
    const s = ss();
    const job = s.jobs.get(id);
    if (!job) return simproError(c, 404, "Job not found");
    return c.json(formatJob(job, s));
  });

  app.put(`${C}/jobs/:id`, async (c) => {
    const id = parseId(c.req.param("id"));
    if (!id) return simproError(c, 400, "Invalid ID");
    const s = ss();
    const existing = s.jobs.get(id);
    if (!existing) return simproError(c, 404, "Job not found");

    const body = await parseSimproBody(c);
    const customerRef = body.Customer as Record<string, unknown> | undefined;
    const siteRef = body.Site as Record<string, unknown> | undefined;

    const updated = s.jobs.update(id, {
      description: (body.Description as string) ?? existing.description,
      order_no: (body.OrderNo as string) ?? existing.order_no,
      customer_id: customerRef?.ID ? parseInt(String(customerRef.ID), 10) : existing.customer_id,
      site_id: siteRef?.ID ? parseInt(String(siteRef.ID), 10) : existing.site_id,
      stage: (body.Stage as "Pending" | "Progress" | "Complete" | "Void") ?? existing.stage,
      issued_date: (body.DateIssued as string) ?? existing.issued_date,
      due_date: (body.DateDue as string) ?? existing.due_date,
      total_ex_tax: (body.TotalExTax as number) ?? existing.total_ex_tax,
      total_inc_tax: (body.TotalIncTax as number) ?? existing.total_inc_tax,
      tags: (body.Tags as string[]) ?? existing.tags,
    });
    return c.json(formatJob(updated!, s));
  });

  app.delete(`${C}/jobs/:id`, (c) => {
    const id = parseId(c.req.param("id"));
    if (!id) return simproError(c, 400, "Invalid ID");
    const deleted = ss().jobs.delete(id);
    if (!deleted) return simproError(c, 404, "Job not found");
    return c.json({ ID: id });
  });

  // Attachments stub
  app.get(`${C}/jobs/:id/attachments/`, (c) => {
    const id = parseId(c.req.param("id"));
    if (!id) return simproError(c, 400, "Invalid ID");
    if (!ss().jobs.get(id)) return simproError(c, 404, "Job not found");
    return c.json([]);
  });

  // ---- Sections ----

  app.get(`${C}/jobs/:id/sections/`, (c) => {
    const id = parseId(c.req.param("id"));
    if (!id) return simproError(c, 400, "Invalid ID");
    const job = ss().jobs.get(id);
    if (!job) return simproError(c, 404, "Job not found");
    return simproPaginate(c, job.sections ?? [], formatSection);
  });

  app.post(`${C}/jobs/:id/sections/`, async (c) => {
    const id = parseId(c.req.param("id"));
    if (!id) return simproError(c, 400, "Invalid ID");
    const s = ss();
    const job = s.jobs.get(id);
    if (!job) return simproError(c, 404, "Job not found");

    const body = await parseSimproBody(c);
    const newSection: JobSection = {
      id: nextSectionId(job),
      name: (body.Name as string) ?? "Section",
      cost_centers: [],
    };
    s.jobs.update(id, { sections: [...(job.sections ?? []), newSection] });
    return c.json(formatSection(newSection), 201);
  });

  app.get(`${C}/jobs/:id/sections/:secId`, (c) => {
    const id = parseId(c.req.param("id"));
    const secId = parseId(c.req.param("secId"));
    if (!id || !secId) return simproError(c, 400, "Invalid ID");
    const job = ss().jobs.get(id);
    if (!job) return simproError(c, 404, "Job not found");
    const section = job.sections?.find((s) => s.id === secId);
    if (!section) return simproError(c, 404, "Section not found");
    return c.json(formatSection(section));
  });

  app.put(`${C}/jobs/:id/sections/:secId`, async (c) => {
    const id = parseId(c.req.param("id"));
    const secId = parseId(c.req.param("secId"));
    if (!id || !secId) return simproError(c, 400, "Invalid ID");
    const s = ss();
    const job = s.jobs.get(id);
    if (!job) return simproError(c, 404, "Job not found");
    const sectionIdx = job.sections?.findIndex((sec) => sec.id === secId) ?? -1;
    if (sectionIdx === -1) return simproError(c, 404, "Section not found");

    const body = await parseSimproBody(c);
    const sections = [...(job.sections ?? [])];
    sections[sectionIdx] = { ...sections[sectionIdx], name: (body.Name as string) ?? sections[sectionIdx].name };
    s.jobs.update(id, { sections });
    return c.json(formatSection(sections[sectionIdx]));
  });

  app.delete(`${C}/jobs/:id/sections/:secId`, (c) => {
    const id = parseId(c.req.param("id"));
    const secId = parseId(c.req.param("secId"));
    if (!id || !secId) return simproError(c, 400, "Invalid ID");
    const s = ss();
    const job = s.jobs.get(id);
    if (!job) return simproError(c, 404, "Job not found");
    const filtered = (job.sections ?? []).filter((sec) => sec.id !== secId);
    if (filtered.length === (job.sections?.length ?? 0)) return simproError(c, 404, "Section not found");
    s.jobs.update(id, { sections: filtered });
    return c.json({ ID: secId });
  });

  // ---- Section Cost Centers ----

  app.get(`${C}/jobs/:id/sections/:secId/costCenters/`, (c) => {
    const id = parseId(c.req.param("id"));
    const secId = parseId(c.req.param("secId"));
    if (!id || !secId) return simproError(c, 400, "Invalid ID");
    const job = ss().jobs.get(id);
    if (!job) return simproError(c, 404, "Job not found");
    const section = job.sections?.find((s) => s.id === secId);
    if (!section) return simproError(c, 404, "Section not found");
    return simproPaginate(c, section.cost_centers ?? [], formatJobCostCenter);
  });

  app.post(`${C}/jobs/:id/sections/:secId/costCenters/`, async (c) => {
    const id = parseId(c.req.param("id"));
    const secId = parseId(c.req.param("secId"));
    if (!id || !secId) return simproError(c, 400, "Invalid ID");
    const s = ss();
    const job = s.jobs.get(id);
    if (!job) return simproError(c, 404, "Job not found");
    const sectionIdx = job.sections?.findIndex((sec) => sec.id === secId) ?? -1;
    if (sectionIdx === -1) return simproError(c, 404, "Section not found");

    const body = await parseSimproBody(c);
    const sections = [...(job.sections ?? [])];
    const section = { ...sections[sectionIdx] };
    const ccRef = body.CostCenter as Record<string, unknown> | undefined;
    const lrRef = body.LaborRate as Record<string, unknown> | undefined;

    const newCC: JobCostCenter = {
      id: nextCostCenterId(section.cost_centers ?? []),
      name: (body.Name as string) ?? "",
      cost_center_id: ccRef?.ID ? parseInt(String(ccRef.ID), 10) : 0,
      labor_rate_id: lrRef?.ID ? parseInt(String(lrRef.ID), 10) : null,
      total_ex_tax: (body.TotalExTax as number) ?? 0,
    };
    section.cost_centers = [...(section.cost_centers ?? []), newCC];
    sections[sectionIdx] = section;
    s.jobs.update(id, { sections });
    return c.json(formatJobCostCenter(newCC), 201);
  });

  app.get(`${C}/jobs/:id/sections/:secId/costCenters/:ccId`, (c) => {
    const id = parseId(c.req.param("id"));
    const secId = parseId(c.req.param("secId"));
    const ccId = parseId(c.req.param("ccId"));
    if (!id || !secId || !ccId) return simproError(c, 400, "Invalid ID");
    const job = ss().jobs.get(id);
    if (!job) return simproError(c, 404, "Job not found");
    const section = job.sections?.find((s) => s.id === secId);
    if (!section) return simproError(c, 404, "Section not found");
    const cc = section.cost_centers?.find((cc) => cc.id === ccId);
    if (!cc) return simproError(c, 404, "Cost center not found");
    return c.json(formatJobCostCenter(cc));
  });

  app.put(`${C}/jobs/:id/sections/:secId/costCenters/:ccId`, async (c) => {
    const id = parseId(c.req.param("id"));
    const secId = parseId(c.req.param("secId"));
    const ccId = parseId(c.req.param("ccId"));
    if (!id || !secId || !ccId) return simproError(c, 400, "Invalid ID");
    const s = ss();
    const job = s.jobs.get(id);
    if (!job) return simproError(c, 404, "Job not found");
    const sectionIdx = job.sections?.findIndex((sec) => sec.id === secId) ?? -1;
    if (sectionIdx === -1) return simproError(c, 404, "Section not found");
    const ccIdx = job.sections![sectionIdx].cost_centers?.findIndex((cc) => cc.id === ccId) ?? -1;
    if (ccIdx === -1) return simproError(c, 404, "Cost center not found");

    const body = await parseSimproBody(c);
    const sections = [...(job.sections ?? [])];
    const section = { ...sections[sectionIdx] };
    const ccs = [...(section.cost_centers ?? [])];
    const existing = ccs[ccIdx];
    const ccRef = body.CostCenter as Record<string, unknown> | undefined;
    const lrRef = body.LaborRate as Record<string, unknown> | undefined;

    ccs[ccIdx] = {
      id: existing.id,
      name: (body.Name as string) ?? existing.name,
      cost_center_id: ccRef?.ID ? parseInt(String(ccRef.ID), 10) : existing.cost_center_id,
      labor_rate_id: lrRef?.ID ? parseInt(String(lrRef.ID), 10) : existing.labor_rate_id,
      total_ex_tax: (body.TotalExTax as number) ?? existing.total_ex_tax,
    };
    section.cost_centers = ccs;
    sections[sectionIdx] = section;
    s.jobs.update(id, { sections });
    return c.json(formatJobCostCenter(ccs[ccIdx]));
  });

  app.delete(`${C}/jobs/:id/sections/:secId/costCenters/:ccId`, (c) => {
    const id = parseId(c.req.param("id"));
    const secId = parseId(c.req.param("secId"));
    const ccId = parseId(c.req.param("ccId"));
    if (!id || !secId || !ccId) return simproError(c, 400, "Invalid ID");
    const s = ss();
    const job = s.jobs.get(id);
    if (!job) return simproError(c, 404, "Job not found");
    const sectionIdx = job.sections?.findIndex((sec) => sec.id === secId) ?? -1;
    if (sectionIdx === -1) return simproError(c, 404, "Section not found");

    const sections = [...(job.sections ?? [])];
    const section = { ...sections[sectionIdx] };
    const filtered = (section.cost_centers ?? []).filter((cc) => cc.id !== ccId);
    if (filtered.length === (section.cost_centers?.length ?? 0)) return simproError(c, 404, "Cost center not found");
    section.cost_centers = filtered;
    sections[sectionIdx] = section;
    s.jobs.update(id, { sections });
    return c.json({ ID: ccId });
  });
}
