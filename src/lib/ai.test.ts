import { describe, expect, it, vi } from "vitest";

vi.mock("./webSearch", () => ({
  searchWeb: vi.fn(),
  checkWebSearchAllowed: vi.fn(),
  formatSearchResults: vi.fn(),
}));

import { parseActionsFromQuery } from "./ai";

function parse(query: string) {
  return parseActionsFromQuery(query.toLowerCase(), query);
}

describe("parseActionsFromQuery", () => {
  it("creates a task from a quoted natural-language phrase", () => {
    expect(parse('Create a task called "Buy groceries"')).toEqual([
      { type: "create", entity: "task", data: { title: "Buy groceries" } },
    ]);
  });

  it("creates a task from an unquoted natural-language phrase", () => {
    expect(parse("Create a task called Buy cereal")).toEqual([
      { type: "create", entity: "task", data: { title: "Buy cereal" } },
    ]);
  });

  it("rejects 'create a task in/for/under X' (no title)", () => {
    expect(parse("create a task in Work")).toEqual([]);
    expect(parse("create a task for Work")).toEqual([]);
    expect(parse("create a task under Work")).toEqual([]);
  });

  it("maps milestones to goals with a project parent", () => {
    expect(parse('Create a milestone called "Launch" in "Project X"')).toEqual([
      {
        type: "create",
        entity: "goal",
        data: { title: "Launch", project_id: "Project X" },
      },
    ]);
  });

  it("creates a habit from a natural-language phrase", () => {
    expect(parse('Create a habit called "Read"')).toEqual([
      { type: "create", entity: "habit", data: { title: "Read" } },
    ]);
  });

  it("parses structured bracket create commands", () => {
    expect(parse('[create_task: {"title":"Walk dog"}]')).toEqual([
      { type: "create", entity: "task", data: { title: "Walk dog" } },
    ]);
  });

  it("parses structured bracket project creates", () => {
    expect(parse('[create_project: {"title":"Q3"}]')).toEqual([
      { type: "create", entity: "project", data: { title: "Q3" } },
    ]);
  });

  it("parses structured bracket update commands with id", () => {
    expect(parse('[update_task: {"id":"t1","status":"done"}]')).toEqual([
      {
        type: "update",
        entity: "task",
        data: { id: "t1", status: "done" },
        id: "t1",
      },
    ]);
  });

  it("parses structured bracket delete commands with id", () => {
    expect(parse('[delete_task: {"id":"t1"}]')).toEqual([
      { type: "delete", entity: "task", id: "t1" },
    ]);
  });

  it("parses structured bracket read commands", () => {
    expect(parse("[read_task]")).toEqual([
      { type: "read", entity: "task", data: {} },
    ]);
  });

  it("falls back to a raw payload on malformed bracket JSON", () => {
    expect(parse("[create_task: not-json]")).toEqual([
      { type: "create", entity: "task", data: { raw: "not-json" } },
    ]);
  });

  it("deduplicates identical create actions across lines", () => {
    expect(parse('[create_task: {"title":"Walk dog"}]\n[create_task: {"title":"Walk dog"}]')).toEqual([
      { type: "create", entity: "task", data: { title: "Walk dog" } },
    ]);
  });
});
