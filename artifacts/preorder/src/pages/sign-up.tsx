import { SignUp } from "@clerk/clerk-react";

export default function SignUpPage() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background p-4">
      <SignUp
        routing="path"
        path={`${base}/sign-up`}
        signInUrl={`${base}/sign-in`}
        fallbackRedirectUrl={`${base}/profile`}
      />
    </div>
  );
}
