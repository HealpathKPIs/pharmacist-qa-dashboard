import { CheckCircle2, FileSpreadsheet, Rows3 } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const summaryItems = [
  {
    label: "Status",
    value: "Waiting",
    icon: CheckCircle2,
  },
  {
    label: "Workbook",
    value: "Not selected",
    icon: FileSpreadsheet,
  },
  {
    label: "Rows imported",
    value: "--",
    icon: Rows3,
  },
];

export function UploadSummaryCard() {
  return (
    <Card className="border-white/10 bg-white/[0.04] shadow-none">
      <CardHeader>
        <CardTitle className="text-white">Upload Summary</CardTitle>
        <CardDescription>
          Import results will be shown here after processing is available.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {summaryItems.map((item) => {
          const Icon = item.icon;

          return (
            <div
              className="flex items-center justify-between gap-4 rounded-md border border-white/10 bg-black/20 p-3"
              key={item.label}
            >
              <div className="flex items-center gap-3">
                <Icon aria-hidden="true" className="h-4 w-4 text-emerald-300" />
                <span className="text-sm text-zinc-400">{item.label}</span>
              </div>
              <span className="text-sm font-medium text-white">{item.value}</span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
