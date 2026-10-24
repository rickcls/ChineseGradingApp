// 文體 choices shared by the essay form and teacher assignments. The value is
// what the grading prompt receives.
export const GENRE_OPTIONS = [
  { value: "記敘抒情文", label: "記敘／抒情" },
  { value: "議論文", label: "議論（論說）" },
  { value: "描寫文", label: "描寫" },
  { value: "說明文", label: "說明" },
] as const;

export const GENRE_VALUES = GENRE_OPTIONS.map((option) => option.value) as [string, ...string[]];
