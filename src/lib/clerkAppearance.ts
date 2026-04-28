export const clerkAppearance = {
  variables: {
    colorPrimary: "#3B5BA5",
    colorText: "#24324a",
    colorTextSecondary: "#667085",
    colorBackground: "#ffffff",
    colorInputBackground: "#ffffff",
    colorInputText: "#24324a",
    colorDanger: "#E8896B",
    colorSuccess: "#6BA368",
    fontFamily:
      'Inter, "Noto Sans SC", "PingFang HK", "PingFang SC", ui-sans-serif, system-ui, -apple-system, sans-serif',
    fontFamilyButtons:
      'Inter, "Noto Sans SC", "PingFang HK", "PingFang SC", ui-sans-serif, system-ui, -apple-system, sans-serif',
    borderRadius: "1rem",
    fontSize: "0.95rem",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "w-full shadow-none",
    card:
      "w-full rounded-[1.25rem] border border-[#DDD6C8]/80 bg-white/90 px-7 py-8 shadow-[0_28px_70px_-34px_rgba(59,91,165,0.25)] backdrop-blur-sm",
    headerTitle: "font-serif text-2xl text-[#24324a] tracking-tight",
    headerSubtitle: "text-sm text-[#667085]",
    socialButtonsBlockButton:
      "rounded-2xl border border-[#DDD6C8]/80 bg-white text-[#24324a] hover:bg-[#FAF7F2] hover:border-[#3B5BA5]/30 shadow-sm transition normal-case py-2.5",
    socialButtonsBlockButtonText: "font-medium text-[0.95rem]",
    dividerRow: "my-5",
    dividerLine: "bg-[#DDD6C8]/70",
    dividerText: "text-[#667085] text-[0.68rem] uppercase tracking-[0.28em]",
    formFieldLabel: "text-[#24324a]/80 text-sm font-medium",
    formFieldInput:
      "rounded-2xl border border-[#DDD6C8]/80 bg-white px-4 py-3 text-[#24324a] shadow-sm transition placeholder:text-[#667085]/60 focus:border-[#3B5BA5]/60 focus:ring-4 focus:ring-[#3B5BA5]/10 focus:outline-none",
    formFieldInputShowPasswordButton: "text-[#667085] hover:text-[#3B5BA5]",
    formButtonPrimary:
      "rounded-full bg-[#3B5BA5] hover:bg-[#3B5BA5]/90 text-white font-medium tracking-normal normal-case shadow-[0_20px_50px_-28px_rgba(36,50,74,0.28)] transition py-2.5",
    formFieldAction: "text-[#3B5BA5] hover:text-[#3B5BA5]/80 font-medium",
    footer: "hidden",
    identityPreview:
      "rounded-2xl border border-[#DDD6C8]/80 bg-[#FFFDFC]/80 px-4 py-3",
    identityPreviewText: "text-[#24324a]",
    identityPreviewEditButton: "text-[#3B5BA5] hover:text-[#3B5BA5]/80",
    formResendCodeLink: "text-[#3B5BA5] hover:text-[#3B5BA5]/80",
    otpCodeFieldInput:
      "rounded-2xl border border-[#DDD6C8]/80 bg-white text-[#24324a] focus:border-[#3B5BA5]/60 focus:ring-4 focus:ring-[#3B5BA5]/10",
    formFieldErrorText: "text-[#E8896B]",
    alert:
      "rounded-2xl border border-[#E8896B]/30 bg-[#E8896B]/10 text-[#24324a]",
    alertText: "text-[#24324a]",
    badge: "rounded-full bg-[#3B5BA5]/10 text-[#3B5BA5] border-0",
    formFieldHintText: "text-[#667085] text-xs",
  },
  layout: {
    socialButtonsPlacement: "top" as const,
    socialButtonsVariant: "blockButton" as const,
    showOptionalFields: true,
    logoPlacement: "none" as const,
  },
};
