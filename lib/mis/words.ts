// Display names only. Stored statuses and transaction types keep their original meaning.
const names: Record<string, string> = {
  "Pending Price Review": "Waiting for review",
  "Pending Product Review": "Waiting for review",
  Pending: "Waiting for approval",
  "Above Reference": "Higher than matching prices",
  "Too Few References": "Not enough matching prices",
  "No Active Rule": "Automatic approval is not set up",
  "Unreliable Product Match": "Product details need a check",
  Opening: "Starting stock",
  Restock: "Stock received",
  Sale: "Sold",
  Loss: "Lost",
  Spoilage: "Spoiled",
  Damage: "Damaged",
  Correction: "Adjust stock or cost",
  Reversal: "Undo an entry",
};
export function simpleText(value: unknown): string {
  const text = String(value ?? "—");
  return names[text] ?? text;
}
export function simpleMessage(message: string): string {
  const reason = Object.keys(names).find((key) =>
    message.startsWith("Pending Price Review: " + key),
  );
  return reason
    ? `Waiting for review: ${simpleText(reason)}. Your current approved price stays in use.`
    : message;
}
