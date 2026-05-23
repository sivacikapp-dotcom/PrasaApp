"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { PageSpinner } from "@/components/ui/Spinner";
import type { UserRole } from "@/types/user";

interface RouteGuardProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
}

export function RouteGuard({ children, requiredRole }: RouteGuardProps) {
  const { firebaseUser, appUser, loading, hasRole } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) {
      router.replace("/login");
      return;
    }
    if (appUser && appUser.status !== "active") {
      router.replace("/pending");
      return;
    }
    if (requiredRole && !hasRole(requiredRole)) {
      router.replace("/dashboard");
    }
  }, [firebaseUser, appUser, loading, requiredRole, hasRole, router]);

  if (loading) return <PageSpinner />;
  if (!firebaseUser) return null;
  if (appUser && appUser.status !== "active") return null;
  if (requiredRole && !hasRole(requiredRole)) return null;

  return <>{children}</>;
}
