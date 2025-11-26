import { z } from "zod";

/**
 * UI Showcase Schema
 *
 * Demonstrates various data types that can be rendered with @openai/apps-sdk-ui components.
 * This serves as a reference for the Widget Development Agent.
 */

const NotificationSchema = z.object({
  id: z.string(),
  type: z.enum(["info", "success", "warning", "danger"]),
  title: z.string(),
  message: z.string(),
});

const ActionSchema = z.object({
  id: z.string(),
  label: z.string(),
  variant: z.enum(["solid", "soft", "outline", "ghost"]),
  color: z.enum(["primary", "secondary", "danger", "success"]),
});

const StatSchema = z.object({
  label: z.string(),
  value: z.string(),
  change: z.string().optional(),
  trend: z.enum(["up", "down", "neutral"]).optional(),
});

export const ShowcaseSchema = z.object({
  title: z.string(),
  description: z.string(),
  notifications: z.array(NotificationSchema),
  actions: z.array(ActionSchema),
  stats: z.array(StatSchema),
  markdown: z.string(),
});

export type Showcase = z.infer<typeof ShowcaseSchema>;
export type Notification = z.infer<typeof NotificationSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type Stat = z.infer<typeof StatSchema>;

/**
 * Example data for development and widget-metadata.json
 */
export const exampleShowcaseData: Showcase = {
  title: "UI Component Showcase",
  description: "A demonstration of @openai/apps-sdk-ui components",
  notifications: [
    {
      id: "1",
      type: "success",
      title: "Success",
      message: "Your changes have been saved successfully.",
    },
    {
      id: "2",
      type: "info",
      title: "Information",
      message: "New features are available in this update.",
    },
    {
      id: "3",
      type: "warning",
      title: "Warning",
      message: "Your session will expire in 5 minutes.",
    },
  ],
  actions: [
    { id: "1", label: "Primary Action", variant: "solid", color: "primary" },
    { id: "2", label: "Secondary", variant: "soft", color: "secondary" },
    { id: "3", label: "Outline", variant: "outline", color: "primary" },
    { id: "4", label: "Ghost", variant: "ghost", color: "secondary" },
  ],
  stats: [
    { label: "Total Users", value: "12,345", change: "+12%", trend: "up" },
    { label: "Revenue", value: "$45,678", change: "+8%", trend: "up" },
    { label: "Active Now", value: "234", trend: "neutral" },
    { label: "Bounce Rate", value: "23%", change: "-5%", trend: "down" },
  ],
  markdown: `## Markdown Support

This component supports **bold**, *italic*, and \`inline code\`.

- List item one
- List item two
- List item three

> Blockquotes are also supported.
`,
};
