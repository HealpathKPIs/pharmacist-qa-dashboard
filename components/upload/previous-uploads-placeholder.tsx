import { Clock3 } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function PreviousUploadsPlaceholder() {
  return (
    <Card className="border-white/10 bg-white/[0.04] shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Clock3 aria-hidden="true" className="h-5 w-5 text-emerald-300" />
          Previous Uploads
        </CardTitle>
        <CardDescription>
          Upload history will appear here after import processing is connected.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-dashed border-white/10 bg-black/20 px-4 py-8 text-center text-sm text-zinc-500">
          No previous uploads to display yet.
        </div>
      </CardContent>
    </Card>
  );
}
