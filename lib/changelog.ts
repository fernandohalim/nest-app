import { Release } from "./types";

export const releases: Release[] = [
  {
    version: "2.0",
    date: "apr 13, 2026",
    title: "receipts & borders 🌍",
    badge: "major",
    badgeColor: "bg-emerald-100 text-emerald-700 border-emerald-200",
    features: [
      "added smart multi-currency support with dynamic decimal formatting.",
      "added exportable, high-res, nest-branded receipt images for easy sharing.",
      "fixed the date picker with year navigation and a 'right now' shortcut.",
      "fixed a navigation loop bug when exiting trips."
    ],
  },
  {
    version: "1.2.3",
    date: "apr 2, 2026",
    title: "cleaning up 🧼",
    badge: "patch",
    badgeColor: "bg-teal-100 text-teal-700 border-teal-200",
    features: [
      "refine code-base structure",
      "refine changelog ui, separate static imports.",
    ],
  },
  {
    version: "1.2.2",
    date: "apr 2, 2026",
    title: "small changes 😊",
    badge: "patch",
    badgeColor: "bg-teal-100 text-teal-700 border-teal-200",
    features: ["fix info icon size inconsistency."],
  },
  {
    version: "1.2.1",
    date: "apr 2, 2026",
    title: "crew management & prompt fix 👥",
    badge: "patch",
    badgeColor: "bg-teal-100 text-teal-700 border-teal-200",
    features: [
      "added rename members feature.",
      "refine the member management into a dedicated popup modal.",
      "fix the receipt scanner prompt to strictly output exact category matches.",
    ],
  },
  {
    version: "1.2",
    date: "mar 31, 2026",
    title: "math & polish 💅",
    badge: "feature",
    badgeColor: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",
    features: [
      "added a dedicated in-app changelog page.",
      "added transparent breakdowns for custom adjustments in the detailed ledger.",
      "refine the about screen with new social buttons.",
      "fixed a 'phantom tax' math bug for weighted item splits.",
      "fixed some price ui alignment across the board to snap cleanly to the right edge.",
    ],
  },
  {
    version: "1.1",
    date: "mar 31, 2026",
    title: "receipts & ledgers ✨",
    badge: "feature",
    badgeColor: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",
    features: [
      "added new receipt scanning logic to handle specific item discounts.",
      "added logic to isolate individual item discounts from global tax and discount math.",
      "added individual item prices directly inside the detailed ledger section.",
      "added transparent item breakdowns associated with each member in the expense list.",
    ],
  },
  {
    version: "1.0.1",
    date: "mar 31, 2026",
    title: "bug fixing 🐛",
    badge: "patch",
    badgeColor: "bg-teal-100 text-teal-700 border-teal-200",
    features: [
      "added a shiny new about screen with creator social links.",
      "fixed a buggy bouncing arrow on the home screen empty state.",
      "fixed an issue where the about screen wouldn't show when a trip was empty.",
    ],
  },
  {
    version: "1.0",
    date: "mar 31, 2026",
    title: "the beginning 🐣",
    badge: "launch",
    badgeColor: "bg-amber-100 text-amber-700 border-amber-200",
    features: [
      "launched 'nest.' into the wild!",
      "receipt scanning with gemini!",
      "exact splitting, equal splitting, and custom adjustments.",
      "smart debt optimization (who pays who).",
      "beautiful, transparent ledger breakdowns.",
    ],
  },
];
