import { SignUp } from "@clerk/clerk-react";

export default function SignUpPage() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background p-4">
      <div className="flex flex-col items-center gap-0">
        <div className="flex flex-col items-center gap-1 mb-[-8px] z-10">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow">
            <span className="text-white font-bold text-lg">K</span>
          </div>
          <p className="text-sm text-muted-foreground font-medium tracking-wide">KItchenOS</p>
        </div>
        <SignUp
          routing="path"
          path={`${base}/sign-up`}
          signInUrl={`${base}/sign-in`}
          fallbackRedirectUrl={`${base}/profile`}
          appearance={{
            elements: {
              cardBox: "shadow-md rounded-2xl",
              headerTitle: "hidden",
              headerSubtitle: "hidden",
              header: "hidden",
            },
          }}
        />
      </div>
    </div>
  );
}
