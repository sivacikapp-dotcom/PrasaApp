"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { PageSpinner } from "@/components/ui/Spinner";
import type { UserRole } from "@/types/user";

interface RouteGuardProps {
  children: React.ReactNode;
  requiredRole?: UserRole | UserRole[];
}

export function RouteGuard({ children, requiredRole }: RouteGuardProps) {
  const { firebaseUser, appUser, loading, hasRole } = useAuth();
  const router = useRouter();

  function hasAccess() {
    if (!requiredRole) return true;
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    return roles.some((r) => hasRole(r));
  }

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
    if (!hasAccess()) {
      router.replace("/dashboard");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser, appUser, loading, requiredRole, hasRole, router]);

  if (loading) return <PageSpinner />;
  if (!firebaseUser) return null;
  if (appUser && appUser.status !== "active") return null;
  if (!hasAccess()) return null;

  return <>{children}</>;
}
