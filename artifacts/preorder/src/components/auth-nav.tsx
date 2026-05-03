import { Link } from "wouter";
import { SignedIn, SignedOut, useUser, useClerk } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { LogIn, User as UserIcon, ListOrdered, LogOut } from "lucide-react";

export function AuthNav() {
  const { user } = useUser();
  const { signOut } = useClerk();
  return (
    <div className="flex items-center gap-2">
      <SignedOut>
        <Link href="/sign-in">
          <Button variant="ghost" size="sm" className="gap-1">
            <LogIn className="w-4 h-4" />
            <span>Anmelden</span>
            <span className="text-[10px] opacity-60">/ Sign in</span>
          </Button>
        </Link>
      </SignedOut>
      <SignedIn>
        <Link href="/my-orders">
          <Button variant="ghost" size="sm" className="gap-1">
            <ListOrdered className="w-4 h-4" />
            <span className="hidden sm:inline">Bestellungen</span>
          </Button>
        </Link>
        <Link href="/profile">
          <Button variant="ghost" size="sm" className="gap-1">
            <UserIcon className="w-4 h-4" />
            <span className="hidden sm:inline truncate max-w-[8rem]">
              {user?.firstName || user?.username || "Profile"}
            </span>
          </Button>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => signOut({ redirectUrl: import.meta.env.BASE_URL })}
          aria-label="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </SignedIn>
    </div>
  );
}
