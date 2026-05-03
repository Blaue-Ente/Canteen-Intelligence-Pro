import { SignIn } from "@clerk/clerk-react";

export default function SignInPage() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background p-4">
      <SignIn
        routing="path"
        path={`${base}/sign-in`}
        signUpUrl={`${base}/sign-up`}
        fallbackRedirectUrl={`${base}/profile`}
      />
    </div>
  );
}
