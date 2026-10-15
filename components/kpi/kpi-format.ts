// Labels shared by the KPI sections.

// Ranges are joined by hand: Intl formatRange spacing differs between Node and
// browsers, which breaks hydration.
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

const dayFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function toDate(day: string) {
  return new Date(`${day}T00:00:00.000Z`);
}

export function formatInteger(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatPeriod(startDate: string | null, endDate: string | null) {
  if (startDate && endDate) {
    const startFormatter =
      startDate.slice(0, 4) === endDate.slice(0, 4) ? dayFormatter : dateFormatter;

    return `${startFormatter.format(toDate(startDate))} – ${dateFormatter.format(toDate(endDate))}`;
  }

  if (startDate) {
    return `From ${dateFormatter.format(toDate(startDate))}`;
  }

  if (endDate) {
    return `Up to ${dateFormatter.format(toDate(endDate))}`;
  }

  return "All dates";
}

// Days of a month cut by the date filter, e.g. "Aug 15 – 31".
export function formatCoverage({ from, to }: { from: string; to: string }) {
  const firstDay = dayFormatter.format(toDate(from));

  return from === to ? firstDay : `${firstDay} – ${Number(to.slice(8, 10))}`;
}
