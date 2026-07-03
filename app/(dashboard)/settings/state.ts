export type SettingsActionState = {
  message: string;
  status: "error" | "idle" | "success";
};

export const initialSettingsActionState: SettingsActionState = {
  message: "",
  status: "idle",
};
