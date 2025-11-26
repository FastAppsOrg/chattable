/**
 * UI Component Showcase Widget
 *
 * Demonstrates @openai/apps-sdk-ui components in action.
 * Use this as a reference for building widgets.
 */
import { defineWidget } from "@/utils/defineWidget";
import {
  ShowcaseSchema,
  exampleShowcaseData,
  type Showcase,
  type Notification,
  type Action,
  type Stat,
} from "@apps-sdk-template/shared";
import { mountWidget, useToolOutput } from "skybridge/web";

// @openai/apps-sdk-ui components
import { Alert } from "@openai/apps-sdk-ui/components/Alert";
import { Button } from "@openai/apps-sdk-ui/components/Button";
import { Badge } from "@openai/apps-sdk-ui/components/Badge";
import { Markdown } from "@openai/apps-sdk-ui/components/Markdown";
import "@openai/apps-sdk-ui/css";

function ShowcaseWidget() {
  const data = useToolOutput() as Showcase;

  return (
    <div className="space-y-8 p-6">
      {/* Header */}
      <header>
        <h1 className="text-2xl font-bold">{data.title}</h1>
        <p className="text-gray-600">{data.description}</p>
      </header>

      {/* Alerts Section */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Alerts</h2>
        {data.notifications.map((notification: Notification) => (
          <Alert
            key={notification.id}
            color={notification.type}
            variant="soft"
            title={notification.title}
            description={notification.message}
          />
        ))}
      </section>

      {/* Buttons Section */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Buttons</h2>
        <div className="flex flex-wrap gap-3">
          {data.actions.map((action: Action) => (
            <Button
              key={action.id}
              color={action.color}
              variant={action.variant}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </section>

      {/* Stats Section with Badges */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Stats with Badges</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {data.stats.map((stat: Stat) => (
            <div
              key={stat.label}
              className="rounded-lg border border-gray-200 p-4"
            >
              <div className="text-sm text-gray-500">{stat.label}</div>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-2xl font-bold">{stat.value}</span>
                {stat.change && (
                  <Badge
                    color={
                      stat.trend === "up"
                        ? "success"
                        : stat.trend === "down"
                          ? "danger"
                          : "secondary"
                    }
                  >
                    {stat.change}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Markdown Section */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Markdown</h2>
        <div className="rounded-lg border border-gray-200 p-4">
          <Markdown>{data.markdown}</Markdown>
        </div>
      </section>
    </div>
  );
}

// Define widget with schema and example
const Showcase = defineWidget({
  schema: ShowcaseSchema,
  exampleOutput: exampleShowcaseData,
  component: ShowcaseWidget,
});

export default Showcase;

mountWidget(<Showcase />);
