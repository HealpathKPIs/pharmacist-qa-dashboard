import { Progress } from "@/components/ui/progress";

export function UploadProgressPlaceholder() {
  return (
    <div className="space-y-3 rounded-md border border-white/10 bg-black/20 p-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium text-white">Upload progress</p>
        <p className="font-mono text-xs text-zinc-500">Pending</p>
      </div>
      <Progress value={0} />
      <p className="text-xs text-zinc-500">
        Progress details will appear here after upload handling is implemented.
      </p>
    </div>
  );
}
