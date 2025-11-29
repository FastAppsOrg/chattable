/**
 * UI Component Showcase Widget
 *
 * Demonstrates UI components. When @openai/apps-sdk-ui is installed,
 * you can replace these with the official components.
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

/**
 * Simple Alert component (replace with @openai/apps-sdk-ui/components/Alert when available)
 */
function Alert({ color, title, description }: { color: string; title: string; description: string }) {
  const colorStyles: Record<string, string> = {
    success: "bg-green-50 border-green-200 text-green-800",
    info: "bg-blue-50 border-blue-200 text-blue-800",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
    danger: "bg-red-50 border-red-200 text-red-800",
  };
  return (
    <div className={`rounded-lg border p-4 ${colorStyles[color] || colorStyles.info}`}>
      <div className="font-semibold">{title}</div>
      <div className="text-sm opacity-80">{description}</div>
    </div>
  );
}

/**
 * Simple Button component (replace with @openai/apps-sdk-ui/components/Button when available)
 */
function Button({ children, variant, color }: { children: React.ReactNode; variant: string; color: string }) {
  const baseStyles = "px-4 py-2 rounded-lg font-medium transition-colors";
  const variantStyles: Record<string, string> = {
    solid: color === "primary" ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-gray-600 text-white hover:bg-gray-700",
    soft: color === "primary" ? "bg-blue-100 text-blue-700 hover:bg-blue-200" : "bg-gray-100 text-gray-700 hover:bg-gray-200",
    outline: "border-2 border-current bg-transparent hover:bg-gray-50",
    ghost: "bg-transparent hover:bg-gray-100",
  };
  return <button className={`${baseStyles} ${variantStyles[variant] || variantStyles.solid}`}>{children}</button>;
}

/**
 * Simple Badge component (replace with @openai/apps-sdk-ui/components/Badge when available)
 */
function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  const colorStyles: Record<string, string> = {
    success: "bg-green-100 text-green-700",
    danger: "bg-red-100 text-red-700",
    secondary: "bg-gray-100 text-gray-700",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorStyles[color] || colorStyles.secondary}`}>
      {children}
    </span>
  );
}

/**
 * Simple Markdown display (just shows as preformatted text)
 */
function MarkdownDisplay({ content }: { content: string }) {
  return (
    <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700">
      {content}
    </pre>
  );
}

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
          <MarkdownDisplay content={data.markdown} />
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
