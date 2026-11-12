"use client";

import Form from "next/form";
import type { ReactNode } from "react";

/**
 * The Classes filter form. A select applies as soon as it changes; the search box still waits for Enter
 * or the Search button. Without JavaScript it is a plain GET form, so every control works with the button.
 */
export function CourseFilterForm({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <Form
      action="/courses"
      scroll={false}
      className={className}
      aria-label="Filter classes"
      onChange={(e) => {
        if (e.target instanceof HTMLSelectElement) e.currentTarget.requestSubmit();
      }}
    >
      {children}
    </Form>
  );
}
