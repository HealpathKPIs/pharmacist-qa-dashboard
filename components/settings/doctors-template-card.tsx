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
    <Card className="animate-soft-in border-white/10 bg-white/[0.04] shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Download aria-hidden="true" className="h-5 w-5 text-emerald-300" />
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
            "w-full border-white/15 bg-white/5 text-white hover:bg-white/10",
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
