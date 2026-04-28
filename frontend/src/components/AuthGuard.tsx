"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken, getRole } from "../lib/auth";

interface Props {
  requiredRole: string;
  children: React.ReactNode;
}

export default function AuthGuard({ requiredRole, children }: Props) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getToken();
    const role  = getRole();

    if (!token || role !== requiredRole) {
      sessionStorage.setItem("redirectAfterLogin", window.location.pathname);
      router.replace("/login");
    } else {
      setReady(true);
    }
  }, [requiredRole, router]);

  // Render nothing until auth confirmed — prevents flash of protected content
  if (!ready) return null;

  return <>{children}</>;
}
