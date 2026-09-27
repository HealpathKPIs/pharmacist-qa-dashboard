import { Download } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function DoctorsTemplateCard() {
  return (
    <Card className="animate-soft-in border-tint/10 bg-surface shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-fg-strong">
          <Download aria-hidden="true" className="h-5 w-5 text-brand" />
          Doctors Upload Template
        </CardTitle>
        <CardDescription>
          Download the official eight-column workbook for Doctors QA imports.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <a
          className={cn(
            buttonVariants({ variant: "outline" }),
            "w-full border-tint/15 bg-tint/5 text-fg-strong hover:bg-tint/10",
          )}
          href="/api/upload/template?auditType=doctors"
        >
          <Download aria-hidden="true" className="h-4 w-4" />
          Download Template
        </a>
      </CardContent>
    </Card>
  );
}
