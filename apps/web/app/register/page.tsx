import RegisterContent from "./register-content";
import { safeNextPath } from "../../lib/api/navigation";

export default async function Register({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const query = await searchParams;
  const next = safeNextPath(typeof query.next === "string" ? query.next : null);
  return <RegisterContent next={next} />;
}
