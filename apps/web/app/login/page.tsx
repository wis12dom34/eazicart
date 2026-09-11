import { Suspense } from "react";
import { LoadingState } from "../components/async-state";
import { LoginContent } from "./login-content";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <LoginContent />
    </Suspense>
  );
}
